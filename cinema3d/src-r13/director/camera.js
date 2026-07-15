// 三态镜头导演:AUTO(轨道运镜)/ FP(我的座位第一人称)/ FORCED(轮到你了)
import * as THREE from 'three';
import { SHOTS, HOME_SHOT } from './shots.js';
import { seatWorldPos } from '../theater/hall.js';

const FOV_AUTO = 40, FOV_FP = 58, FOV_WALK = 66;

// 行走参数:边界 / 座位区阻挡 / 台阶坡(与 hall LAYOUT 坡向一致:前排低后排高)
const WALK = {
  SPEED: 1.9,
  EYE: 1.62,
  BOUND: { x: 5.25, zMin: -7.3, zMax: 4.3 },
  SEATS_BOX: { x: 2.72, zMin: -6.9, zMax: -1.5 },   // 座位区整体阻挡,走两侧过道
  groundY(z) {
    // z-6.9(前排区)→0,z-1.5(后排区)→1.68,线性坡近似台阶
    const k = Math.min(Math.max((z + 6.9) / 5.4, 0), 1);
    return k * 1.68;
  },
};

export class Director {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'AUTO';
    this.seat = null;            // 我的席位号
    this.enabled = true;         // 选座等接管镜头时置 false
    this.t = 0;

    // AUTO 状态:godView 常驻,插队镜头播完自动回位
    this._shot = null;
    this._shotT = 0;

    // FP 状态
    this._yaw = 0; this._pitch = 0;
    this._yawT = 0; this._pitchT = 0;

    // WALK 状态(第一人称走动入场)
    this.walkPos = new THREE.Vector3(0, 0, -7.15);
    this._keys = new Set();
    this._stepAcc = 0;
    this.onStep = null;   // 脚步回调(main 接 sfx)

    // 过渡状态
    this._trans = null;          // {fromPos, fromLook, dur, t}
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3(0, 2, -8);
    this._tmpPos = new THREE.Vector3();
    this._tmpLook = new THREE.Vector3();

    this._forcedPrev = null;

