// 银幕皮影戏:序章剧情的程序化剪影动画(canvas → 银幕纹理)
// 开场拉幕(幕布用本场真实颜色 —— 终幕记忆考点的视觉呈现)→ 逐句场景推进 + 银幕内逐字文字
import * as THREE from 'three';

const W = 1024, H = 576;
const PAPER = '#d8cdb6';
const INK = '#05070a';

const CURTAIN_RGB = { 红: '#7e1a15', 紫: '#4a2a66', 黑: '#16161c' };

export class ShadowShow {
  constructor(film, curtain) {
    this.film = film;
    this.curtain = curtain;             // {label, c}
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.x = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.t = 0;
    this.phase = 'curtain';             // curtain → story
    this.phaseT = 0;
    this.line = -1;
    this.lineT = 0;
    this.lineText = '';
    this.shownChars = 0;
    this.caption = '';
    // 场景状态(无声疗养院)
    this.lampsOn = 3;
    this.bedOccupied = [true, true, true, true, true];
    this.nurseX = 1.15;                 // 归一化 x(>1 = 画面外右侧)
    this.nurseSit = 0;                  // 0 站 → 1 坐
    this.fadeSan = 0;                   // 疗养院 → 影院 过渡
    this.snow = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.7 }));
  }

  // 推进到第 i 句(runner 每句调用一次)
  setLine(i, text) {
    this.phase = 'story';
    this.line = i;
    this.lineT = 0;
    this.lineText = text;
    this.shownChars = 0;
  }

  update(dt) {
    this.t += dt;
    this.phaseT += dt;
    this.lineT += dt;
    this.shownChars = Math.min(this.lineText.length, Math.floor(this.lineT / 0.09));

    // 场景状态推进
    if (this.phase === 'story') {
      if (this.line >= 1) this.lampsOn = Math.max(1, 3 - Math.floor(this.lineT / 0.9) - (this.line > 1 ? 2 : 0));
      if (this.line >= 2) { this.bedOccupied[0] = false; this.bedOccupied[2] = false; }
      if (this.line === 3) {
        this.nurseX = Math.max(0.62, this.nurseX - dt * 0.11);
        if (this.nurseX <= 0.625) this.nurseSit = Math.min(1, this.nurseSit + dt * 0.7);
        if (this.nurseSit > 0.8) this.bedOccupied[3] = false;
      }
      if (this.line >= 4) {
        this.fadeSan = Math.min(1, this.fadeSan + dt * 0.5);
        this.lampsOn = 0;
      }
    }
    this.draw();
    this.texture.needsUpdate = true;
  }

  draw() {
    const x = this.x;
    // 纸底
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#101518'); g.addColorStop(0.6, '#0a0e10'); g.addColorStop(1, '#060809');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // 纸纹噪点(低频)
    x.globalAlpha = 0.05;
    for (let i = 0; i < 40; i++) {
      x.fillStyle = i % 2 ? '#fff' : '#000';
      x.fillRect((i * 137 + this.t * 20) % W, (i * 89) % H, 2, 2);
    }
    x.globalAlpha = 1;

    if (this.phase === 'curtain') this.drawCurtain();
    else this.drawStory();

    // 银幕内文字(下部,楷体逐字)
    if (this.phase === 'story' && this.lineText) {
      x.font = '600 34px "KaiTi","STKaiti","楷体",serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 8;
      x.fillStyle = PAPER;
      x.fillText(this.lineText.slice(0, this.shownChars), W / 2, H - 44);
      x.shadowBlur = 0;
    }
  }

  // 开场:两片幕布(本场真实颜色)缓缓拉开,中缝透光;血字提示"记住它"
  drawCurtain() {
    const x = this.x;
    const k = Math.min(this.phaseT / 2.6, 1);
    const e = k * k * (3 - 2 * k);
    const open = e * W * 0.46;
    const col = CURTAIN_RGB[this.curtain.c] || '#7e1a15';
    // 中缝亮光
    const lg = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 320);
    lg.addColorStop(0, 'rgba(216,205,182,.5)'); lg.addColorStop(1, 'rgba(216,205,182,0)');
    x.fillStyle = lg;
    x.fillRect(0, 0, W, H);
    // 两片幕布(波浪垂坠)
    x.fillStyle = col;
    for (const side of [-1, 1]) {
      x.save();
      x.translate(W / 2 + side * open, 0);
      x.beginPath();
      x.moveTo(0, 0);
      for (let yy = 0; yy <= H; yy += 24) {
        const wob = Math.sin(yy * 0.045 + this.t * 1.6 + side) * 7;
        x.lineTo(side * -wob, yy);
      }
      x.lineTo(side * -W / 2 - side * 40, H);
      x.lineTo(side * -W / 2 - side * 40, 0);
      x.closePath();
      x.fill();
      // 布褶
      x.strokeStyle = 'rgba(0,0,0,.35)';
      x.lineWidth = 3;
      for (let i = 1; i <= 5; i++) {
        const fx = side * -i * 56;
        x.beginPath();
        x.moveTo(fx, 0);
        x.quadraticCurveTo(fx + Math.sin(this.t + i) * 6, H / 2, fx, H);
        x.stroke();
      }
      x.restore();
    }
    // 血字提示
    if (k > 0.55) {
      x.globalAlpha = Math.min((k - 0.55) / 0.3, 1);
      x.font = '700 46px "KaiTi","STKaiti","楷体",serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(180,31,23,.9)'; x.shadowBlur = 22;
      x.fillStyle = '#c8291e';
      x.fillText(`幕布,是${this.curtain.label}的。记住它。`, W / 2, H - 60);
      x.shadowBlur = 0;
      x.globalAlpha = 1;
    }
  }

  // 疗养院皮影场景
  drawStory() {
    const x = this.x;
    const sanAlpha = 1 - this.fadeSan;
    const floorY = 452;

    if (sanAlpha > 0) {
      x.save();
      x.globalAlpha = sanAlpha;
      x.translate(0, this.fadeSan * 60);

      // 月光窗柱
      x.save();
      x.globalAlpha = sanAlpha * (this.lampsOn <= 1 ? 0.12 : 0.06);
      x.fillStyle = '#9fb6b2';
      x.beginPath();
      x.moveTo(800, 40); x.lineTo(930, 40); x.lineTo(860, floorY); x.lineTo(730, floorY);
      x.closePath(); x.fill();
      // 雪点
      x.fillStyle = '#cfd8d0';
      for (const s of this.snow) {
        const sy = (s.y + this.t * 0.03 * s.s) % 1;
        x.globalAlpha = sanAlpha * 0.25 * s.s;
        x.fillRect(760 + s.x * 150 - sy * 60, 50 + sy * (floorY - 60), 2.2, 2.2);
      }
      x.restore();

      // 地板线
      x.strokeStyle = 'rgba(216,205,182,.14)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, floorY); x.lineTo(W, floorY); x.stroke();

      // 吊灯 ×3
      for (let i = 0; i < 3; i++) {
        const lx = 220 + i * 280, ly = 96;
        x.strokeStyle = INK; x.lineWidth = 3;
        x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx, ly); x.stroke();
        x.fillStyle = INK;
        x.beginPath();
        x.moveTo(lx - 30, ly + 26); x.lineTo(lx + 30, ly + 26); x.lineTo(lx + 16, ly); x.lineTo(lx - 16, ly);
        x.closePath(); x.fill();
        if (i < this.lampsOn) {
          const gl = x.createRadialGradient(lx, ly + 34, 4, lx, ly + 34, 90);
          gl.addColorStop(0, 'rgba(216,196,150,.30)'); gl.addColorStop(1, 'rgba(216,196,150,0)');
          x.fillStyle = gl;
          x.beginPath(); x.arc(lx, ly + 34, 90, 0, 7); x.fill();
        }
      }

      // 病床 ×5(床头板 + 床体 + 枕头 + 被下人形)
      for (let i = 0; i < 5; i++) {
        const bx = 90 + i * 185, by = floorY;
        x.fillStyle = INK;
        x.fillRect(bx - 8, by - 104, 10, 104);              // 床头板
        x.fillRect(bx, by - 46, 140, 46);                   // 床体
        x.fillRect(bx + 136, by - 62, 6, 62);               // 床尾栏
        if (this.bedOccupied[i]) {
          x.beginPath();                                     // 枕头人头
          x.arc(bx + 26, by - 56, 12, 0, 7);
          x.fill();
          x.beginPath();                                     // 被下身形
          x.moveTo(bx + 36, by - 50);
          x.quadraticCurveTo(bx + 80, by - 72, bx + 128, by - 50);
          x.lineTo(bx + 128, by - 46); x.lineTo(bx + 36, by - 46);
          x.closePath(); x.fill();
        }
      }

      // 护士长剪影(圆头 + 护士帽 + 立领长裙,行走摆动 / 坐下)
      if (this.line >= 3 && this.nurseX <= 1.1) {
        const nx = this.nurseX * W, ny = floorY;
        const walk = this.nurseSit < 0.2 ? Math.sin(this.t * 5.2) * 3 : 0;
        const sink = this.nurseSit * 26;
        x.save();
        x.translate(nx, ny - 128 + sink);
        x.fillStyle = INK;
        x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();       // 头
        x.fillRect(-14, -22, 28, 8);                           // 护士帽
        x.beginPath();                                          // 裙身
        x.moveTo(-9, 12);
        x.lineTo(9, 12);
        x.lineTo(22 + walk, 128 - sink);
        x.lineTo(-22 - walk, 128 - sink);
        x.closePath(); x.fill();
        x.restore();
      }
      x.restore();
    }

    // 结尾:影院浮现(椅背剪影排 + 小银幕自指)
    if (this.fadeSan > 0) {
      const x2 = this.x;
      x2.save();
      x2.globalAlpha = this.fadeSan;
      x2.fillStyle = '#dfe6e0';
      x2.globalAlpha = this.fadeSan * 0.85;
      x2.fillRect(W / 2 - 190, 100, 380, 190);                 // 小银幕
      x2.globalAlpha = this.fadeSan;
      x2.fillStyle = INK;
      for (let r = 0; r < 2; r++)
        for (let i = 0; i < 8; i++) {
          const cx = 120 + i * 112 + r * 56, cy = 400 + r * 74;
          x2.beginPath(); x2.arc(cx, cy - 24, 16, 0, 7); x2.fill();
          x2.fillRect(cx - 34, cy - 10, 68, 52);
        }
      x2.restore();
    }
  }
}
