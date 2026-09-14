import { composeSong, extractMotif } from './chipforge/composer.js';
import { defaultMixer, defaultGen } from './chipforge/state.js';
import { ChipSynth } from './chipforge/synth.js';
import { Transport } from './chipforge/scheduler.js';

let volume, volumeTarget;
let ctx, sceneTrack, skillTrack, unlocked = false, hidden = document.hidden;
let state, battle = false, fadeTimer = 0, fadeKind = '', expiryTimer = 0, revision = 0, sceneId;
function track(song, mixer, filtered = false) {
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(volume);
  const filter = filtered ? ctx.createBiquadFilter() : null;
  if (filter) { filter.type = 'lowpass'; filter.frequency.value = 14000; filter.connect(gain); }
  const synth = new ChipSynth(ctx, () => mixer);
  synth.limiter.disconnect(); synth.limiter.connect(filter || gain);
  return { song, mixer, gain, filter, synth, transport: new Transport(synth, {song,mixer}), target:0 };
}
// 現在該放哪一首（第八輪：兩個世界共用這支）。1.0＝掛上的場景曲＋共用的 lastboss 技能曲；
// 末世＝這一站自己的曲＋神話技能曲（clicker-apoc-map.js 的 MUSIC／MYTHIC_MUSIC）。key 不同就換曲。
const HOME_SKILL = { theme: 'lastboss', gen: { density:70, rhythm:75, speed:70, drama:85, mood:60, hook:75, smooth:40 } };
// 抽卡介面自己的曲（使用者 2026-09-14：「抽卡的介面有自己的 BGM」）。招募層／精裝典藏包開著就放這首，兩個世界共用；
// 關掉就回到場景曲。主題由使用者從候選試聽裡挑（candidates：casino 地下賭場／alchemy 鍊金工房／festival 祭典之夜／musicbox 音樂盒回憶／shop 溫馨小店）。
const GACHA_MUSIC = { theme: 'casino', gen: { density:60, rhythm:65, speed:60, drama:40, mood:75, hook:80, smooth:55 }, seed: 'gacha-lobby' };
const gachaOpen = () => ['recruit-layer', 'apoc-ceremony'].some(id => { const el = document.getElementById(id); return el && !el.hidden; });
function current(s) {
  const map = window.ClickerApocMap;
  if (gachaOpen()) return { key: 'gacha', music: GACHA_MUSIC, skill: s.settings.world === 'apoc' && map?.MYTHIC_MUSIC ? map.MYTHIC_MUSIC : HOME_SKILL };
  if (s.settings.world === 'apoc' && map?.musicFor) { const music = map.musicFor(s.apoc); return { key: `apoc:${music.seed}`, music, skill: map.MYTHIC_MUSIC }; }
  const scene = document.getElementById('stage').dataset.scene || s.settings.scene;
  return { key: `home:${scene}`, music: window.ClickerScene.resolve(scene, s.package.index).music, skill: HOME_SKILL };
}
function songs(cur) {
  const song = composeSong({theme:cur.music.theme,steps:32*16,gen:{...defaultGen(),...cur.music.gen},seed:cur.music.seed});
  const skill = composeSong({theme:cur.skill.theme,steps:16*16,gen:{...defaultGen(),...cur.skill.gen,motif:extractMotif(song)},seed:cur.music.seed+'-battle'});
  skill.transpose = song.transpose;   // 技能曲跟場景曲同調，疊上去不打架
  return { song, skill };
}
function skillMixer() { const mixer = defaultMixer(); mixer.master = 64; mixer.duty.lead = '12.5%'; mixer.echo = 14; mixer.retro = false; return mixer; }
function create() {
  const cur = current(state); sceneId = cur.key;
  ctx = new AudioContext();
  volume = ctx.createGain(); volumeTarget = state.settings.musicVolume; volume.gain.value = volumeTarget; volume.connect(ctx.destination);
  const { song, skill } = songs(cur);
  sceneTrack = track(song,{...defaultMixer(),master:60,retro:false});
  skillTrack = track(skill,skillMixer(),true);
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
  // 末世：只有神話卡技能還有點擊加倍次數時才疊技能曲（王關有自己的曲，不再疊）；1.0 照舊（王包或任何技能效果）
  const apoc = state.settings.world === 'apoc', fx = state.apoc?.fx;
  const alive = apoc ? [] : effectsAlive(); battle = apoc ? !!(fx?.mythic && fx.clickLeft > 0) : (!!state.boss || alive.length > 0);
  if (!hidden && alive.length) expiryTimer = setTimeout(() => { safely(sync()); },Math.max(1,Math.min(...alive.map(e=>e.expiresAt))-Date.now()));
  if (!unlocked) return;
  const off = hidden || state.settings.music === false;
  if (!ctx && !off) create();
  if (!ctx) return;
  const cur = current(state);
  if (!off && sceneId!==cur.key) {
    sceneId=cur.key;
    const { song, skill } = songs(cur), old=sceneTrack, oldSkill=skillTrack;
    sceneTrack=track(song,{...defaultMixer(),master:60,retro:false});
    sceneTrack.transport.start(0); curve(old,0,.4); curve(sceneTrack,battle?.24*.15:.24,.4);
    // 技能曲跟著換（同調、帶新曲的動機；切世界時 lastboss ⇄ 神話技能曲）；舊的正在放就一起淡出，下面的 battle 分支會把新的接上
    skillTrack=track(skill,skillMixer(),true);
    if (oldSkill.transport.playing) { curve(oldSkill,0,.4); if (fadeKind === 'skill') { clearTimeout(fadeTimer); fadeTimer=0; fadeKind=''; } }
    setTimeout(()=>{old.transport.stop();old.gain.disconnect();oldSkill.transport.stop();oldSkill.gain.disconnect();},400);
  }
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