    addEventListener('pointermove', e => {
      // 绝对映射:屏幕位置 → 目标视角(演出版无需 pointer lock)
      // 灵敏度收敛(2026-07-14 用户反馈"过于灵敏"):转角减档,配合更重的阻尼
      const maxYaw = this.mode === 'WALK' ? 110 : 58;
      const maxPitch = this.mode === 'WALK' ? 36 : 30;
      this._yawT = -(e.clientX / innerWidth - 0.5) * 2 * THREE.MathUtils.degToRad(maxYaw);
      this._pitchT = -(e.clientY / innerHeight - 0.5) * 2 * THREE.MathUtils.degToRad(maxPitch);
    });
    addEventListener('keydown', e => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.mode === 'WALK') return;   // 未入座不可切镜头
        if (this.mode === 'AUTO') this.toFP();
        else if (this.mode === 'FP') this.toAuto();
      }
      this._keys.add(e.code);
    });
    addEventListener('keyup', e => this._keys.delete(e.code));
    this._nextShot();
  }

  attachSeat(i) { this.seat = i; }

  // 走动入场:后场中央高台进场(影厅中轴最高点),面向银幕全景走下去
  enterWalk() {
    this.mode = 'WALK';
    this.walkPos.set(0, 0, 3.9);
    this._trans = null;
    this._setVig(false);
    this.onModeChange?.(this.mode);
  }

  // 入座:从站姿平滑滑入座位视角
  sitDown(i) {
    this.attachSeat(i);
    this.mode = 'FP';
    this._beginTransition(1.15);
    this.onModeChange?.(this.mode);
  }

  // 行走位姿(baseYaw=0:后场进场,默认面向银幕 -z)
  _walkPose(dt, pos, look) {
    const yaw = this._yaw, pitch = this._pitch;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    let mx = 0, mz = 0;
    const f = (this._keys.has('KeyW') || this._keys.has('ArrowUp') ? 1 : 0) - (this._keys.has('KeyS') || this._keys.has('ArrowDown') ? 1 : 0);
    const s = (this._keys.has('KeyD') || this._keys.has('ArrowRight') ? 1 : 0) - (this._keys.has('KeyA') || this._keys.has('ArrowLeft') ? 1 : 0);
    if (f || s) {
      // 右向量 = (-fz, fx)(2026-07-14 用户实测 A/D 反向:此前误写为 (fz,-fx))
      const inv = 1 / Math.hypot(f || 0.0001, s || 0.0001);
      mx = (f * fx - s * fz) * inv;
      mz = (f * fz + s * fx) * inv;
      const step = WALK.SPEED * dt;
      this.walkPos.x += mx * step;
      this.walkPos.z += mz * step;
      this._stepAcc += step;
      if (this._stepAcc > 0.62) { this._stepAcc = 0; this.onStep?.(); }
    }
    // 边界
    const B = WALK.BOUND;
    this.walkPos.x = Math.min(Math.max(this.walkPos.x, -B.x), B.x);
    this.walkPos.z = Math.min(Math.max(this.walkPos.z, B.zMin), B.zMax);
    // 座位区阻挡:推出最近边
    const S = WALK.SEATS_BOX, p = this.walkPos;
    if (Math.abs(p.x) < S.x && p.z > S.zMin && p.z < S.zMax) {
      const dx = S.x - Math.abs(p.x);
      const dzMin = p.z - S.zMin, dzMax = S.zMax - p.z;
      const m = Math.min(dx, dzMin, dzMax);
      if (m === dx) p.x = (p.x >= 0 ? 1 : -1) * S.x;
      else if (m === dzMin) p.z = S.zMin;
      else p.z = S.zMax;
    }
    // 台阶坡 + 行走颠簸
    const moving = (f || s) ? 1 : 0;
    const bob = moving * Math.sin(this.t * 9.5) * 0.04;
    pos.set(p.x, WALK.groundY(p.z) + WALK.EYE + bob, p.z);
    look.set(
      pos.x + Math.sin(yaw) * Math.cos(pitch),
      pos.y + Math.sin(pitch),
      pos.z - Math.cos(yaw) * Math.cos(pitch)
    );
  }

  _nextShot(name, opts) {
    const key = name || HOME_SHOT;
    this._shot = SHOTS[key](opts || {});
    this._shotT = 0;
  }

  // acts 请求指定机位(插队,带短过渡)
  requestShot(name, opts) {
    if (this.mode !== 'AUTO') return;
    this._beginTransition(0.7);
    this._nextShot(name, opts);
  }

  toFP() {
    if (this.seat == null) return;
    this.mode = 'FP';
    this._beginTransition(1.2);
    this._setVig(false);
    this.onModeChange?.(this.mode);
  }

  toAuto() {
    this.mode = 'AUTO';
    this._beginTransition(1.2);
    this._setVig(false);
    this._nextShot();
    this.onModeChange?.(this.mode);
  }

  // 轮到你了:黑帧快切 + 收缩视野;resolve 于黑帧结束
  async forceFP() {
    if (this.seat == null || this.mode === 'FORCED') return;
    this._forcedPrev = this.mode;
    this.mode = 'FORCED';
    const bo = document.getElementById('blackout');
    bo.style.opacity = 1;
    await new Promise(r => setTimeout(r, 110));
    this._trans = null;          // 瞬切,无插值
    this._setVig(true);
    bo.style.opacity = 0;
    this.onModeChange?.(this.mode);
  }

  release() {
    if (this.mode !== 'FORCED') return;
    this._setVig(false);
    this.mode = this._forcedPrev === 'FP' ? 'FP' : 'AUTO';
    if (this.mode === 'AUTO') { this._beginTransition(1.4); this._nextShot(); }
    this.onModeChange?.(this.mode);
  }

  _setVig(tight) {
    document.getElementById('vig').classList.toggle('tight', tight);
  }

  _beginTransition(dur) {
    this._trans = {
      fromPos: this.cam.position.clone(),
      fromLook: this._look.clone(),
      dur, t: 0,
    };
  }

  _fpPose(pos, look) {
    seatWorldPos(this.seat, pos);
    pos.x += this.fpLean || 0;   // 选边幕:身体真的向选的那边倾
    pos.y += 0.88;   // 眼高:略高于前排头顶(排差保证后排能越过前排看银幕)
    // 呼吸感微晃
    pos.y += Math.sin(this.t * 1.4) * 0.008;
    pos.x += Math.sin(this.t * 0.9) * 0.004;
    const yaw = this._yaw, pitch = this._pitch;
    look.set(
      pos.x + Math.sin(yaw) * Math.cos(pitch),
      pos.y + Math.sin(pitch),
      pos.z - Math.cos(yaw) * Math.cos(pitch)   // 默认朝银幕(-z)
    );
  }

  update(dt) {
    if (!this.enabled) return;
    this.t += dt;

    // FP 视角阻尼(重阻尼:抵消绝对映射的"甩头"感)
    this._yaw += (this._yawT - this._yaw) * Math.min(dt * 2.6, 1);
    this._pitch += (this._pitchT - this._pitch) * Math.min(dt * 2.6, 1);

    // 目标位姿
    if (this.mode === 'AUTO') {
      this._shotT += dt;
      const k = Math.min(this._shotT / this._shot.dur, 1);
      this._shot.at(k, this._tmpPos, this._tmpLook, this.t);
      if (k >= 1) { this._beginTransition(1.6); this._nextShot(); }  // 插队镜头播完 → 平滑回 godView
    } else if (this.mode === 'WALK') {
      this._walkPose(dt, this._tmpPos, this._tmpLook);
    } else {
      this._fpPose(this._tmpPos, this._tmpLook);
    }

    // FOV 插值
    const fovT = this.mode === 'AUTO' ? FOV_AUTO : this.mode === 'WALK' ? FOV_WALK : FOV_FP;
    this.cam.fov += (fovT - this.cam.fov) * Math.min(dt * 3, 1);
    this.cam.updateProjectionMatrix();

    // 过渡混合
    if (this._trans) {
      this._trans.t += dt;
      const k = Math.min(this._trans.t / this._trans.dur, 1);
      const e = k * k * (3 - 2 * k);
      this._pos.lerpVectors(this._trans.fromPos, this._tmpPos, e);
      this._look.lerpVectors(this._trans.fromLook, this._tmpLook, e);
      if (k >= 1) this._trans = null;
    } else {
      this._pos.copy(this._tmpPos);
      this._look.copy(this._tmpLook);
    }

    this.cam.position.copy(this._pos);
    this.cam.lookAt(this._look);
  }
}
