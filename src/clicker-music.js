import { composeSong, extractMotif } from './chipforge/composer.js';
import { defaultMixer, defaultGen } from './chipforge/state.js';
import { ChipSynth } from './chipforge/synth.js';
import { Transport } from './chipforge/scheduler.js';

let volume, volumeTarget;
let ctx, sceneTrack, skillTrack, unlocked = false, hidden = document.hidden;
let state, battle = false, fadeTimer = 0, fadeKind = '', expiryTimer = 0, revision = 0;
function track(song, mixer, filtered = false) {
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(volume);
  const filter = filtered ? ctx.createBiquadFilter() : null;
  if (filter) { filter.type = 'lowpass'; filter.frequency.value = 14000; filter.connect(gain); }
  const synth = new ChipSynth(ctx, () => mixer);
  synth.limiter.disconnect(); synth.limiter.connect(filter || gain);
  return { song, mixer, gain, filter, synth, transport: new Transport(synth, {song,mixer}), target:0 };
}
function create() {
  const music = window.ClickerScene.resolve(state.settings.scene,state.package.index).music;
  ctx = new AudioContext();
  volume = ctx.createGain(); volumeTarget = state.settings.musicVolume; volume.gain.value = volumeTarget; volume.connect(ctx.destination);
  const song = composeSong({theme:music.theme,steps:32*16,gen:{...defaultGen(),...music.gen},seed:music.seed});
  const skill = composeSong({theme:'lastboss',steps:16*16,gen:{...defaultGen(),density:70,rhythm:75,speed:70,drama:85,mood:60,hook:75,smooth:40,motif:extractMotif(song)},seed:music.seed+'-battle'});
  skill.transpose = song.transpose;
  sceneTrack = track(song,{...defaultMixer(),master:60,retro:false});
  const mixer = defaultMixer(); mixer.master = 64; mixer.duty.lead = '12.5%'; mixer.echo = 14; mixer.retro = false;
  skillTrack = track(skill,mixer,true);
}
// Envelopes and user volume are separate AudioParams, so dragging never cancels a transition.
function curve(t, value, seconds, delay = 0) {
  const p = t.gain.gain, now = ctx.currentTime;
  p.cancelAndHoldAtTime(now);
  const from = p.value, values = Float32Array.from({length:64}, (_,i) => {
    const a = i / 63 * Math.PI / 2;
    return value >= from ? from + (value-from)*Math.sin(a) : value + (from-value)*Math.cos(a);
  });
  p.setValueCurveAtTime(values,now+delay,seconds); t.target = value;
}
function lowpass(value, seconds, delay = 0, from) {
  const p = skillTrack.filter.frequency, now = ctx.currentTime;
  p.cancelAndHoldAtTime(now);
  p.setValueAtTime(from ?? p.value,now+delay);
  p.exponentialRampToValueAtTime(value,now+delay+seconds);
}
function afterFade(kind, seconds, done) {
  clearTimeout(fadeTimer); fadeKind = kind;
  fadeTimer = setTimeout(() => { fadeTimer=0; fadeKind=''; safely(done()); },seconds*1000);
}
function pause() {
  sceneTrack?.transport.stop(); skillTrack?.transport.stop();
  return ctx?.suspend();
}
function effectsAlive() {
  const now = Math.max(Date.now(),state.settledAt);
  return state.effects.filter(e => e.expiresAt > now && (e.kind !== 'click' || e.remaining > 0));
}
async function sync(next = state) {
  if (!next) return;
  state = next; const version = ++revision;
  clearTimeout(expiryTimer); expiryTimer = 0;
  const alive = effectsAlive(); battle = alive.length > 0;
  if (!hidden && alive.length) expiryTimer = setTimeout(() => { safely(sync()); },Math.max(1,Math.min(...alive.map(e=>e.expiresAt))-Date.now()));
  if (!unlocked) return;
  const off = hidden || state.settings.music === false;
  if (!ctx && !off) create();
  if (!ctx) return;
  if (off) {
    if (fadeKind !== 'suspend' && ctx.state === 'running') {
      curve(sceneTrack,0,.3); curve(skillTrack,0,.3);
      afterFade('suspend',.3,pause);
    }
    return;
  }
  if (volumeTarget !== state.settings.musicVolume) {
    volumeTarget = state.settings.musicVolume;
    volume.gain.cancelAndHoldAtTime(ctx.currentTime);
    volume.gain.setTargetAtTime(volumeTarget,ctx.currentTime,.2/3);
  }
  const waking = !sceneTrack.transport.playing || fadeKind === 'suspend';
  if (fadeKind === 'suspend') { clearTimeout(fadeTimer); fadeTimer=0; fadeKind=''; }
  await ctx.resume();
  if (version !== revision) return;
  if (!sceneTrack.transport.playing) sceneTrack.transport.start(sceneTrack.transport.lastStep);
  if (battle) {
    if (fadeKind === 'skill') {
      clearTimeout(fadeTimer); fadeTimer=0; fadeKind='';
      curve(skillTrack,.32,.4); lowpass(14000,.4);
      duck();
    } else if (!skillTrack.transport.playing || waking) {
      if (!skillTrack.transport.playing) { skillTrack.transport.start(0); skillTrack.transport.nextTime = ctx.currentTime + .26; }
      duck(); curve(skillTrack,.32,.7,.26); lowpass(14000,.7,.26,900);
    }
  } else if (skillTrack.transport.playing && fadeKind !== 'skill') {
    curve(skillTrack,0,1.4); lowpass(1200,1.4);
    curve(sceneTrack,.24,1.4,.3);
    afterFade('skill',1.4,() => { skillTrack.transport.stop(); skillTrack.transport.lastStep=0; });
  } else if (waking) curve(sceneTrack,.24,1.2);
}
function duck() {
  const p=sceneTrack.gain.gain, now=ctx.currentTime;
  p.cancelAndHoldAtTime(now); p.setTargetAtTime(.24*.15,now,.12);
  sceneTrack.target=.24*.15;
}
function safely(promise) { promise?.catch(err => { console.warn('Clicker BGM:',err); }); }
window.ClickerMusic = {
  sync(next) { safely(sync(next)); },
  suspend() { hidden = true; safely(sync()); },
  resume(next) { hidden = false; safely(sync(next)); },
  get ctx() { return ctx; }, get scene() { return sceneTrack; }, get skill() { return skillTrack; },
  get volume() { return volume; },
};
document.addEventListener('pointerdown', () => {
  if (unlocked || !window.Clicker?.state) return;
  unlocked = true; safely(sync(window.Clicker?.state));
}, {capture:true});
window.dispatchEvent(new Event('clicker-music-ready'));
