// 皮影纸偶:炭黑面片(头+双臂+铆钉)+ 衣色躯干片 + 头顶编号
// 只绕 Y 轴面向镜头(保持直立);吊线轻晃 + 关节次级摆动 + 呼吸
import * as THREE from 'three';
import { CLOTH_HEX } from '../data/films.js';
import { mergeGeoms } from '../theater/hall.js';

// ---- 共享几何 / 材质(模块级一次构建) ----

function roundedPlate(w, h, r, seg = 6) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, seg);
}

// 炭黑合并件:头 + 双臂 + 肩铆钉 ×2(坐姿,锚点=座面中心)
function darkGeometry() {
  const parts = [];
  const head = new THREE.CircleGeometry(0.155, 24);
  head.translate(0, 0.74, 0.012);
  parts.push(head);
  for (const s of [-1, 1]) {
    const arm = roundedPlate(0.085, 0.4, 0.04);
    arm.rotateZ(s * 0.16);
    arm.translate(s * 0.245, 0.31, -0.008);
    parts.push(arm);
    const rivet = new THREE.CircleGeometry(0.024, 10);
    rivet.translate(s * 0.185, 0.5, 0.02);
    parts.push(rivet);
  }
  return mergeGeoms(parts);
}

// 背光 rim(theater 2D 描边的 3D 等效):头顶弧形亮边 + 双肩短弧,
// 只勾上缘 —— 银幕光从前方漫过头肩的观感,不做整圈"光环"
function haloGeometry() {
  const parts = [];
  const headArc = new THREE.RingGeometry(0.152, 0.176, 28, 1, Math.PI * 0.12, Math.PI * 0.76);
  headArc.translate(0, 0.74, 0.02);
  parts.push(headArc);
  for (const s of [-1, 1]) {
    const shoulder = new THREE.RingGeometry(0.2, 0.222, 16, 1,
      s > 0 ? Math.PI * 0.06 : Math.PI * 0.62, Math.PI * 0.32);
    shoulder.translate(s * 0.06, 0.4, 0.018);
    parts.push(shoulder);
  }
  return mergeGeoms(parts);
}

const GEO = {
  dark: null, torso: null, shadow: null, num: null, halo: null,
  init() {
    if (this.dark) return;
    this.dark = darkGeometry();
    this.torso = roundedPlate(0.42, 0.56, 0.1);
    this.torso.translate(0, 0.33, 0);
    this.shadow = new THREE.CircleGeometry(0.3, 18);
    this.num = new THREE.PlaneGeometry(0.2, 0.2);
    this.halo = haloGeometry();
  },
};

const darkMat = new THREE.MeshStandardMaterial({
  color: 0x23232e, roughness: 0.85, side: THREE.DoubleSide,
  emissive: 0x141a22, emissiveIntensity: 0.85,
});
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false,
});
// 全偶共享的背光 rim 材质(加色混合:黑底上呈亮边)
const haloMat = new THREE.MeshBasicMaterial({
  color: 0x4a5e66, transparent: true, opacity: 0.62,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});

// 主角轮廓光:完整放大剪影背板(金色,呼吸脉动)—— 上帝视角一眼锁定"你"
function heroGeometry() {
  const parts = [];
  const head = new THREE.CircleGeometry(0.19, 26);
  head.translate(0, 0.74, -0.03);
  parts.push(head);
  const body = roundedPlate(0.5, 0.66, 0.13);
  body.translate(0, 0.34, -0.036);
  parts.push(body);
  return mergeGeoms(parts);
}
let heroGeo = null;

// 编号 atlas:1..30 排 6×5(所有编号面片共享一张纹理)
let numAtlas = null;
function getNumAtlas() {
  if (numAtlas) return numAtlas;
  const c = document.createElement('canvas');
  c.width = 768; c.height = 640;   // 6 列 ×128, 5 行 ×128
  const x = c.getContext('2d');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let n = 1; n <= 30; n++) {
    const cx = ((n - 1) % 6) * 128 + 64, cy = Math.floor((n - 1) / 6) * 128 + 64;
    x.font = '700 64px Consolas,monospace';
    x.shadowColor = 'rgba(184,67,58,.95)'; x.shadowBlur = 18;
    x.fillStyle = '#c8524a';
    x.fillText(String(n).padStart(2, '0'), cx, cy);
  }
  numAtlas = new THREE.CanvasTexture(c);
  numAtlas.colorSpace = THREE.SRGBColorSpace;
  return numAtlas;
}

