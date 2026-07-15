// 机器人观众决策概率(theater 演出概率原值)
export const bots = {
  holdFail: () => Math.random() < 0.10,     // 屏息失败
  splitSide: () => (Math.random() < 0.56 ? 'L' : 'R'),
  dilemmaPush: () => Math.random() < 0.22,  // 选"推"
  numberWrong: () => Math.random() < 0.12,  // 点名做错(后续《最后一排》)
  trapFooled: () => Math.random() < 0.16,   // 手贱换衣(后续《镜中人》)
};
