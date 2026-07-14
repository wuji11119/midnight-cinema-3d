// 幕演出编排:只面向 house/director/screen+lights/mist/sfx/ui/input 七方 API,不碰 Three 对象
// 节奏对齐 theater ACT;判定加入玩家真输入(play 模式)
import { ruleText } from '../data/films.js';
import { bots } from './bots.js';
import { ui, sleep } from '../player/ui.js';
import { asset } from '../assets.js';

function flash(a = 0.5) {
  const f = document.getElementById('flash');
  f.style.transition = 'none';
  f.style.opacity = a;
  void f.offsetWidth;
  f.style.transition = 'opacity .5s';
  f.style.opacity = 0;
}

// 玩家死亡:第一人称被黑雾吞没 → 转旁观
async function playerDeathFX(ctx) {
  const { director, sfx, mist, house } = ctx;
  await director.forceFP();
  sfx.heartbeat(2.2);
  const p = house.playerPuppet();
  mist.burst(p.group.position.clone());
  await sleep(700);
  const bo = document.getElementById('blackout');
  bo.style.transition = 'opacity 1.4s';
  bo.style.opacity = 1;
  sfx.vacuum();
  sfx.heartbeat(0);
  await sleep(1500);
  await p.devour();
  director.release();
  director.toAuto();
  ui.deadBanner(true);
  bo.style.transition = 'opacity 2.2s';
  bo.style.opacity = 0;
  await sleep(1200);
  bo.style.transition = 'opacity .12s';
}

// 通用死亡序列:血光+方向尖啸+雾包裹+拽走;含玩家则玩家先走特殊演出
export async function killSeq(ctx, victims, gap = 420) {
  const { lights, sfx, mist, director, house } = ctx;
  ctx.screen.clearText();
  const player = victims.find(p => house.playerSeat != null && p.seatIdx === house.playerSeat);
  const others = victims.filter(p => p !== player);
  if (player) await playerDeathFX(ctx);
  others.forEach((p, i) => {
    setTimeout(() => {
      if (!p.alive) return;
      const pos = p.group.position.clone();
      // 死亡镜头 = 荧幕视角(从银幕回看观众席,黑雾卷人全景可见);
      // 旁观镜头只在上帝视角/荧幕视角之间切换,不再贴脸席位(用户反馈:近景穿模只见侧面)
      if (i === 0) director.requestShot('houseFront');
      lights.deathLight(pos);
      sfx.whooshAt(pos);
      mist.burst(pos).then(() => p.devour());
    }, i * gap);
  });
  await sleep(others.length * gap + 2100);
}

// 本幕涉及"你" → 强制切入第一人称(轮到你了)
async function forceIfInvolved(ctx, involved) {
  if (!involved) return false;
  await ctx.director.forceFP();
  ctx.sfx.earRing();
  ctx.sfx.heartbeat(1.5);
  return true;
}
function releaseForced(ctx, was) {
  ctx.sfx.heartbeat(0);
  if (was && ctx.house.isPlayerAlive()) ctx.director.release();
}

