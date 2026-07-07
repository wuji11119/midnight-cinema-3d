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
        // 「后来这里改成电影院」:灯全灭,布光渐熄 —— 不再画"影院自指"元画面(用户反馈:与内容不符)
        this.fadeSan = Math.min(1, this.fadeSan + dt * 0.32);
        this.lampsOn = 0;
      }
    }
    this.draw();
    this.texture.needsUpdate = true;
  }

  draw() {
    const x = this.x;
    // 亮布幕底(皮影戏 = 背光亮布 + 黑剪影;深底会"黑吃黑",实测踩坑)
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#c4b696'); g.addColorStop(0.55, '#a89a7c'); g.addColorStop(1, '#7e7460');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // 放映灯中心热区 + 四角暗角(旧布被灯打透的感觉)
    const hot = x.createRadialGradient(W / 2, H * 0.46, 80, W / 2, H * 0.46, W * 0.72);
    hot.addColorStop(0, 'rgba(238,226,196,.5)');
    hot.addColorStop(0.6, 'rgba(238,226,196,.10)');
    hot.addColorStop(1, 'rgba(30,24,16,.26)');
    x.fillStyle = hot;
    x.fillRect(0, 0, W, H);
    // 布纹横线 + 噪点
    x.globalAlpha = 0.05;
    x.strokeStyle = '#5a5040';
    for (let yy = 0; yy < H; yy += 7) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    x.globalAlpha = 0.06;
    for (let i = 0; i < 40; i++) {
      x.fillStyle = i % 2 ? '#fff' : '#000';
      x.fillRect((i * 137 + this.t * 20) % W, (i * 89) % H, 2, 2);
    }
    x.globalAlpha = 1;

    if (this.phase === 'curtain') this.drawCurtain();
    else this.drawStory();

    // 银幕内文字(下部,楷体逐字 —— 亮布上用浓墨字,皮影戏字幕气质)
    if (this.phase === 'story' && this.lineText) {
      x.font = '700 36px "KaiTi","STKaiti","楷体",serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(226,214,182,.55)'; x.shadowBlur = 6;
      x.fillStyle = '#241c10';
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
    const sanAlpha = 1;
    const floorY = 452;

    if (sanAlpha > 0) {
      x.save();
      x.globalAlpha = sanAlpha;

      // 窗(黑框剪影 + 窗外飘雪的暗点)
      x.save();
      x.strokeStyle = INK; x.lineWidth = 7;
      x.strokeRect(766, 60, 150, 190);
      x.beginPath(); x.moveTo(841, 60); x.lineTo(841, 250); x.moveTo(766, 155); x.lineTo(916, 155); x.stroke();
      for (const s of this.snow) {
        const sy = (s.y + this.t * 0.03 * s.s) % 1;
        x.globalAlpha = sanAlpha * 0.5 * s.s;
        x.fillStyle = '#3a3226';
        x.fillRect(772 + s.x * 138, 64 + sy * 180, 2.6, 2.6);
      }
      x.restore();

      // 地板线(浓墨)
      x.strokeStyle = 'rgba(36,28,16,.55)';
      x.lineWidth = 3;
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
          const gl = x.createRadialGradient(lx, ly + 34, 4, lx, ly + 34, 95);
          gl.addColorStop(0, 'rgba(255,244,208,.8)'); gl.addColorStop(1, 'rgba(255,244,208,0)');
          x.fillStyle = gl;
          x.beginPath(); x.arc(lx, ly + 34, 95, 0, 7); x.fill();
        } else {
          // 熄灭的灯:灯下拖一片暗影
          x.save();
          x.globalAlpha = 0.18;
          x.fillStyle = INK;
          x.beginPath(); x.arc(lx, ly + 40, 60, 0, 7); x.fill();
          x.restore();
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

    // 结尾:布光渐熄(放映灯慢慢暗下去,只留文字)
    if (this.fadeSan > 0) {
      const x2 = this.x;
      x2.save();
      x2.globalAlpha = this.fadeSan * 0.88;
      x2.fillStyle = '#08070a';
      x2.fillRect(0, 0, W, H - 96);   // 留出底部文字带
      x2.restore();
    }
  }
}
