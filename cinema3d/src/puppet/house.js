// 观众席管理:30 纸偶入座 / 座号衣色分配 / 存活查询
import * as THREE from 'three';
import { Puppet } from './puppet.js';
import { seatWorldPos, LAYOUT } from '../theater/hall.js';
import { COLORS, pick } from '../data/films.js';

export class House {
  constructor() {
    this.puppets = [];
    this.playerSeat = null;   // 试玩模式:玩家席位号(该偶隐藏于 FP)
  }

  build(scene) {
    const N = LAYOUT.ROWS * LAYOUT.COLS;
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      seatWorldPos(i, v);
      const p = new Puppet(v.clone(), i);
      this.puppets.push(p);
      scene.add(p.group);
    }
  }

  // 每场开演前:重置 + 发座号(1..30 洗牌)+ 发衣色
  assign({ playerSeat = null, playerColor = null } = {}) {
    this.playerSeat = playerSeat;
    const nums = Array.from({ length: this.puppets.length }, (_, i) => i + 1)
      .sort(() => Math.random() - 0.5);
    const v = new THREE.Vector3();
    this.puppets.forEach((p, i) => {
      seatWorldPos(i, v);
      p.group.visible = true;
      p.group.position.copy(v);
      p.group.rotation.set(0, 0, 0);
      p.group.scale.setScalar(1);
      p.alive = true; p._dead = false;
      p._mark = false; p._stand = 0; p._lean = 0; p._sideX = 0; p._shiverT = 0;
      p.baseX = v.x; p._baseY = v.y;
      p.torsoMat.transparent = false; p.torsoMat.opacity = 1;
      p.torsoMat.emissiveIntensity = 0;
      p.setNum(nums[i]);
      p.setColor(pick(COLORS));
      if (p.numMesh) p.numMesh.material.opacity = 0.8;
    });
    if (playerSeat != null && playerColor) this.puppets[playerSeat].setColor(playerColor);
  }

  get(i) { return this.puppets[i]; }
  alive() { return this.puppets.filter(p => p.alive); }
  aliveCount() { return this.alive().length; }
  isPlayerAlive() { return this.playerSeat == null ? true : this.puppets[this.playerSeat].alive; }
  playerPuppet() { return this.playerSeat == null ? null : this.puppets[this.playerSeat]; }

  update(dt, t, camPos) {
    for (const p of this.puppets) p.update(dt, t, camPos);
  }
}
