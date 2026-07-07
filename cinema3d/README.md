# 午夜电影院 · 3D 剧场(cinema3d)

参考 samsy.ninja 的"我在场"体验,把 2D 演出版 `horror-cinema-theater.html` 升级为
Three.js 3D 影厅沉浸演出版:选座入场 + 三态镜头 + 皮影纸偶 + 双模式。
首版内容:《无声疗养院》完整一部(色劫 / 屏息 / 抉择门 / 猎食 / 终幕验色)。

## 怎么跑

双击 `启动.bat`(需要已安装 Node.js)—— 自动起本地服务器并打开浏览器。

或手动:

```bash
node cinema3d/serve.mjs
# → http://localhost:8787/cinema3d/index.html
```

需要支持 WebGL2 的浏览器(Chrome / Edge)。素材直接引用仓库 `art/` 目录,不复制。

## 两种模式

- **只看放映**:全机器人自动播演;系统会随机指定"你"的席位,规则点到你时照样强制切入第一人称 —— 挂机看片也会"轮到你了"。
- **入座试玩**:俯瞰点座位入座;屏息(长按空格)/ 选边(点击按钮)/ 推人或沉默,做错真死 —— 第一人称看黑雾涌上来,然后转旁观看完全场。

操作:`Tab` 或双击 = 切换"我的座位"第一人称 / 导演运镜;鼠标移动 = 环顾;右上角 🔊 静音。

## 目录

```
cinema3d/
├── index.html / src/main.js   入口与装配
├── src/data/films.js          剧本数据(theater FILMS 原样迁移,三部全量,首版只开无声疗养院)
├── src/theater/               影厅 hall / 银幕 screen / 灯光 lights / 黑雾 mist
├── src/puppet/                皮影纸偶 puppet / 观众席 house
├── src/director/              三态镜头 camera / 镜头语言库 shots
├── src/show/                  演出 runner / 幕编排 acts / 机器人 bots
├── src/player/                输入 input / HUD ui
├── src/audio/sfx.js           WebAudio 程序合成 + 空间音频
└── test/films.test.mjs        剧本数据测试(node --test cinema3d/test/*.test.mjs)
```

## 与 theater.html 的关系

剧本文案与演出节奏同源(FILMS 数据原样迁移);渲染 / 镜头 / 音频为 3D 全新实现。
2D 版仍是抖音产品线的定案形态,本目录是演出线的 3D 升级,互不影响。
架构约定:`acts` 编排只面向 puppet / director / screen+lights / audio 的 API 写"演出脚本",
不直接触碰 Three.js 对象 —— 加新幕型、灌新电影不动渲染层。
