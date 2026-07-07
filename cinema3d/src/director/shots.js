// 镜头语言库:每个 shot = { dur, at(k, pos, look) } —— k∈[0,1] 输出机位与注视点
// 恐怖片语法:缓推 / 横扫 / 过肩 / 俯瞰 / 回看全场 / 死亡近景
import * as THREE from 'three';
import { LAYOUT, seatWorldPos } from '../theater/hall.js';

const ease = k => k * k * (3 - 2 * k);
const L = LAYOUT;

export const SHOTS = {
  // 上帝视角(常驻基准机位):银幕与全场同框,只做呼吸式极缓漂移,永不轮换
  // 机位随影院阶梯化(排差 0.42/银幕抬高)上调,保证银幕全幅 + 阶梯观众全览
  godView: () => ({
    dur: Infinity,
    at(k, pos, look, t = 0) {
      pos.set(Math.sin(t * 0.11) * 0.55, 8.0 + Math.sin(t * 0.07) * 0.15, 4.8);
      look.set(0, 2.35, -5.6);
    },
  }),

  // 缓推银幕:悬念推进
  screenPush: () => ({
    dur: 9,
    at(k, pos, look) {
      const e = ease(k);
      pos.set(0, 2.55 + e * 0.3, 2.6 - e * 4.2);
      look.set(0, L.SCREEN_Y - 0.3, L.SCREEN_Z);
    },
  }),

  // U 形横扫观众席(随机方向)
  sweep: () => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      dur: 9,
      at(k, pos, look) {
        const e = ease(k);
        const ang = (-0.5 + e) * Math.PI * 0.52 * dir;
        pos.set(Math.sin(ang) * 5.6, 2.3, -3.2 + Math.cos(ang) * 6.4);
        look.set(0, 1.15, -4.2);
      },
    };
  },

  // 过肩:随机后排座位后上方,越过头肩看银幕
  shoulder: () => {
    const row = 2 + Math.floor(Math.random() * 3);
    const col = 1 + Math.floor(Math.random() * 4);
    const seat = seatWorldPos(row * L.COLS + col);
    return {
      dur: 7,
      at(k, pos, look) {
        const e = ease(k);
        pos.set(seat.x + 0.35, seat.y + 0.95, seat.z + 1.1 - e * 0.35);
        look.set(seat.x * 0.3, L.SCREEN_Y - 0.9, L.SCREEN_Z);
      },
    };
  },

  // 俯瞰全场:上帝视角缓移
  overhead: () => ({
    dur: 8,
    at(k, pos, look) {
      const e = ease(k);
      pos.set((e - 0.5) * 1.6, 7.2, 2.2 - e * 1.2);
      look.set(0, 1.5, -4.5);
    },
  }),

  // 回看全场:从银幕的位置审视观众(点名 / 规则宣布)—— 阶梯厅从银幕上方俯扫
  houseFront: () => ({
    dur: 8,
    at(k, pos, look) {
      const e = ease(k);
      pos.set((0.5 - e) * 2.4, 3.6, L.SCREEN_Z + 1.6);
      look.set(0, 1.6, -3.6);
    },
  }),

  // 死亡近景:侧高位斜切席位(过道方向进入,避免被前后椅背糊脸)
  seatClose: ({ seatPos }) => ({
    dur: 3.2,
    at(k, pos, look) {
      const e = ease(Math.min(k * 1.6, 1));
      const side = seatPos.x > 0 ? -1 : 1;   // 从过道一侧看进来
      pos.set(
        seatPos.x + side * (1.9 - e * 0.4),
        seatPos.y + 1.25,
        seatPos.z + 0.75 - e * 0.25
      );
      look.set(seatPos.x, seatPos.y + 0.5, seatPos.z);
    },
  }),
};

// 镜头策略(2026-07-07 用户反馈定案):不做机位轮换 ——
// godView 常驻;只在「主角行动(FORCED/FP)」与「他人死亡(seatClose)」时切换,
// 插队镜头播完自动回 godView。旧轮换序列废弃保留镜头语言库供编排点名。
export const HOME_SHOT = 'godView';
