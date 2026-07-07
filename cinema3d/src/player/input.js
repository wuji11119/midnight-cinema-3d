// 试玩输入:屏息长按窗口 + 俯瞰点击选座
// (选边/推人直接走 ui.choices,不在此层)
import * as THREE from 'three';
import { seatWorldPos, LAYOUT } from '../theater/hall.js';
import { ui } from './ui.js';

export class Input {
  constructor(renderer, camera, director) {
    this.renderer = renderer;
    this.camera = camera;
    this.director = director;
  }

  // 屏息:窗口开启后 1200ms 内按下(空格/触屏),按住到剩 500ms 宽限点,期间松手即败
  holdWindow(ms) {
    return new Promise(res => {
      const t0 = performance.now();
      let downAt = null, failed = false, done = false;
      const ok = () => downAt != null && !failed;
      const down = e => {
        if (e.type === 'keydown' && e.code !== 'Space') return;
        if (e.repeat) return;
        const t = performance.now() - t0;
        if (downAt == null) {
          if (t > 1200) failed = true;   // 按太晚
          downAt = t;
        }
      };
      const up = e => {
        if (e.type === 'keyup' && e.code !== 'Space') return;
        if (downAt == null || done) return;
        const t = performance.now() - t0;
        if (t < ms - 500) failed = true;  // 松太早
      };
      addEventListener('keydown', down);
      addEventListener('keyup', up);
      addEventListener('pointerdown', down);
      addEventListener('pointerup', up);
      // 倒计时圈并行
      ui.countdownBeat(ms);
      setTimeout(() => {
        done = true;
        removeEventListener('keydown', down);
        removeEventListener('keyup', up);
        removeEventListener('pointerdown', down);
        removeEventListener('pointerup', up);
        res({ ok: ok() });
      }, ms);
    });
  }

  // 俯瞰选座:hover 高亮,点击空座落座
  pickSeat(scene, seats) {
    return new Promise(res => {
      const cam = this.camera;
      this.director.enabled = false;
      cam.position.set(0, 7.4, 0.9);
      cam.lookAt(0, 0.4, -4.4);
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
      const castSeat = e => {
        toNdc(e);
        ray.setFromCamera(ndc, cam);
        const hit = ray.intersectObject(seats, false)[0];
        return hit ? hit.instanceId : -1;
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
