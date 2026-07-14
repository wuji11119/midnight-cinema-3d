// 剧本数据 —— 自 horror-cinema-theater.html FILMS 原样迁移(去 AI 味重写版,一字不改)
// 幕型全集:color / hold / split / split_few / dilemma / trap / number / final(无 quiz、vote)

export const COLORS = ['红', '蓝', '黄', '绿', '白', '黑', '紫'];

export const CURTAINS = [
  { label: '血红色', c: '红' },
  { label: '幽紫色', c: '紫' },
  { label: '墨黑色', c: '黑' },
];

// 衣色暗调(spec 4.3):银幕光下可辨,但保持"从黑暗里洇出来"的暗度
export const CLOTH_HEX = {
  红: 0x6b2226, 蓝: 0x1e2a52, 黄: 0x5c4a16, 绿: 0x22402a,
  白: 0x7a7f7a, 黑: 0x121216, 紫: 0x3a2050,
};

export const FILMS = {
  'silent-ward': {
    enabled: true,
    title: '无声疗养院', tagline: '嘘。她不用开灯。', pal: 'cold', bg: 'art/bg-cold.png', threat: 'nurse',
    story: [
      '一九四七年冬天，疗养院收进来十一个失眠的病人。',
      '院里只有一条规矩：熄灯后，不许出声。',
      '守规矩的，开春都出院了。',
      '没守的，护士长会去他床边，坐一会儿。第二天，那张床就空了。',
      '后来这里改成电影院。规矩没换过。',
    ],
    motif: ['走廊尽头有脚步声。还远。', '脚步声停了。停在哪一排，没数清。', '这一排。她在你旁边，站下了。'],
    acts: [
      { k: 'color', proj: 'art/scr-ward-beds.png', rule: '今晚{color}是病危色。名单，昨天就写好了。' },
      { k: 'hold', proj: 'art/scr-nurse.png', rule: '她查房了。屏住。她听的不是呼吸，是心跳。' },
      { k: 'split', proj: 'art/scr-doors.png', rule: '脚步停在门口。左边，或右边。钥匙只有一把，两扇门都没锁。' },
      { k: 'dilemma', proj: 'art/scr-nurse.png', rule: '旁边的人，喘得越来越响。把他扶到走廊，或者捂住自己的耳朵。' },
      { k: 'final', proj: 'art/scr-curtain-eye.png', rule: '与开场幕布同色的，留下。什么颜色来着……我记不清了。' },
    ],
    asides: ['那张床空了，床单还凹着一个人形。', '走廊尽头，灭了一盏灯。', '她在他床边，坐下了。'],
    survive: '你走出去。身后的灯一盏一盏灭，没追上你。',
  },
  'mirror': {
    enabled: false,
    title: '镜中人', tagline: '它挑你不会挑的那扇门。', pal: 'violet', bg: 'art/bg-violet.png', threat: 'mirror',
    story: [
      '这面银幕，原来是裁缝铺的试衣镜。',
      '老板的女儿爱对着它换衣服。换到第七件那晚，镜子里的她，没跟着换。',
      '镜子蒙了块黑布，半价卖给了电影院。',
      '黑布揭下来，磨成了银幕。磨掉的，只是那层玻璃。',
      '里面的人，还在。',
    ],
    motif: ['银幕闪了一下。可能是机器。', '又闪。镜子里的人，比台下少一个。', '第三次。镜子里只剩你，台下，没有你。'],
    acts: [
      { k: 'color', proj: 'art/scr-mirror.png', rule: '镜子今晚收{color}。它挑了很久，从你们买票那刻起。' },
      { k: 'split_few', proj: 'art/scr-doors.png', rule: '镜子裂成两半。它想清净，去人少的那边。它数得比你快。' },
      { k: 'trap', proj: 'art/scr-mirror.png', rule: '穿{color}的，镜子要收。', mid: '现在，每人可以换一件。这话是谁说的，没人问。' },
      { k: 'dilemma', proj: 'art/scr-mirror-hand.png', rule: '镜子里伸出一只手，在等。推一个过去，或者闭眼。它不急，镜子里时间多。' },
      { k: 'final', proj: 'art/scr-eye.png', rule: '幕布什么色，瞳孔就什么色。穿对的，过来配对。' },
    ],
    asides: ['镜子里，多站了一个人。', '他换衣服的样子，镜子记下了。每一帧。', '台下少一个，镜子里多一个。'],
    survive: '你回头看了眼银幕。里面的你，没跟上来。它在原地，朝你挥手。',
  },
  'back-row': {
    enabled: false,
    title: '最后一排', tagline: '那排的票，从来没卖出去过。', pal: 'crimson', bg: 'art/bg-crimson.png', threat: 'backrow',
    story: [
      '开业那年，最后一排的票卖出去过一次。整排，十一张。',
      '散场时十一个座位都空着。检票员记得，没人从门口出去过。',
      '经理把那排票，下了架。',
      '可保洁说，每晚扫到最后一排，椅垫是温的。',
      '后来影院学乖了：不卖，不修，不数。',
    ],
    motif: ['别回头数最后一排。', '有人数了。第二天，他的座也算进了最后一排。', '你回头了吗？最后一排，比开场多一个。'],
    acts: [
      { k: 'color', proj: 'art/scr-backrow.png', rule: '今晚椅套是{color}。穿同色的，它当你是空座，会坐下来。' },
      { k: 'number', proj: 'art/scr-backrow.png', rule: '验票。座号是质数的，起立。标记是进场时盖的，你没察觉那一下。' },
      { k: 'split', proj: 'art/scr-doors.png', rule: '断电了。往前排，或往后排。它只扫一边。电闸，在它手里。' },
      { k: 'dilemma', proj: 'art/scr-backrow.png', rule: '它要换座，看上了你旁边那位。推过去，或者缩进椅背装睡。' },
      { k: 'final', proj: 'art/scr-curtain-eye.png', rule: '幕布什么色，椅套就什么色。穿对的，留下。配套的，影院不单卖。' },
    ],
    asides: ['后排，又坐满了一截。', '那一边，传来很多声"欢迎"。', '他的座，算进了最后一排。'],
    survive: '你走前门，没回头。门合上前，身后很轻地，响了一声鼓掌。',
  },
};

export function ruleText(t, v) {
  return t.replace(/\{(\w+)\}/g, (_, k) => v[k] || '');
}

export function pick(a) {
  return a[Math.floor(Math.random() * a.length)];
}