export const ACTS = {
  // 穿 X 色者死
  async color(ctx, act, run) {
    const { house, screen, director, sfx } = ctx;
    await screen.show(asset(act.proj));
    screen.flick();
    const ruleStr = ruleText(act.rule, { color: run.target });
    screen.bloodText(ruleStr);
    await ui.cap(ruleStr, 'rule');
    await sleep(900);
    director.requestShot('houseFront');
    house.alive().filter(p => p.color === run.target).forEach(p => p.setMark(true));
    const me = house.playerPuppet();
    const involved = me?.alive && me.color === run.target;
    const was = await forceIfInvolved(ctx, involved);
    if (involved) ui.holdHint(`你穿着${run.target}色`);
    await sleep(1700);
    ui.capHide(); ui.holdHint(null);
    sfx.sting(); flash(0.4);
    const doomed = house.alive().filter(p => p.color === run.target);
    await killSeq(ctx, doomed, 420);
    house.puppets.forEach(p => p.setMark(false));
    releaseForced(ctx, was);
  },

  // 屏住呼吸(她查房):play 长按空格 ≥4s
  async hold(ctx, act, run) {
    const { house, screen, lights, sfx, input, mode } = ctx;
    await screen.show(asset(act.proj));
    const ruleStr = ruleText(act.rule, {});
    screen.bloodText(ruleStr);
    await ui.cap(ruleStr, 'rule');
    lights.dim(0.5);
    sfx.rumble(true);
    const me = house.playerPuppet();
    const was = await forceIfInvolved(ctx, me?.alive);
    let playerFail = false;
    if (mode === 'play' && me?.alive) {
      // 提示 / 闭气反馈 / 声音闷罐全部由 holdWindow 内部管理
      const r = await input.holdWindow(4600);
      playerFail = !r.ok;
      ui.holdHint(null);
    } else {
      await ui.countdownBeat(4200);
    }
    ui.capHide();
    const doomed = house.alive().filter(p =>
      p.seatIdx === house.playerSeat ? playerFail : bots.holdFail());
    doomed.forEach(p => p.shiver(1.0));
    await sleep(900);
    sfx.sting();
    await killSeq(ctx, doomed, 460);
    lights.dim(1);
    sfx.rumble(false);
    releaseForced(ctx, was);
  },

  // 左右选边,人多边死(split_few 反转)
  async split(ctx, act, run) { await splitCore(ctx, act, run, false); },
  async split_few(ctx, act, run) { await splitCore(ctx, act, run, true); },

  // 推出去 / 闭眼祈祷
  async dilemma(ctx, act, run) {
    const { house, screen, lights, sfx, mode, input } = ctx;
    await screen.show(asset(act.proj));
    const ruleStr = ruleText(act.rule, {});
    screen.bloodText(ruleStr);
    await ui.cap(ruleStr, 'rule');
    lights.dim(0.45);
    const me = house.playerPuppet();
    const was = await forceIfInvolved(ctx, mode === 'play' && me?.alive);
    let playerPush = false;
    if (mode === 'play' && me?.alive) {
      const [choice] = await Promise.all([
        ui.choices([
          { label: '推出去', value: 'push' },
          { label: '闭眼祈祷', value: 'silent' },
        ], { expire: 4200, confirmOnPick: true }),
        ui.countdownBeat(4200),
      ]);
      playerPush = choice === 'push';
    } else {
      await ui.countdownBeat(4200);
    }
    ui.capHide();
    const A = house.alive();
    const pushers = A.filter(p =>
      p.seatIdx === house.playerSeat ? playerPush : bots.dilemmaPush());
    pushers.forEach(p => p.lean(true, p.seatIdx % 2 ? 1 : -1));
    await sleep(1100);
    sfx.sting();
    const doomed = new Set();
    if (pushers.length && pushers.length < A.length - pushers.length) {
      // 推者少于沉默者:每个推者的左邻遭殃(环上前一位,推者不免疫)
      pushers.forEach(p => {
        const i = A.indexOf(p);
        doomed.add(A[(i - 1 + A.length) % A.length]);
      });
    } else if (pushers.length) {
      pushers.forEach(p => doomed.add(p));
    }
    await killSeq(ctx, [...doomed], 460);
    house.puppets.forEach(p => p.lean(false));
    lights.dim(1);
    releaseForced(ctx, was);
  },

  // 终幕:与开场幕布同色者死(考记忆)
  async final(ctx, act, run) {
    const { house, screen, director, sfx } = ctx;
    await screen.show(asset(act.proj));
    const ruleStr = ruleText(act.rule, {});
    screen.bloodText(ruleStr);
    await ui.cap(ruleStr, 'rule');
    await sleep(900);
    director.requestShot('screenPush');
    const me = house.playerPuppet();
    const involved = me?.alive && me.color === run.curtain.c;
    const was = await forceIfInvolved(ctx, involved);
    if (involved) ui.holdHint(`幕布是${run.curtain.label}……你穿的就是${run.curtain.c}`);
    await ui.countdownBeat(3600);
    ui.capHide(); ui.holdHint(null);
    flash(0.55); sfx.sting();
    const doomed = house.alive().filter(p => p.color === run.curtain.c);
    await killSeq(ctx, doomed, 480);
    releaseForced(ctx, was);
  },
};

async function splitCore(ctx, act, run, few) {
  const { house, screen, sfx, mode, director } = ctx;
  await screen.show(asset(act.proj));
  const ruleStr = ruleText(act.rule, {});
    screen.bloodText(ruleStr);
    await ui.cap(ruleStr, 'rule');
  await sleep(800);
  const me = house.playerPuppet();
  const was = await forceIfInvolved(ctx, mode === 'play' && me?.alive);
  let playerSide = null;
  if (mode === 'play' && me?.alive) {
    const sidePick = ui.choices([
      { label: '← 往左', value: 'L' },
      { label: '往右 →', value: 'R' },
    ], { expire: 4200, confirmOnPick: false });
    await ui.countdownBeat(4200);
    playerSide = await sidePick;
  }
  ui.capHide();
  const sides = new Map();
  for (const p of house.alive()) {
    const s = p.seatIdx === house.playerSeat && playerSide
      ? playerSide
      : (p.seatIdx === house.playerSeat && !playerSide && mode === 'play'
        ? (Math.random() < 0.5 ? 'L' : 'R')   // 玩家超时未选:随机分边
        : bots.splitSide());
    sides.set(p, s);
    p.sideShift(s === 'L' ? -1 : 1);
  }
  if (mode !== 'play') director.requestShot('overhead');
  await sleep(1500);
  let nL = 0, nR = 0;
  sides.forEach(s => (s === 'L' ? nL++ : nR++));
  sfx.sting();
  await sleep(700);
  const more = nL > nR ? 'L' : 'R';
  const dead = few ? (more === 'L' ? 'R' : 'L') : more;
  const doomed = [];
  if (nL !== nR) sides.forEach((s, p) => { if (s === dead) doomed.push(p); });
  await killSeq(ctx, doomed, 150);
  house.puppets.forEach(p => p.sideShift(0));
  releaseForced(ctx, was);
}
