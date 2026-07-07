// 银幕:投影(羽化/扫描线/噪点/闪帧)+ 血字 + 平均色采样(供全厅灯光联动)
import * as THREE from 'three';
import { LAYOUT } from './hall.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const FRAG = /* glsl */`
uniform sampler2D map;
uniform float uOpacity;    // 淡入淡出
uniform float uTime;
uniform float uFlick;      // 闪帧脉冲(0 常态)
uniform float uBoost;      // 亮度倍率
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }

void main(){
  // 轻微桶形颤动:老放映机的不稳
  vec2 uv = vUv + vec2(sin(uTime*13.0 + vUv.y*40.0)*0.0008, 0.0);
  vec3 col = texture2D(map, uv).rgb;

  // 扫描线 + 帧噪点
  col *= 1.0 - 0.05 * (0.5 + 0.5 * sin(uv.y * 720.0));
  col += (hash(uv * vec2(uTime*60.0, uTime*47.0)) - 0.5) * 0.055;

  // 闪帧:亮暗阶跃
  col *= 1.0 + uFlick * (step(0.5, fract(uTime*14.0)) * 2.2 - 0.8);

  // 椭圆羽化融入暗场(spec:不出现硬边框)
  float d = length((vUv - 0.5) * vec2(2.15, 2.35));
  float mask = smoothstep(1.05, 0.55, d);

  // 放映底光:即使画面全黑,银幕仍像被灯泡透着(发光体感)
  col = col * uBoost + vec3(0.045, 0.05, 0.048);
  gl_FragColor = vec4(col * mask * uOpacity, 1.0);
}
`;

// 素材缺失兜底:程序化噪点纹理(演出不中断)
function noiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 14 + Math.random() * 38;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 4; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Screen {
  constructor(scene, screenMesh) {
    this.scene = scene;
    this.mesh = screenMesh;
    this.uniforms = {
      map: { value: noiseTexture() },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uFlick: { value: 0 },
      uBoost: { value: 1.0 },
    };
    this.mesh.material.dispose();
    this.mesh.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
    });
    this.avgColor = new THREE.Color(0x30343a);
    this._loader = new THREE.TextureLoader();
    this._fade = { from: 0, to: 0, t: 1, dur: 1 };

    this._shadow = null;   // 皮影戏接管时非空

    // 血字面片(银幕下沿,canvas 纹理,支持两行)
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 320;
    this._txtCanvas = c;
    this._txtTex = new THREE.CanvasTexture(c);
    this._txtTex.colorSpace = THREE.SRGBColorSpace;
    this._txtMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 7.2 * 320 / 1024),
      new THREE.MeshBasicMaterial({ map: this._txtTex, transparent: true, opacity: 0, depthWrite: false })
    );
    this._txtMesh.position.set(0, LAYOUT.SCREEN_Y - 0.95, LAYOUT.SCREEN_Z + 0.06);
    scene.add(this._txtMesh);
  }

  // 展示一张投影图;加载失败自动落噪点兜底(resolve false)
  show(url, { fade = 1.6, boost = 1.75 } = {}) {
    return new Promise(resolve => {
      this._loader.load(
        url,
        tex => {
          tex.colorSpace = THREE.SRGBColorSpace;
          this.uniforms.map.value = tex;
          this.uniforms.uBoost.value = boost;
          this._sampleAvg(tex);
          this._fadeTo(0.96, fade);
          this.flick();
          resolve(true);
        },
        undefined,
        () => {
          console.warn('[银幕] 投影图加载失败,走噪点兜底:', url);
          this.uniforms.map.value = noiseTexture();
          this.avgColor.set(0x3a4044);
          this._fadeTo(0.55, fade);
          resolve(false);
        }
      );
    });
  }

  hide(fade = 1.2) { this._fadeTo(0, fade); }

  // 老放映机闪帧(theater flick 移植)
  flick(ms = 480) {
    this.uniforms.uFlick.value = 1;
    setTimeout(() => { this.uniforms.uFlick.value = 0; }, ms);
  }

  // 银幕血字(楷体,自适应字号,最多两行)
  bloodText(text) {
    const x = this._txtCanvas.getContext('2d');
    x.clearRect(0, 0, 1024, 320);
    // 拆两行:超 12 字在标点或中点断行
    let lines = [text];
    if (text.length > 12) {
      let cut = -1;
      for (let i = Math.min(text.length - 2, 16); i >= 6; i--)
        if ('。,,、?…'.includes(text[i])) { cut = i + 1; break; }
      if (cut < 0) cut = Math.ceil(text.length / 2);
      lines = [text.slice(0, cut), text.slice(cut)];
    }
    const size = Math.min(88, Math.floor(940 / Math.max(...lines.map(l => l.length))));
    x.font = `700 ${size}px "KaiTi","STKaiti","楷体",serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(180,31,23,.9)'; x.shadowBlur = 26;
    x.fillStyle = '#c8291e';
    const lh = size * 1.35, y0 = 160 - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => x.fillText(l, 512, y0 + i * lh));
    this._txtTex.needsUpdate = true;
    this._txtMesh.material.opacity = 0;
    this._txtShow = true;
  }

  // 皮影戏接管银幕(序章剧情)
  startShadow(show) {
    this._shadow = show;
    this.uniforms.map.value = show.texture;
    this.uniforms.uBoost.value = 1.0;
    this.avgColor.set(0x74807c);
    this._fadeTo(0.95, 1.2);
  }
  stopShadow() { this._shadow = null; }

  clearText() { this._txtShow = false; }

  _fadeTo(to, dur) {
    this._fade = { from: this.uniforms.uOpacity.value, to, t: 0, dur: Math.max(dur, 0.01) };
  }

  // 8×8 平均色(供 Lights 联动全厅色调)
  _sampleAvg(tex) {
    try {
      const img = tex.image;
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, 8, 8);
      const d = x.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      // 提亮避免整厅死黑:平均色向明度 0.5 拉一点
      const col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
      const hsl = {};
      col.getHSL(hsl);
      col.setHSL(hsl.h, Math.min(hsl.s * 1.25, 1), Math.max(hsl.l, 0.42));
      this.avgColor.copy(col);
    } catch { this.avgColor.set(0x8a9490); }
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
    if (this._shadow) this._shadow.update(dt);
    if (this._fade.t < 1) {
      this._fade.t = Math.min(this._fade.t + dt / this._fade.dur, 1);
      const k = this._fade.t * this._fade.t * (3 - 2 * this._fade.t);
      this.uniforms.uOpacity.value = this._fade.from + (this._fade.to - this._fade.from) * k;
    }
    // 血字淡入淡出
    const m = this._txtMesh.material;
    m.opacity += ((this._txtShow ? 0.92 : 0) - m.opacity) * Math.min(dt * 2.2, 1);
  }
}
