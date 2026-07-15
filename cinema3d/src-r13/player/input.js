// 试玩输入:屏息长按窗口 + 俯瞰点击选座
// (选边/推人直接走 ui.choices,不在此层)
import * as THREE from 'three';
import { seatWorldPos, LAYOUT } from '../theater/hall.js';
import { ui } from './ui.js';
import { sfx } from '../audio/sfx.js';

export class Input {
  constructor(renderer, camera, director) {
    this.renderer = renderer;
    this.camera = camera;
    this.director = director;
  }

  // 屏息:窗口前 55% 内按下(空格/触屏)并按住到窗口结束(留 350ms 宽限),松手即败
  // 全程状态反馈(2026-07-14 用户反馈"不知道自己按没按住"):
  // 按下 → 「屏住了」提示 + 闭气压迫暗罩 + 声音闷罐;松早 → 「她听见了」;超时未按 → 同样明示
  holdWindow(ms) {
    return new Promise(res => {
      const t0 = performance.now();
      let holding = false, blew = false, done = false;
      const bo = document.getElementById('blackout');
      const setHoldFx = on => {
        bo.style.transition = 'opacity .35s';
        bo.style.opacity = on ? 0.22 : 0;
        sfx.holdMuffle(on);
      };
      const down = e => {
        if ((e.type === 'keydown' && e.code !== 'Space') || e.repeat || done || blew) return;
        if (holding) return;
        const t = performance.now() - t0;
        if (t <= ms * 0.55) {
          holding = true;
          setHoldFx(true);
          ui.holdHint('屏住了……别松,直到她走过去');
        } else {
          blew = true;   // 反应太慢,这口气没屏上
          ui.holdHint('太迟了……呼吸声露出来了');
        }
      };
      const up = e => {
        if ((e.type === 'keyup' && e.code !== 'Space') || done || !holding) return;
        const t = performance.now() - t0;
        if (t < ms - 350) {
          holding = false;
          blew = true;
          setHoldFx(false);
          ui.holdHint('松了……她听见了');
        }
      };
      addEventListener('keydown', down);
      addEventListener('keyup', up);
      addEventListener('pointerdown', down);
      addEventListener('pointerup', up);
      ui.holdHint('她来了 —— 按住 空格,屏住呼吸');
      ui.countdownBeat(ms);
      setTimeout(() => {
        done = true;
        removeEventListener('keydown', down);
        removeEventListener('keyup', up);
        removeEventListener('pointerdown', down);
        removeEventListener('pointerup', up);
        setHoldFx(false);
        bo.style.transition = 'opacity .12s';
        res({ ok: holding && !blew });
      }, ms);
    });
  }

  // 走动选座:靠近空座(≤2.0m)亮红罩,按 E 入座;100ms 轮询不依赖 rAF
  walkPickSeat(scene, house) {
    return new Promise(res => {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.95, 0.66),
        new THREE.MeshBasicMaterial({ color: 0xb8433a, transparent: true, opacity: 0.34, depthWrite: false })
      );
      hl.visible = false;
      scene.add(hl);
      const v = new THREE.Vector3();
      let near = -1;
      const tick = setInterval(() => {
        const wp = this.director.walkPos;
        let best = -1, bestD = 2.6 * 2.6;
        for (const i of house.emptySeats || []) {
          seatWorldPos(i, v);
          const d = (v.x - wp.x) ** 2 + (v.z - wp.z) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best !== near) {
          near = best;
          if (near >= 0) {
            seatWorldPos(near, v);
            hl.position.set(v.x, v.y - 0.05, v.z + 0.05);
            hl.visible = true;
            ui.holdHint('E · 在这里坐下');
          } else {
            hl.visible = false;
            ui.holdHint('W A S D · 走动　鼠标 · 环顾 —— 找一个空座');
          }
        }
      }, 100);
      const onKey = e => {
        if (e.code !== 'KeyE' || near < 0) return;
        clearInterval(tick);
        removeEventListener('keydown', onKey);
        scene.remove(hl);
        ui.holdHint(null);
        res(near);
      };
      addEventListener('keydown', onKey);
      ui.holdHint('W A S D · 走动　鼠标 · 环顾 —— 找一个空座');
    });
  }

  // 俯瞰选座:hover 高亮,点击空座落座
  pickSeat(scene, seats) {
    return new Promise(res => {
      const cam = this.camera;
      this.director.enabled = false;
      cam.position.set(0, 8.4, 1.4);
      cam.lookAt(0, 0.8, -4.4);
      cam.fov = 46;
      cam.updateProjectionMatrix();

      ui.holdHint('点击一个座位 · 入座');

      // 高亮罩
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.95, 0.66),
        new THREE.MeshBasicMaterial({ color: 0xb8433a, transparent: true, opacity: 0.32, depthWrite: false })
      );
      hl.visible = false;
      scene.add(hl);

      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      let hover = -1;
      const v = new THREE.Vector3();

      const toNdc = e => {
        ndc.x = (e.clientX / innerWidth) * 2 - 1;
        ndc.y = -(e.clientY / innerHeight) * 2 + 1;
      };
      // 最近座位判定:射线到座位点的距离取最小(≤0.75m)。
      // 不做椅子网格 raycast —— 俯瞰下椅体窄、列缝多,精确命中率太低,
      // 用户体感"点哪都没反应"(实测踩坑:81 方向网格只 8 中)
      const N_SEATS = LAYOUT.ROWS * LAYOUT.COLS;
      const castSeat = e => {
        toNdc(e);
        cam.updateMatrixWorld();
        ray.setFromCamera(ndc, cam);
        let best = -1, bestD = 0.75 * 0.75;
        for (let i = 0; i < N_SEATS; i++) {
          seatWorldPos(i, v);
          const d = ray.ray.distanceSqToPoint(v);
          if (d < bestD) { bestD = d; best = i; }
        }
        return best;
      };
      const move = e => {
        hover = castSeat(e);
        if (hover >= 0) {
          seatWorldPos(hover, v);
          hl.position.set(v.x, v.y - 0.05, v.z + 0.05);
          hl.visible = true;
        } else hl.visible = false;
      };
      const click = e => {
        const i = castSeat(e);
        if (i < 0) return;
        removeEventListener('pointermove', move);
        removeEventListener('pointerdown', click);
        scene.remove(hl);
        ui.holdHint(null);
        this.director.enabled = true;
        res(i);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerdown', click);
    });
  }
}
