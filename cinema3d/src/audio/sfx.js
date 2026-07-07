// 音频:全程序合成(theater sfx 移植)+ THREE.PositionalAudio 空间化
// 心跳可变速 / 尖啸方向化 / 放映机嗡鸣 / 低频铺底 / 死亡抽真空 / 耳鸣
import * as THREE from 'three';
import { LAYOUT } from '../theater/hall.js';

export class Sfx {
  constructor() {
    this.ready = false;
    this.muted = false;
    this._hbTimer = null;
  }

  // 必须在用户手势里调(AudioContext 解锁)
  init(camera, scene) {
    if (this.ready) return;
    this.scene = scene;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = this.listener.context;
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    // 底噪(theater 移植:44Hz 锯齿 + 88Hz 正弦,极低音量的"厅内电流感")
    const o1 = this.ctx.createOscillator(), g1 = this.ctx.createGain();
    o1.type = 'sawtooth'; o1.frequency.value = 44; g1.gain.value = 0.012;
    o1.connect(g1).connect(this.master); o1.start();
    const o2 = this.ctx.createOscillator(), g2 = this.ctx.createGain();
    o2.type = 'sine'; o2.frequency.value = 88; g2.gain.value = 0.007;
    o2.connect(g2).connect(this.master); o2.start();

    // 低频 rumble(可开关)
    this._rumbleGain = this.ctx.createGain();
    this._rumbleGain.gain.value = 0;
    const ro = this.ctx.createOscillator();
    ro.type = 'sine'; ro.frequency.value = 26;
    ro.connect(this._rumbleGain).connect(this.master); ro.start();

    // 放映机嗡鸣:银幕方向 positional 循环(噪声 + 52Hz)
    this._projectorHum();

    this.ready = true;
  }

  _projectorHum() {
    const pa = new THREE.PositionalAudio(this.listener);
    pa.setRefDistance(4); pa.setRolloffFactor(1.4);
    const src = this.ctx.createOscillator();
    src.type = 'triangle'; src.frequency.value = 52;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    src.connect(g);
    pa.setNodeSource(g);
    src.start();
    const o = new THREE.Object3D();
    o.position.set(0, LAYOUT.SCREEN_Y, LAYOUT.SCREEN_Z);
    o.add(pa);
    this.scene.add(o);
  }

  // ---- theater 移植的合成原语 ----
  env(f0, f1, d, v, type) {
    if (!this.ready || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), now = this.ctx.currentTime;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), now + d);
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + d);
  }

  beat() { this.env(58, 38, 0.16, 0.5); setTimeout(() => this.env(50, 32, 0.22, 0.4), 200); }
  sting() { this.env(640, 90, 1.1, 0.06, 'triangle'); this.env(420, 60, 1.4, 0.045, 'sine'); }
  bell() { this.env(1180, 1180, 2.4, 0.05, 'sine'); this.env(2360, 2300, 1.4, 0.02, 'sine'); }

  _noiseBuffer(dur) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    return b;
  }

  // 尖啸(2D 版,theater whoosh)
  whoosh() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this._noiseBuffer(0.8);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 0.8);
    g.gain.value = 0.32;
    s.connect(f).connect(g).connect(this.master);
    s.start();
  }

  // 尖啸方向化:从死亡席位方向传来
  whooshAt(pos) {
    if (!this.ready || this.muted) return this.whoosh();
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this._noiseBuffer(0.9);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(70, t + 0.9);
    g.gain.value = 0.9;
    s.connect(f).connect(g);
    const pa = new THREE.PositionalAudio(this.listener);
    pa.setRefDistance(1.6); pa.setRolloffFactor(1.6);
    pa.setNodeSource(g);
    const o = new THREE.Object3D();
    o.position.copy(pos); o.add(pa);
    this.scene.add(o);
    s.start();
    setTimeout(() => this.scene.remove(o), 1200);
  }

  // 可变速心跳循环:rate 次/秒(0 停)
  heartbeat(rate) {
    if (this._hbTimer) { clearInterval(this._hbTimer); this._hbTimer = null; }
    if (!rate) return;
    const tick = () => this.beat();
    tick();
    this._hbTimer = setInterval(tick, 1000 / rate);
  }

  // FORCED 切入:高频耳鸣一声
  earRing() { this.env(3200, 2900, 1.6, 0.03, 'sine'); }

  // 死亡瞬间抽真空:全场 0.2s 静默再恢复
  vacuum() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.02, now + 0.03);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, now + 0.35);
    this.listener.setMasterVolume(0.02);
    setTimeout(() => this.listener.setMasterVolume(this.muted ? 0 : 1), 260);
  }

  rumble(on) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this._rumbleGain.gain.cancelScheduledValues(now);
    this._rumbleGain.gain.linearRampToValueAtTime(on ? 0.05 : 0, now + 1.2);
  }

  // 屏息段:闷罐滤波感(简化:压 master 到 0.4)
  holdMuffle(on) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(on ? 0.4 : (this.muted ? 0 : 1), now + 0.5);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ready) return;
    this.master.gain.value = m ? 0 : 1;
    this.listener.setMasterVolume(m ? 0 : 1);
  }
}

export const sfx = new Sfx();