export class Puppet {
  constructor(seatPos, seatIdx) {
    GEO.init();
    this.seatIdx = seatIdx;
    this.alive = true;
    this.color = '红';
    this.num = 0;
    this.prime = false;
    this.phase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.group.position.copy(seatPos);

    this.dark = new THREE.Mesh(GEO.dark, darkMat);
    this.halo = new THREE.Mesh(GEO.halo, haloMat);
    this.torsoMat = new THREE.MeshStandardMaterial({
      color: 0x6b2226, roughness: 0.9, side: THREE.DoubleSide,
      emissive: 0x6b2226, emissiveIntensity: 0.34,
    });
    this.torso = new THREE.Mesh(GEO.torso, this.torsoMat);
    this.torso.position.z = 0.004;

    this.shadow = new THREE.Mesh(GEO.shadow, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.shadow.scale.set(1, 0.7, 1);

    this.numMesh = null;   // setNum 时创建(需要 UV 指格)
    this.heroMesh = null;  // setHero 时创建(主角轮廓光)

    this.group.add(this.dark, this.halo, this.torso, this.shadow);

    // 演出状态
    this._mark = false;
    this._stand = 0;       // 0/1 目标
    this._lean = 0;        // -1/0/1
    this._shiverT = 0;
    this._sideX = 0;       // split 倾身偏移目标
    this._baseY = seatPos.y;
    this._dead = false;
  }

  setColor(c) {
    this.color = c;
    const hex = CLOTH_HEX[c] ?? 0x333333;
    this.torsoMat.color.setHex(hex);
    if (!this._mark) { this.torsoMat.emissive.setHex(hex); this.torsoMat.emissiveIntensity = 0.22; }
  }

  setNum(n) {
    this.num = n;
    this.prime = (m => { if (m < 2) return false; for (let i = 2; i * i <= m; i++) if (m % i === 0) return false; return true; })(n);
    if (!this.numMesh) {
      const g = GEO.num.clone();
      const col = (n - 1) % 6, row = Math.floor((n - 1) / 6);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (col + uv.getX(i)) / 6, 1 - (row + (1 - uv.getY(i))) / 5);
      }
      this.numMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        map: getNumAtlas(), transparent: true, depthWrite: false, opacity: 0.5,
      }));
      this.numMesh.position.y = 1.06;
      this.group.add(this.numMesh);
    }
  }

  setMark(on) {
    this._mark = on;
    if (on) { this.torsoMat.emissive.setHex(0xb8433a); }
    else { this.torsoMat.emissive.setHex(CLOTH_HEX[this.color] ?? 0x333333); this.torsoMat.emissiveIntensity = 0.34; }
  }

  // 主角标识:金色轮廓光背板(呼吸脉动)
  setHero(on) {
    if (on && !this.heroMesh) {
      if (!heroGeo) heroGeo = heroGeometry();
      this.heroMesh = new THREE.Mesh(heroGeo, new THREE.MeshBasicMaterial({
        color: 0xc8a44a, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      this.group.add(this.heroMesh);
    }
    if (this.heroMesh) this.heroMesh.visible = on;
    this._hero = on;
  }
  shiver(dur = 1.0) { this._shiverT = dur; }
  stand(on) { this._stand = on ? 1 : 0; }
  lean(on, dir = 1) { this._lean = on ? dir : 0; }
  sideShift(dir) { this._sideX = dir; }  // -1 左 / 0 回正 / 1 右

  // 死亡:黑雾包裹后被拽入地下(整偶下坠旋转缩小消隐)
  devour() {
    if (this._dead) return Promise.resolve();
    this._dead = true; this.alive = false;
    this.setMark(false);
    return new Promise(res => {
      const dur = 1.1, t0 = performance.now();
      this.torsoMat.transparent = true;
      const dm = this.dark.material = darkMat.clone();
      dm.transparent = true;
      const step = () => {
        const t = Math.min((performance.now() - t0) / 1000 / dur, 1);
        const k = t * t;
        this.group.position.y = this._baseY - k * 1.5;
        this.group.rotation.z = k * 4.2 * (this.seatIdx % 2 ? 1 : -1);
        this.group.scale.setScalar(1 - k * 0.72);
        this.torsoMat.opacity = dm.opacity = 1 - t;
        if (this.numMesh) this.numMesh.material.opacity = (1 - t) * 0.8;
        this.shadow.material = shadowMat;
        if (t < 1) requestAnimationFrame(step);
        else { this.group.visible = false; res(); }
      };
      step();
    });
  }

  update(dt, t, camPos) {
    if (!this.group.visible) return;
    const g = this.group;

    // 仅绕 Y 轴面向镜头(billboard 直立)
    g.rotation.y = Math.atan2(camPos.x - g.position.x, camPos.z - g.position.z);

    if (this._dead) return;

    // 吊线轻晃 + lean 叠加
    const sway = Math.sin(t * 0.7 + this.phase) * 0.035;
    g.rotation.z = sway + this._lean * 0.3;

    // 呼吸
    const br = 1 + Math.sin(t * 1.3 + this.phase) * 0.012;
    this.torso.scale.y = br;

    // 臂次级摆动由合并几何放弃,肩部随躯干即可;头随晃动自然
    // 起立(被线提起)
    const targetY = this._baseY + this._stand * 0.42;
    g.position.y += (targetY - g.position.y) * Math.min(dt * 5, 1);

    // split 倾身
    const targetX = this._sideX * 0.34;
    g.position.x += (this.baseX ?? (this.baseX = g.position.x), (this.baseX + targetX) - g.position.x) * Math.min(dt * 6, 1);

    // shiver 高频抖
    if (this._shiverT > 0) {
      this._shiverT -= dt;
      g.position.x += Math.sin(t * 90 + this.phase) * 0.02;
    }

    // mark 红光脉动
    if (this._mark) {
      this.torsoMat.emissiveIntensity = 0.55 + 0.4 * Math.sin(t * 6);
    }

    // 主角轮廓光呼吸
    if (this._hero && this.heroMesh?.visible) {
      this.heroMesh.material.opacity = 0.4 + 0.18 * Math.sin(t * 2.2);
    }

    // 编号:轻浮动 + 近距离淡出(FP 怼脸时不糊屏)
    if (this.numMesh) {
      this.numMesh.position.y = 1.06 + Math.sin(t * 1.1 + this.phase) * 0.02;
      const d2 = camPos.distanceTo(g.position);
      this.numMesh.material.opacity = 0.5 * THREE.MathUtils.clamp((d2 - 1.2) / 1.8, 0, 1);
    }
  }
}
