// 午夜电影院 3D · 主入口:装配所有系统,gate → 选座 → 放映循环
import * as THREE from 'three';
import { buildHall, seatWorldPos, LAYOUT } from './theater/hall.js';
import { Lights } from './theater/lights.js';
import { Screen } from './theater/screen.js';
import { House } from './puppet/house.js';
import { Mist } from './theater/mist.js';
import { Director } from './director/camera.js';
import { sfx } from './audio/sfx.js';
import { ui } from './player/ui.js';
import { Input } from './player/input.js';
import { playFilm } from './show/runner.js';
import { asset } from './assets.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030308);
scene.fog = new THREE.FogExp2(0x05060a, 0.048);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 60);
camera.position.set(0, 3.4, 4.6);
camera.lookAt(0, 2.2, -8);

const hall = buildHall(scene);
const lights = new Lights(scene);
const screen = new Screen(scene, hall.screenMesh);
const house = new House();
house.build(scene);
house.assign();
const mist = new Mist(scene);
const director = new Director(camera);
const input = new Input(renderer, camera, director);

// 第一人称时隐藏"我"的纸偶 —— 眼位就在自己偶的头顶,billboard 会把
// 金圈背板转向镜头,不隐藏则满屏都是自己的侧面色块(实测踩坑);事件驱动即切即隐
director.onModeChange = mode => {
  const me = house.playerPuppet();
  if (!me) return;
  const inFP = mode === 'FP' || mode === 'FORCED';
  me.group.visible = me.alive ? !inFP : false;
};

const ctx = { house, director, screen, lights, mist, sfx, ui, input, mode: 'watch', run: null };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  fpsSample(dt);
  director.update(dt);

  // 兜底:死亡后的"我"保持不可见(主隐藏逻辑走 onModeChange 事件)
  const me = house.playerPuppet();
  if (me && !me.alive) me.group.visible = false;

  screen.update(dt);
  lights.update(dt, screen.avgColor);
  house.update(dt, t, camera.position);
  mist.update(dt);
  renderer.render(scene, camera);
});

// ---- 资源预载(入场页期间) ----
const PRELOAD = [
  'art/scr-ward-beds.png', 'art/scr-nurse.png', 'art/scr-doors.png',
  'art/scr-curtain-eye.png', 'art/mist.png',
].map(asset);
function preload() {
  const tip = document.getElementById('loadTip');
  let done = 0;
  tip.textContent = `放映准备中 0/${PRELOAD.length}`;
  return Promise.all(PRELOAD.map(u => new Promise(res => {
    const img = new Image();
    img.onload = img.onerror = () => {
      tip.textContent = `放映准备中 ${++done}/${PRELOAD.length}`;
      if (done === PRELOAD.length) tip.textContent = '胶片已就位';
      res();
    };
    img.src = u;
  })));
}
const preloading = preload();

// ---- 帧率自适应:只降不升 ----
let fpsAcc = 0, fpsN = 0, perfTier = 0;
function fpsSample(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 2.5) {
    const fps = fpsN / fpsAcc;
    fpsAcc = 0; fpsN = 0;
    if (perfTier < 1 && fps < 45) {
      perfTier = 1;
      if (mist.ambient) for (const c of mist.ambient) for (let i = 1; i < c.n; i += 2) c.alpha[i] = 0;
    } else if (perfTier < 2 && fps < 28) {
      perfTier = 2;
      document.getElementById('grain').style.display = 'none';
      renderer.setPixelRatio(1);
    }
  }
}

// ---- 入场与放映循环 ----
let started = false;
async function start(mode) {
  if (started) return;
  started = true;
  sfx.init(camera, scene);
  director.onStep = () => sfx.step();
  ui.gateHide();
  await Promise.all([mist.ready, preloading]);
  let playerSeat, preAssigned = false;
  if (mode === 'play') {
    // 第一人称走动入场:观众已坐定,你从银幕侧前门进来,找空座坐下
    house.assign({ playerSeat: null, emptyCount: 5 });
    director.enterWalk();
    playerSeat = await input.walkPickSeat(scene, house);
    house.claimSeat(playerSeat);
    director.sitDown(playerSeat);
    preAssigned = true;
    await new Promise(r => setTimeout(r, 1200));   // 落座过渡
  } else {
    // watch 的"你"也放最后两排(镜头切入时不怼银幕)
    playerSeat = Math.floor(Math.random() * LAYOUT.COLS * 2);
  }
  await playFilm(ctx, 'silent-ward', { mode, playerSeat, preAssigned });
  ui.gateShow();   // 散场回入场页,可换模式再来
  started = false;
}

document.getElementById('btnWatch').onclick = () => start('watch');
document.getElementById('btnPlay').onclick = () => start('play');
document.getElementById('mute').onclick = e => {
  sfx.setMuted(!sfx.muted);
  e.target.textContent = sfx.muted ? '🔇' : '🔊';
};

// 移动端:双击 = 切换视角(Tab 等效)
let lastTap = 0;
addEventListener('pointerup', () => {
  const now = performance.now();
  if (now - lastTap < 320) {
    if (director.mode === 'AUTO') director.toFP();
    else if (director.mode === 'FP') director.toAuto();
  }
  lastTap = now;
});

// console 调试入口
async function kill(i) {
  const p = house.get(i);
  if (!p?.alive) return;
  const pos = p.group.position.clone();
  lights.deathLight(pos);
  sfx.whooshAt(pos);
  await mist.burst(pos);
  await p.devour();
}
window.__ctx = { THREE, scene, camera, renderer, hall, lights, screen, house, mist, kill, director, sfx, ui, input, ctx, start, seatWorldPos };
