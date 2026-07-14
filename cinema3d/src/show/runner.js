// 一场放映的状态机:片名 → 序章 → 幕循环(motif 间奏)→ 生还词 → 结算
// 与 theater play() 同节奏;phase 数值同源
import { FILMS, COLORS, CURTAINS, pick } from '../data/films.js';
import { ACTS } from './acts.js';
import { ui, sleep } from '../player/ui.js';
import { ShadowShow } from '../theater/shadowshow.js';

let runToken = 0;

export async function playFilm(ctx, filmId, { mode, playerSeat, preAssigned = false }) {
  const my = ++runToken;
  const film = FILMS[filmId];
  const { house, screen, lights, director, sfx } = ctx;

  // 复位与分配(走动选座模式已在场外 assign+claim,不重洗)
  if (!preAssigned) {
    house.assign({ playerSeat });
    director.attachSeat(playerSeat);
  }
  // play=第一人称开演(代入感);watch=上帝视角
  if (mode === 'play') { if (director.mode !== 'FP') director.toFP(); }
  else director.toAuto();
  ui.deadBanner(false);
  lights.dim(1);
  ctx.mode = mode;

  // 本场规则量(theater L428-430:target ≠ 幕布色;target2 备用)
  const run = { curtain: pick(CURTAINS), step: 0 };
  run.target = pick(COLORS.filter(c => c !== run.curtain.c));
  run.target2 = pick(COLORS.filter(c => c !== run.curtain.c && c !== run.target));
  ctx.run = run;

  await sleep(600);

  // 片名
  ui.marquee(true);
  ui.title(film);
  sfx.sting();
  if (mode === 'watch') {
    ui.holdHint('只看放映 · 全自动,无需操作(Tab / 双击可切我的座位视角)');
    setTimeout(() => ui.holdHint(null), 5200);
  }
  await sleep(3200);
  if (my !== runToken) return;
  ui.titleHide();
  await sleep(1200);

  // 序章:银幕皮影戏 —— 拉幕验色(幕布用本场真实颜色,记忆考点)+ 逐句剪影剧情
  const shadow = new ShadowShow(film, run.curtain);
  screen.startShadow(shadow);
  await sleep(3400);                      // 拉幕 + 血字「记住它」
  for (let si = 0; si < film.story.length; si++) {
    if (my !== runToken) return;
    shadow.setLine(si, film.story[si]);
    await sleep(4300);                    // 每句:皮影场景推进 + 银幕内逐字
  }
  screen.stopShadow();
  screen.hide(0.9);      // 布光熄灭:不让皮影戏最后一帧滞留到幕间(用户反馈)
  await sleep(400);

  // 幕循环
  for (let i = 0; i < film.acts.length; i++) {
    if (my !== runToken) return;
    const mi = i === 0 ? 0 : i === Math.floor(film.acts.length / 2) ? 1 : i === film.acts.length - 1 ? 2 : -1;
    if (mi >= 0) {
      // motif 间奏:熄灯 + 银幕血字低语(threat 的 3D 化)
      screen.flick();
      sfx.sting();
      lights.blackout(500);
      screen.bloodText(film.motif[mi]);
      await sleep(2100);
      screen.clearText();
      await sleep(500);
    }
    const act = film.acts[i];
    await ACTS[act.k](ctx, act, run);
    if (my !== runToken) return;
    if (Math.random() < 0.6) {
      await ui.cap(pick(film.asides));
      await sleep(1500);
      ui.capHide();
      await sleep(400);
    }
    if (house.aliveCount() < 3) break;
  }

  // 散场
  if (my !== runToken) return;
  screen.hide();
  lights.dim(1.05);
  await sleep(700);
  await ui.cap(film.survive);
  await sleep(3200);
  ui.capHide();
  ui.marquee(false);
  ui.deadBanner(false);

  await ui.settle({
    surviveLine: film.survive,
    aliveCount: house.aliveCount(),
    playerAlive: house.isPlayerAlive(),
    mode,
  });
}
