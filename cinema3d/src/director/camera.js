// 三态镜头导演:AUTO(轨道运镜)/ FP(我的座位第一人称)/ FORCED(轮到你了)
import * as THREE from 'three';
import { SHOTS, HOME_SHOT } from './shots.js';
import { seatWorldPos } from '../theater/hall.js';

const FOV_AUTO = 40, FOV_FP = 65;

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

    // 过渡状态
    this._trans = null;          // {fromPos, fromLook, dur, t}
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3(0, 2, -8);
    this._tmpPos = new THREE.Vector3();
    this._tmpLook = new THREE.Vector3();

    this._forcedPrev = null;

    addEventListener('pointermove', e => {
      // 绝对映射:屏幕位置 → 目标视角(演出版无需 pointer lock)
      this._yawT = -(e.clientX / innerWidth - 0.5) * 2 * THREE.MathUtils.degToRad(75);
      this._pitchT = -(e.clientY / innerHeight - 0.5) * 2 * THREE.MathUtils.degToRad(35);
    });
    addEventListener('keydown', e => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.mode === 'AUTO') this.toFP();
        else if (this.mode === 'FP') this.toAuto();
      }
    });
    this._nextShot();
  }

  attachSeat(i) { this.seat = i; }

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
  }

  toAuto() {
    this.mode = 'AUTO';
    this._beginTransition(1.2);
    this._setVig(false);
    this._nextShot();
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
  }

  release() {
    if (this.mode !== 'FORCED') return;
    this._setVig(false);
    this.mode = this._forcedPrev === 'FP' ? 'FP' : 'AUTO';
    if (this.mode === 'AUTO') { this._beginTransition(1.4); this._nextShot(); }
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
    pos.y += 0.88;   // 眼高:略高于前排头顶(排差 0.18 保证后排能越过前排看银幕)
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

    // FP 视角阻尼
    this._yaw += (this._yawT - this._yaw) * Math.min(dt * 4, 1);
    this._pitch += (this._pitchT - this._pitch) * Math.min(dt * 4, 1);

    // 目标位姿
    if (this.mode === 'AUTO') {
      this._shotT += dt;
      const k = Math.min(this._shotT / this._shot.dur, 1);
      this._shot.at(k, this._tmpPos, this._tmpLook, this.t);
      if (k >= 1) { this._beginTransition(1.6); this._nextShot(); }  // 插队镜头播完 → 平滑回 godView
    } else {
      this._fpPose(this._tmpPos, this._tmpLook);
    }

    // FOV 插值
    const fovT = this.mode === 'AUTO' ? FOV_AUTO : FOV_FP;
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
