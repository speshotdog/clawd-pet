import { composeSong, extractMotif } from './chipforge/composer.js';
import { defaultMixer, defaultGen } from './chipforge/state.js';
import { ChipSynth } from './chipforge/synth.js';
import { Transport } from './chipforge/scheduler.js';

let ctx, sceneTrack, skillTrack, unlocked = false, hidden = document.hidden;
let state, battle = false, fadeTimer = 0, fadeKind = '', expiryTimer = 0, revision = 0;
function track(song, mixer) {
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination);
  const synth = new ChipSynth(ctx, () => mixer);
  synth.limiter.disconnect(); synth.limiter.connect(gain);
  return { song, mixer, gain, synth, transport: new Transport(synth, {song,mixer}), target:0 };
}
function create() {
  const music = window.ClickerScene.resolve(state.settings.scene,state.package.index).music;
  ctx = new AudioContext();
  const song = composeSong({theme:music.theme,steps:32*16,gen:{...defaultGen(),...music.gen},seed:music.seed});
  const skill = composeSong({theme:'lastboss',steps:16*16,gen:{...defaultGen(),density:70,rhythm:75,speed:70,drama:85,mood:60,hook:75,smooth:40,motif:extractMotif(song)},seed:music.seed+'-battle'});
  skill.transpose = song.transpose;
  sceneTrack = track(song,{...defaultMixer(),master:60,retro:false});
  const mixer = defaultMixer(); mixer.master = 64; mixer.duty.lead = '12.5%'; mixer.echo = 14; mixer.retro = false;
  skillTrack = track(skill,mixer);
}
function ramp(t, value, seconds) {
  if (t.target === value) return;
  const p = t.gain.gain, now = ctx.currentTime;
  p.cancelAndHoldAtTime(now); p.linearRampToValueAtTime(value,now+seconds); t.target = value;
}
function clearTimers() { clearTimeout(fadeTimer); clearTimeout(expiryTimer); fadeTimer = expiryTimer = 0; }
function afterFade(kind, done) {
  if (fadeTimer && fadeKind === kind) return;
  clearTimeout(fadeTimer); fadeKind = kind;
  fadeTimer = setTimeout(() => { fadeTimer=0; safely(done()); },800);
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
  const alive = effectsAlive(), wasBattle = battle; battle = alive.length > 0;
  if (!hidden && alive.length) expiryTimer = setTimeout(() => { sync(); },Math.max(1,Math.min(...alive.map(e=>e.expiresAt))-Date.now()));
  if (!unlocked) return;
  if (!ctx && !hidden && !state.settings.muted && state.settings.music !== false) create();
  if (!ctx) return;
  if (hidden || state.settings.muted) { clearTimers(); await pause(); return; }
  if (state.settings.music === false) {
    ramp(sceneTrack,0,.8); ramp(skillTrack,0,.8);
    if (ctx.state === 'running') afterFade('suspend',pause);
    return;
  }
  if (state.settings.music !== false && !battle && sceneTrack.target === 0) { clearTimeout(fadeTimer); fadeTimer=0; }
  if (battle && !wasBattle && !skillTrack.transport.playing) skillTrack.transport.lastStep = 0;
  await ctx.resume();
  if (version !== revision) return;
  if (!sceneTrack.transport.playing) sceneTrack.transport.start(sceneTrack.transport.lastStep);
  if (battle) {
    clearTimeout(fadeTimer); fadeTimer=0;
    if (!skillTrack.transport.playing) skillTrack.transport.start(wasBattle ? skillTrack.transport.lastStep : 0);
    ramp(sceneTrack,.12,.3); ramp(skillTrack,.7,.3);
  } else {
    ramp(sceneTrack,.55,.8); ramp(skillTrack,0,.8);
    if (skillTrack.transport.playing) afterFade('skill',() => { skillTrack.transport.stop(); skillTrack.transport.lastStep=0; });
  }
}
function safely(promise) { promise?.catch(err => { console.warn('Clicker BGM:',err); }); }
window.ClickerMusic = {
  sync(next) { safely(sync(next)); },
  suspend() { hidden = true; ++revision; clearTimers(); safely(pause()); },
  resume(next) { hidden = document.hidden; safely(sync(next)); },
  get ctx() { return ctx; }, get scene() { return sceneTrack; }, get skill() { return skillTrack; },
};
document.addEventListener('pointerdown', () => {
  if (unlocked || !window.Clicker?.state) return;
  unlocked = true; safely(sync(window.Clicker?.state));
}, {capture:true});
window.dispatchEvent(new Event('clicker-music-ready'));
