// DOM HUD:字幕(逐字血字)/ 片名 / 顶栏 / 倒计时呼吸圈 / 结算 / 选项按钮
import { sfx } from '../audio/sfx.js';

const $ = s => document.querySelector(s);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

let capToken = 0;

export const ui = {
  // 逐字字幕(theater cap 移植:标点 150ms / 字 60ms,手写颤字)
  async cap(text, kind) {
    const my = ++capToken;
    const el = $('#cap');
    el.className = '';
    void el.offsetWidth;
    el.innerHTML = '';
    el.classList.add('show');
    if (kind) el.classList.add(kind);
    for (const ch of text) {
      if (my !== capToken) return;
      if (ch === ' ' || ch === '\n') el.appendChild(document.createTextNode(ch));
      else {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        s.style.transform = 'rotate(' + (Math.random() * 5 - 2.5).toFixed(1) + 'deg) translateY(' + (Math.random() * 2.4 - 1.2).toFixed(1) + 'px)';
        el.appendChild(s);
      }
      await sleep('，。？……、！'.includes(ch) ? 150 : 60);
    }
  },
  capHide() { $('#cap').classList.remove('show'); },

  title(film) {
    const el = $('#title');
    el.innerHTML = '<div class="nm">' + film.title + '</div><div class="tg">' + film.tagline + '</div>';
    el.classList.add('show');
  },
  titleHide() { $('#title').classList.remove('show'); },

  marquee(on, text = '今夜放映') {
    const el = $('#marquee');
    el.textContent = text;
    el.style.opacity = on ? 1 : 0;
  },

  deadBanner(on) { $('#deadBanner').style.opacity = on ? 0.9 : 0; },

  // 倒计时呼吸圈 + 末 4 拍心跳(theater countbeat 的视觉化)
  async countdownBeat(ms) {
    const ring = $('#countRing');
    const fg = ring.querySelector('.fgc');
    const C = 169.6;
    ring.style.opacity = 1;
    const t0 = performance.now();
    const n = Math.max(1, Math.round(ms / 820));
    let beats = 0;
    const timer = setInterval(() => {
      beats++;
      if (beats >= n - 4) sfx.beat();
      if (sfx.ready && beats >= n - 4) sfx.heartbeat(0);
    }, ms / n);
    await new Promise(res => {
      const step = () => {
        const k = Math.min((performance.now() - t0) / ms, 1);
        fg.style.strokeDashoffset = String(C * k);
        k < 1 ? requestAnimationFrame(step) : res();
      };
      step();
    });
    clearInterval(timer);
    ring.style.opacity = 0;
    fg.style.strokeDashoffset = '0';
  },

  // 选项按钮组:resolve(value);expire 毫秒超时 resolve(null);可反复改选(confirmOnPick=false 时)
  choices(items, { expire = null, confirmOnPick = true } = {}) {
    const box = $('#choices');
    box.innerHTML = '';
    box.classList.add('show');
    return new Promise(res => {
      let picked = null, timer = null;
      const finish = v => {
        box.classList.remove('show');
        if (timer) clearTimeout(timer);
        res(v);
      };
      for (const it of items) {
        const b = document.createElement('button');
        b.textContent = it.label;
        b.onclick = () => {
          if (confirmOnPick) return finish(it.value);
          picked = it.value;
          [...box.children].forEach(x => x.classList.toggle('on', x === b));
        };
        box.appendChild(b);
      }
      if (expire != null) timer = setTimeout(() => finish(picked), expire);
    });
  },
  choicesHide() { $('#choices').classList.remove('show'); },

  holdHint(text) {
    const el = $('#holdHint');
    if (!text) { el.classList.remove('show'); return; }
    el.textContent = text;
    el.classList.add('show');
  },

  settle({ surviveLine, aliveCount, playerAlive, mode }) {
    const el = $('#settle');
    el.querySelector('.sv').textContent = surviveLine;
    const you = mode === 'play' ? (playerAlive ? '你活到了散场' : '你没能走出去') : '';
    el.querySelector('.st').textContent = `生还 ${aliveCount} 人${you ? ' · ' + you : ''}`;
    el.classList.add('show');
    return new Promise(res => { $('#again').onclick = () => { el.classList.remove('show'); res(); }; });
  },

  gateHide() {
    const g = $('#gate');
    g.style.opacity = 0;
    g.style.pointerEvents = 'none';
    setTimeout(() => g.style.display = 'none', 1500);
  },
  gateShow() {
    const g = $('#gate');
    g.style.display = 'flex';
    g.style.pointerEvents = 'auto';
    void g.offsetWidth;
    g.style.opacity = 1;
  },
};
