// 黑雾:厅角常驻低雾 + devour 爆发(环形涌起→螺旋包裹→上飘消散)
// 自定义 Points shader:每粒独立 alpha/size;mist.png 亮度转 alpha,永远呈"暗雾"
import * as THREE from 'three';
import { LAYOUT } from './hall.js';
import { asset } from '../assets.js';

const VERT = /* glsl */`
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
void main(){
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (240.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */`
uniform sampler2D map;
uniform vec3 uColor;
varying float vAlpha;
void main(){
  float a = texture2D(map, gl_PointCoord).a;
  gl_FragColor = vec4(uColor, a * vAlpha);
}
`;

// mist.png → 亮度转 alpha 的暗雾纹理;失败 → 径向渐变兜底
function loadMistTexture(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const S = 256;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, S, S);
      const d = x.getImageData(0, 0, S, S);
      for (let i = 0; i < d.data.length; i += 4) {
        const lum = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
        // 亮度作为浓度,曲线抬高(单粒要够浓,黑厅里靠叠加才能成"雾团")
        d.data[i + 3] = Math.min(d.data[i + 3], lum * 2.6);
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
      }
      // 圆形羽化(PointCoord 是方形域)
      const mask = document.createElement('canvas');
      mask.width = mask.height = S;
      const mx = mask.getContext('2d');
      mx.putImageData(d, 0, 0);
      mx.globalCompositeOperation = 'destination-in';
      const g = mx.createRadialGradient(S / 2, S / 2, S * 0.24, S / 2, S / 2, S * 0.5);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      mx.fillStyle = g;
      mx.fillRect(0, 0, S, S);
      resolve(new THREE.CanvasTexture(mask));
    };
    img.onerror = () => {
      const S = 128;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
      g.addColorStop(0, 'rgba(255,255,255,.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, S, S);
      resolve(new THREE.CanvasTexture(c));
    };
    img.src = url;
  });
}

class Cloud {
  // 一团粒子(常驻或爆发共用):自带 geometry/points
  // 注意:黑雾在黑影厅里零对比 —— 雾色必须显著亮于背景(被银幕光照着的"鬼烟"),
  // 常驻冷烟灰、爆发灰血烟;染太黑 = 不可见(实测踩坑)
  constructor(scene, tex, n, color = 0x36434e) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.data = []; // 每粒自定义状态
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uColor: { value: new THREE.Color(color) } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  flush() {
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

export class Mist {
  constructor(scene, url = asset('art/mist.png')) {
    this.scene = scene;
    this.t = 0;
    this.ready = loadMistTexture(url).then(tex => {
      this.tex = tex;
      this._buildAmbient();
      this.burstCloud = new Cloud(scene, tex, 240, 0x6a4550);
      this.burstCloud.alpha.fill(0);
      this.burstCloud.flush();
      this._bursts = [];
    });
  }

  // 常驻:两厅角 + 银幕下沿,低矮翻涌
  _buildAmbient() {
    const anchors = [
      [-5.2, 0.25, 4.2, 26], [5.2, 0.25, 4.2, 26],
      [0, 0.2, LAYOUT.SCREEN_Z + 1.2, 40],
    ];
    this.ambient = [];
    for (const [ax, ay, az, n] of anchors) {
      const c = new Cloud(this.scene, this.tex, n);
      for (let i = 0; i < n; i++) {
        const spread = az > 0 ? 1.6 : 3.6;
        c.data.push({
          ox: ax + (Math.random() - 0.5) * spread * 2,
          oy: ay + Math.random() * 0.3,
          oz: az + (Math.random() - 0.5) * 1.4,
          ph: Math.random() * Math.PI * 2,
          sp: 0.15 + Math.random() * 0.25,
        });
        c.size[i] = 1.8 + Math.random() * 1.6;
        c.alpha[i] = 0.10 + Math.random() * 0.10;
      }
      c.flush();
      this.ambient.push(c);
    }
  }

  // 爆发:环形涌起 → 螺旋收拢包裹(0.9s resolve)→ 上飘消散(2.2s 清空)
  burst(worldPos) {
    if (!this.burstCloud) return Promise.resolve();
    const N = 80;
    const c = this.burstCloud;
    const slots = [];
    for (let i = 0; i < c.n && slots.length < N; i++) if (c.alpha[i] <= 0.001) slots.push(i);
    const t0 = this.t;
    for (let k = 0; k < slots.length; k++) {
      const i = slots[k];
      const ang = (k / N) * Math.PI * 2 + Math.random() * 0.5;
      const r = 0.45 + Math.random() * 0.25;
      c.data[i] = {
        burst: true, t0,
        cx: worldPos.x, cy: worldPos.y - 0.35, cz: worldPos.z,
        ang, r, riseH: 1.3 + Math.random() * 0.5,
        spin: 2.2 + Math.random() * 1.4,
        seed: Math.random(),
      };
      c.pos[i * 3] = worldPos.x + Math.cos(ang) * r;
      c.pos[i * 3 + 1] = worldPos.y - 0.35;
      c.pos[i * 3 + 2] = worldPos.z + Math.sin(ang) * r;
      c.size[i] = 1.4 + Math.random() * 1.1;
      c.alpha[i] = 0;
    }
    c.flush();
    this._bursts.push({ t0, slots });
    return new Promise(res => setTimeout(res, 900));
  }

  update(dt) {
    this.t += dt;
    if (this.ambient) {
      for (const c of this.ambient) {
        for (let i = 0; i < c.n; i++) {
          const d = c.data[i];
          c.pos[i * 3] = d.ox + Math.sin(this.t * d.sp + d.ph) * 0.5;
          c.pos[i * 3 + 1] = d.oy + Math.sin(this.t * d.sp * 0.7 + d.ph * 2) * 0.12;
          c.pos[i * 3 + 2] = d.oz + Math.cos(this.t * d.sp * 0.8 + d.ph) * 0.35;
        }
        c.flush();
      }
    }
    if (this.burstCloud && this._bursts?.length) {
      const c = this.burstCloud;
      for (const b of this._bursts) {
        const e = this.t - b.t0;
        for (const i of b.slots) {
          const d = c.data[i];
          if (!d?.burst) continue;
          if (e < 0.9) {
            // 涌起 + 螺旋收拢
            const k = e / 0.9;
            const r = d.r * (1 - k * 0.75);
            const ang = d.ang + k * d.spin;
            c.pos[i * 3] = d.cx + Math.cos(ang) * r;
            c.pos[i * 3 + 1] = d.cy + k * d.riseH;
            c.pos[i * 3 + 2] = d.cz + Math.sin(ang) * r;
            c.alpha[i] = Math.min(k * 2.4, 1) * 0.9;
            c.size[i] = 1.4 + k * 2.0 + d.seed * 0.6;
          } else if (e < 2.2) {
            // 上飘消散
            const k = (e - 0.9) / 1.3;
            c.pos[i * 3 + 1] += dt * 0.5;
            c.pos[i * 3] += Math.sin(this.t * 1.3 + d.seed * 9) * dt * 0.3;
            c.alpha[i] = 0.85 * (1 - k);
            c.size[i] += dt * 1.2;
          } else {
            c.alpha[i] = 0;
            d.burst = false;
          }
        }
      }
      this._bursts = this._bursts.filter(b => this.t - b.t0 < 2.4);
      c.flush();
    }
  }
}
