// 剧本数据结构测试:node --test cinema3d/test/
import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { FILMS, COLORS, CURTAINS, CLOTH_HEX, ruleText } from '../src/data/films.js';

const ROOT = join(import.meta.dirname, '../..');

test('三部电影结构完整', () => {
  assert.equal(Object.keys(FILMS).length, 3);
  for (const [id, f] of Object.entries(FILMS)) {
    assert.ok(f.title && f.tagline && f.bg && f.survive, id + ' 基础字段');
    assert.equal(f.story.length, 5, id + ' 序章 5 句');
    assert.equal(f.motif.length, 3, id + ' motif 3 句');
    assert.equal(f.acts.length, 5, id + ' 五幕');
    assert.equal(f.acts[0].k, 'color', id + ' 首幕 color');
    assert.equal(f.acts.at(-1).k, 'final', id + ' 末幕 final');
    assert.equal(f.asides.length, 3, id + ' asides 3 句');
    for (const a of f.acts) assert.ok(existsSync(join(ROOT, a.proj)), id + ' 投影图存在: ' + a.proj);
    assert.ok(existsSync(join(ROOT, f.bg)), id + ' 背景图存在: ' + f.bg);
  }
});

test('幕型全集合法(无 quiz/vote)', () => {
  const LEGAL = new Set(['color', 'hold', 'split', 'split_few', 'dilemma', 'trap', 'number', 'final']);
  for (const f of Object.values(FILMS))
    for (const a of f.acts) assert.ok(LEGAL.has(a.k), '非法幕型: ' + a.k);
});

test('衣色表覆盖全色', () => {
  for (const c of COLORS) assert.ok(CLOTH_HEX[c] !== undefined, c);
});

test('幕布色是合法衣色', () => {
  for (const cu of CURTAINS) assert.ok(COLORS.includes(cu.c), cu.label);
});

test('首版只开无声疗养院', () => {
  assert.ok(FILMS['silent-ward'].enabled);
  assert.ok(!FILMS['mirror'].enabled);
  assert.ok(!FILMS['back-row'].enabled);
});

test('ruleText 模板替换', () => {
  assert.equal(ruleText('今晚{color}是病危色', { color: '红' }), '今晚红是病危色');
  assert.equal(ruleText('无占位', {}), '无占位');
});

test('trap 幕带 mid 中段文案', () => {
  const trap = FILMS['mirror'].acts.find(a => a.k === 'trap');
  assert.ok(trap.mid && trap.mid.length > 4);
});
