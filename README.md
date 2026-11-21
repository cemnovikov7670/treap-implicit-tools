# treap-implicit-tools

An indexed sequence with O(log n) split, merge, range reversal, and range swap, backed by an implicit treap.

```js
import { ImplicitTreap } from './src/index.js';

const seq = new ImplicitTreap(['a', 'b', 'c', 'd', 'e']);

seq.reverse(1, 4);          // reverse positions [1, 4)
console.log(seq.toArray()); // ['a', 'd', 'c', 'b', 'e']

seq.swapRanges(0, 2, 3, 5); // swap [0, 2) with [3, 5)
console.log(seq.toArray()); // ['b', 'e', 'c', 'a', 'd']

seq.insert(2, 'x');
seq.set(0, 'A');
console.log(seq.removeAt(1)); // 'e'
console.log(seq.toArray());   // ['A', 'x', 'c', 'a', 'd']
```

## Why this exists

A plain array is fine until you need to reverse or swap a range repeatedly. `splice` copies every element after the cut, so a reversal of the middle of a large array is O(n) each time. An implicit treap stores a subtree size at every node and uses that size as the implicit key, which makes split and merge O(log n) expected. A range reversal becomes three splits, a lazy flag toggle, and three merges. The trade-off is constant-factor overhead and a randomized balance guarantee: every operation is fast with high probability, but a single operation can in principle be slow if the random priorities happen to produce a degenerate tree.

## API

All indices are zero-based. Ranges are half-open: `[start, end)`.

- `new ImplicitTreap(values?, random?)` — build from an optional array. `random` is an optional `() => number` priority source; it defaults to `Math.random`. Pass a deterministic function if you want reproducible tree shapes.
- `get size` — number of elements.
- `get(index)` — element at `index`.
- `set(index, value)` — replace the element at `index`.
- `insert(index, value)` — insert so the value ends up at `index`; `index === size` appends.
- `removeAt(index)` — remove and return the element at `index`.
- `reverse(start, end)` — reverse `[start, end)` in place.
- `swapRanges(aStart, aEnd, bStart, bEnd)` — swap two disjoint ranges.
- `toArray()` — the sequence in logical order.

Out-of-range indices and malformed ranges throw `RangeError`.

## The awkward edge

`swapRanges` requires the two ranges to be disjoint and given in order: `aEnd <= bStart`. Overlapping ranges have no single obvious meaning (do you swap the overlap with itself?), and swapping ranges given in the wrong order would silently produce a different result than the same call with the arguments sorted. Rather than guess, the library throws. If you have two ranges that might arrive in either order, sort them by start before calling.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

