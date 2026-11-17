import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ImplicitTreap } from '../src/index.js';

/**
 * Deterministic priority source. A treap's shape depends on the priorities, and
 * Math.random() would make the shape (and therefore any shape-sensitive bug)
 * flaky. This linear congruential generator gives a fixed, reproducible stream.
 */
function fixedRandom(seed = 12345) {
  let state = seed >>> 0;
  return () => {
    // Numerical Recipes LCG constants; only the high bits are used.
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function make(values) {
  return new ImplicitTreap(values, fixedRandom());
}

test('empty treap has size 0 and empty array', () => {
  const t = make([]);
  assert.equal(t.size, 0);
  assert.deepEqual(t.toArray(), []);
});

test('constructor preserves order', () => {
  const t = make(['a', 'b', 'c', 'd']);
  assert.equal(t.size, 4);
  assert.deepEqual(t.toArray(), ['a', 'b', 'c', 'd']);
});

test('get reads each position', () => {
  const t = make([10, 20, 30, 40]);
  assert.equal(t.get(0), 10);
  assert.equal(t.get(1), 20);
  assert.equal(t.get(2), 30);
  assert.equal(t.get(3), 40);
});

test('get rejects out-of-range indices', () => {
  const t = make([1, 2, 3]);
  assert.throws(() => t.get(-1), RangeError);
  assert.throws(() => t.get(3), RangeError);
  assert.throws(() => t.get(1.5), RangeError);
});

test('set replaces a value without changing the rest', () => {
  const t = make([1, 2, 3, 4]);
  t.set(2, 99);
  assert.deepEqual(t.toArray(), [1, 2, 99, 4]);
});

test('insert at the front, middle, and end', () => {
  const t = make([2, 3]);
  t.insert(0, 1);
  t.insert(2, 99);
  t.insert(4, 4);
  assert.deepEqual(t.toArray(), [1, 2, 99, 3, 4]);
  assert.equal(t.size, 5);
});

test('insert rejects an index past the end', () => {
  const t = make([1, 2]);
  assert.throws(() => t.insert(3, 9), RangeError);
  assert.throws(() => t.insert(-1, 9), RangeError);
});

test('removeAt returns the removed value and shrinks the sequence', () => {
  const t = make(['a', 'b', 'c', 'd']);
  assert.equal(t.removeAt(1), 'b');
  assert.deepEqual(t.toArray(), ['a', 'c', 'd']);
  assert.equal(t.size, 3);
  assert.equal(t.removeAt(2), 'd');
  assert.deepEqual(t.toArray(), ['a', 'c']);
});

test('reverse flips a middle range', () => {
  const t = make([1, 2, 3, 4, 5]);
  t.reverse(1, 4);
  assert.deepEqual(t.toArray(), [1, 4, 3, 2, 5]);
});

test('reverse of the whole sequence', () => {
  const t = make([1, 2, 3, 4]);
  t.reverse(0, 4);
  assert.deepEqual(t.toArray(), [4, 3, 2, 1]);
});

test('reverse of an empty or single-element range is a no-op', () => {
  const t = make([1, 2, 3]);
  t.reverse(1, 1);
  t.reverse(2, 3);
  assert.deepEqual(t.toArray(), [1, 2, 3]);
});

test('two reverses restore the original order', () => {
  const t = make([1, 2, 3, 4, 5]);
  t.reverse(0, 3);
  t.reverse(0, 3);
  assert.deepEqual(t.toArray(), [1, 2, 3, 4, 5]);
});

test('reverse then read individual elements', () => {
  const t = make([1, 2, 3, 4, 5]);
  t.reverse(0, 5);
  assert.equal(t.get(0), 5);
  assert.equal(t.get(4), 1);
});

test('swapRanges exchanges two disjoint blocks', () => {
  const t = make([1, 2, 3, 4, 5, 6, 7]);
  // swap [1, 3) with [4, 6)
  t.swapRanges(1, 3, 4, 6);
  assert.deepEqual(t.toArray(), [1, 5, 6, 4, 2, 3, 7]);
});

test('swapRanges with adjacent ranges', () => {
  const t = make([1, 2, 3, 4]);
  t.swapRanges(0, 2, 2, 4);
  assert.deepEqual(t.toArray(), [3, 4, 1, 2]);
});

test('swapRanges with an empty range is a no-op', () => {
  const t = make([1, 2, 3]);
  t.swapRanges(1, 1, 2, 3);
  assert.deepEqual(t.toArray(), [1, 2, 3]);
});

test('swapRanges rejects overlapping ranges', () => {
  const t = make([1, 2, 3, 4]);
  assert.throws(() => t.swapRanges(0, 3, 2, 4), RangeError);
});

test('swapRanges rejects ranges given out of order', () => {
  const t = make([1, 2, 3, 4]);
  assert.throws(() => t.swapRanges(2, 4, 0, 2), RangeError);
});

test('a long sequence of operations stays consistent', () => {
  const t = make([]);
  for (let i = 0; i < 50; i += 1) {
    t.insert(t.size, i);
  }
  assert.deepEqual(t.toArray(), Array.from({ length: 50 }, (_, i) => i));

  t.reverse(10, 40);
  const expected = Array.from({ length: 50 }, (_, i) => i);
  const reversedPart = expected.slice(10, 40).reverse();
  expected.splice(10, 30, ...reversedPart);
  assert.deepEqual(t.toArray(), expected);

  t.swapRanges(0, 5, 45, 50);
  const afterSwap = expected.slice();
  const first = afterSwap.slice(0, 5);
  const last = afterSwap.slice(45, 50);
  afterSwap.splice(0, 5, ...last);
  afterSwap.splice(45, 5, ...first);
  assert.deepEqual(t.toArray(), afterSwap);
});

test('removeAt on the last remaining element empties the treap', () => {
  const t = make([42]);
  assert.equal(t.removeAt(0), 42);
  assert.equal(t.size, 0);
  assert.deepEqual(t.toArray(), []);
});

test('reverse then insert keeps positions correct', () => {
  const t = make([1, 2, 3, 4]);
  t.reverse(0, 4);
  assert.deepEqual(t.toArray(), [4, 3, 2, 1]);
  t.insert(2, 99);
  assert.deepEqual(t.toArray(), [4, 3, 99, 2, 1]);
  assert.equal(t.get(2), 99);
});
