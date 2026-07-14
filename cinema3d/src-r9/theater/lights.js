// 灯光系统:银幕 RectAreaLight(全场唯一主光源,随投影色联动)/ 壁灯闪烁 / 扫光 / 血光 / 熄灯
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { LAYOUT } from './hall.js';

let ltcReady = false;

export class Lights {
  constructor(scene) {
    if (!ltcReady) { RectAreaLightUniformsLib.init(); ltcReady = true; }
    this.scene = scene;
    this.t = 0;
    this.dimV = 1;          // 全局明暗倍率(演出 dim)
    this.blackoutV = 1;     // 熄灯倍率(0=全黑)

    // 环境微光:让暗部不死黑
    this.ambient = new THREE.AmbientLight(0x141820, 0.4);
    scene.add(this.ambient);

    // 银幕主光:RectAreaLight 贴银幕朝观众席
    const L = LAYOUT;
    this.screenLight = new THREE.RectAreaLight(0xcfd8d0, 5.5, L.SCREEN_W, L.SCREEN_H);
    this.screenLight.position.set(0, L.SCREEN_Y, L.SCREEN_Z + 0.05);
    this.screenLight.lookAt(0, L.SCREEN_Y - 0.6, 4);
    scene.add(this.screenLight);
    this._screenBase = 5.5;
    this._screenColor = new THREE.Color(0xcfd8d0);
    this._screenColorTarget = new THREE.Color(0xcfd8d0);

    // 银幕补光(RectAreaLight 不照 InstancedMesh 的 Lambert 面也够;补一个弱 point 提层次)
    this.screenFill = new THREE.PointLight(0xbcc8c0, 10, 14, 2);
    this.screenFill.position.set(0, L.SCREEN_Y + 0.4, L.SCREEN_Z + 2.2);
    scene.add(this.screenFill);
    this._fillBase = 10;

    // 壁灯 ×6(闪烁)
    this.lamps = LAYOUT.WALL_LAMPS.map(([x, y, z], i) => {
      const p = new THREE.PointLight(0x8a6a2a, 4.5, 6.5, 2);
      p.position.set(x, y - 0.05, z);
      p.userData.phase = i * 1.7 + Math.random() * 2;
      p.userData.base = 4.5;
      scene.add(p);
      return p;
    });

    // 演出灯:扫光(点名)与血光(死亡),常驻但强度 0
    this.spot = new THREE.SpotLight(0xd8d2c0, 0, 16, 0.32, 0.45, 1.6);
    this.spot.position.set(0, 6.2, L.SCREEN_Z + 1.5);
    this.spotTarget = new THREE.Object3D();
    scene.add(this.spotTarget);
    this.spot.target = this.spotTarget;
    scene.add(this.spot);

    this.blood = new THREE.PointLight(0xb8433a, 0, 4.5, 2);
    scene.add(this.blood);
  }

  // 每帧:壁灯闪烁 + 银幕光色插值 + 倍率合成
  update(dt, screenColor) {
    this.t += dt;
    if (screenColor) this._screenColorTarget.copy(screenColor);
    this._screenColor.lerp(this._screenColorTarget, Math.min(dt * 1.5, 1));
    this.screenLight.color.copy(this._screenColor);
    this.screenFill.color.copy(this._screenColor);

    const k = this.dimV * this.blackoutV;
    this.screenLight.intensity = this._screenBase * k;
    this.screenFill.intensity = this._fillBase * k;
    this.ambient.intensity = 0.4 * Math.max(k, 0.15);

    for (const p of this.lamps) {
      const n = Math.sin(this.t * 7.3 + p.userData.phase) * Math.sin(this.t * 2.1 + p.userData.phase * 2.7);
      const flick = 0.86 + 0.14 * n;
      p.intensity = p.userData.base * flick * k;
    }
  }

  // 演出 dim(theater 的 dim() 对应)
  dim(v) { this.dimV = v; }

  // 熄灯 ms 毫秒后恢复(motif 骤暗)
  blackout(ms = 500) {
    this.blackoutV = 0.04;
    return new Promise(res => setTimeout(() => { this.blackoutV = 1; res(); }, ms));
  }

  // 扫光:从银幕上方扫到目标位置并停住 hold 毫秒
  async sweepTo(pos, hold = 900) {
    const from = new THREE.Vector3(0, 1.2, LAYOUT.SCREEN_Z + 3);
    this.spotTarget.position.copy(from);
    this.spot.intensity = 260;
    const dur = 700, t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        const t = Math.min((performance.now() - t0) / dur, 1);
        this.spotTarget.position.lerpVectors(from, pos, t * t * (3 - 2 * t));
        t < 1 ? requestAnimationFrame(step) : res();
      };
      step();
    });
    await new Promise(r => setTimeout(r, hold));
    this.spot.intensity = 0;
  }

  // 血光:死亡席位短亮
  deathLight(pos, ms = 1100) {
    this.blood.position.set(pos.x, pos.y + 0.9, pos.z);
    this.blood.distance = 3.2;
    this.blood.intensity = 38;
    setTimeout(() => { this.blood.intensity = 0; }, ms);
  }
}
