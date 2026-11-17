/**
 * An implicit treap: a randomized balanced binary search tree keyed by the
 * position of each element rather than by the element's value.
 *
 * Why a treap instead of a plain array?
 *
 *   - Splitting an array at an index and merging two arrays are O(n) with
 *     Array.prototype.splice, because every element after the cut has to move.
 *   - A treap stores a subtree size at each node, so split and merge are O(log n)
 *     expected. That makes range reversals and range swaps cheap: reverse the
 *     range [l, r) by splitting into A | B | C, flipping a lazy flag on B, and
 *     merging back. Swap two ranges the same way.
 *
 * Expected O(log n) per operation relies on priority being a uniformly random
 * permutation of the inserted positions. We use Math.random() for priorities,
 * which is not cryptographically random but is fine for balancing. If you need
 * deterministic behaviour, pass a custom `random` function to the constructor.
 *
 * Lazy reversal is the subtle part. A node carries a `reversed` flag meaning
 * "the logical order of my subtree is the reverse of the stored order". The
 * flag is pushed down before descending into children, and children swap
 * places when it is applied. Reading an element at an index must push flags
 * along the path, otherwise the reported order is wrong.
 */

/**
 * @template T
 */
class Node {
  /**
   * @param {T} value
   * @param {number} priority
   */
  constructor(value, priority) {
    this.value = value;
    this.priority = priority;
    this.size = 1;
    this.reversed = false;
    /** @type {Node<T> | null} */
    this.left = null;
    /** @type {Node<T> | null} */
    this.right = null;
  }
}

/**
 * @param {Node<any> | null} node
 * @returns {number}
 */
function sizeOf(node) {
  return node === null ? 0 : node.size;
}

/**
 * Recompute the cached subtree size from the children.
 * @param {Node<any>} node
 */
function pull(node) {
  node.size = 1 + sizeOf(node.left) + sizeOf(node.right);
}

/**
 * Apply the pending reversal to a node's children and clear the flag.
 *
 * The flag itself does not swap the node's children; it says "when you next
 * need to look at my children, treat them as already swapped". Pushing is
 * therefore idempotent and cheap: after this call the node is in normal
 * orientation and its children carry the pending flag.
 *
 * @param {Node<any> | null} node
 */
function push(node) {
  if (node === null || !node.reversed) {
    return;
  }
  const tmp = node.left;
  node.left = node.right;
  node.right = tmp;
  if (node.left !== null) {
    node.left.reversed = !node.left.reversed;
  }
  if (node.right !== null) {
    node.right.reversed = !node.right.reversed;
  }
  node.reversed = false;
}

/**
 * Split `root` into two trees: the first `count` elements and the rest.
 *
 * @template T
 * @param {Node<T> | null} root
 * @param {number} count
 * @returns {[Node<T> | null, Node<T> | null]}
 */
function split(root, count) {
  if (root === null) {
    return [null, null];
  }
  push(root);
  const leftSize = sizeOf(root.left);
  if (count <= leftSize) {
    const [a, b] = split(root.left, count);
    root.left = b;
    pull(root);
    return [a, root];
  }
  const [a, b] = split(root.right, count - leftSize - 1);
  root.right = a;
  pull(root);
  return [root, b];
}

/**
 * Merge two trees whose logical order is `left` then `right`.
 *
 * All keys in `left` must precede all keys in `right`; the caller guarantees
 * this by construction. The heap property on priority decides which root wins.
 *
 * @template T
 * @param {Node<T> | null} left
 * @param {Node<T> | null} right
 * @returns {Node<T> | null}
 */
function merge(left, right) {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  if (left.priority >= right.priority) {
    push(left);
    left.right = merge(left.right, right);
    pull(left);
    return left;
  }
  push(right);
  right.left = merge(left, right.left);
  pull(right);
  return right;
}

/**
 * An indexed sequence backed by an implicit treap.
 *
 * All indices are zero-based. Range arguments are half-open: `[start, end)`.
 *
 * @template T
 */
export class ImplicitTreap {
  /**
   * @param {T[]} [values] initial contents, in order
   * @param {() => number} [random] source of priorities; defaults to Math.random
   */
  constructor(values = [], random = Math.random) {
    this._random = random;
    /** @type {Node<T> | null} */
    this._root = null;
    // Build in O(n) by merging one node at a time. For small inputs this is
    // indistinguishable from a linear-time Cartesian-tree build and keeps the
    // code small; the merge path is the same one used everywhere else.
    for (const value of values) {
      this._root = merge(this._root, new Node(value, random()));
    }
  }

  /**
   * Number of elements currently stored.
   * @returns {number}
   */
  get size() {
    return sizeOf(this._root);
  }

  /**
   * @param {number} index
   * @returns {T}
   */
  get(index) {
    this._checkIndex(index);
    let node = this._root;
    let remaining = index;
    while (node !== null) {
      push(node);
      const leftSize = sizeOf(node.left);
      if (remaining === leftSize) {
        return node.value;
      }
      if (remaining < leftSize) {
        node = node.left;
      } else {
        remaining -= leftSize + 1;
        node = node.right;
      }
    }
    // The index was validated against `size`, so reaching here means the
    // subtree sizes and the traversal disagree, which is a bug in this file.
    throw new Error('implicit treap invariant violated: index not found');
  }

  /**
   * Replace the element at `index`.
   * @param {number} index
   * @param {T} value
   */
  set(index, value) {
    this._checkIndex(index);
    const [left, rest] = split(this._root, index);
    const [target, right] = split(rest, 1);
    // target is guaranteed non-null because index < size.
    target.value = value;
    this._root = merge(left, merge(target, right));
  }

  /**
   * Insert `value` so that it ends up at position `index`.
   * `index === size` appends.
   * @param {number} index
   * @param {T} value
   */
  insert(index, value) {
    if (!Number.isInteger(index) || index < 0 || index > this.size) {
      throw new RangeError(`insert index ${index} out of range [0, ${this.size}]`);
    }
    const [left, right] = split(this._root, index);
    const node = new Node(value, this._random());
    this._root = merge(merge(left, node), right);
  }

  /**
   * Remove and return the element at `index`.
   * @param {number} index
   * @returns {T}
   */
  removeAt(index) {
    this._checkIndex(index);
    const [left, rest] = split(this._root, index);
    const [target, right] = split(rest, 1);
    this._root = merge(left, right);
    return target.value;
  }

  /**
   * Reverse the elements in `[start, end)` in place.
   *
   * Reversing an empty or single-element range is a no-op; the split/merge
   * still runs but the lazy flag on a one-node tree only swaps two nulls.
   * @param {number} start
   * @param {number} end
   */
  reverse(start, end) {
    this._checkRange(start, end);
    if (end - start <= 1) {
      return;
    }
    const [left, rest] = split(this._root, start);
    const [middle, right] = split(rest, end - start);
    middle.reversed = !middle.reversed;
    this._root = merge(left, merge(middle, right));
  }

  /**
   * Swap the elements in `[aStart, aEnd)` with those in `[bStart, bEnd)`.
   *
   * The two ranges must be disjoint. This implementation requires `aEnd <= bStart`
   * (the first range comes entirely before the second) so that it can split the
   * sequence into five pieces A | B | C | D | E and recombine as A | D | C | B | E.
   * Swapping overlapping ranges is ambiguous and is rejected.
   *
   * @param {number} aStart
   * @param {number} aEnd
   * @param {number} bStart
   * @param {number} bEnd
   */
  swapRanges(aStart, aEnd, bStart, bEnd) {
    this._checkRange(aStart, aEnd);
    this._checkRange(bStart, bEnd);
    if (aEnd > bStart) {
      throw new RangeError(
        `ranges must be disjoint and ordered: got [${aStart}, ${aEnd}) and [${bStart}, ${bEnd})`,
      );
    }
    if (aStart === aEnd || bStart === bEnd) {
      return;
    }
    const [a, rest1] = split(this._root, aStart);
    const [b, rest2] = split(rest1, aEnd - aStart);
    const [c, rest3] = split(rest2, bStart - aEnd);
    const [d, e] = split(rest3, bEnd - bStart);
    this._root = merge(merge(merge(merge(a, d), c), b), e);
  }

  /**
   * Materialize the sequence in logical order.
   * @returns {T[]}
   */
  toArray() {
    /** @type {T[]} */
    const out = [];
    const stack = [];
    /** @type {Node<T> | null} */
    let node = this._root;
    // In-order traversal without recursion. Push flags before descending so
    // the emitted order reflects any pending reversals.
    while (node !== null || stack.length > 0) {
      while (node !== null) {
        push(node);
        stack.push(node);
        node = node.left;
      }
      node = stack.pop();
      out.push(node.value);
      node = node.right;
    }
    return out;
  }

  /**
   * @param {number} index
   */
  _checkIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(`index ${index} out of range [0, ${this.size})`);
    }
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  _checkRange(start, end) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new RangeError(`range bounds must be integers: got [${start}, ${end})`);
    }
    if (start < 0 || end < start || end > this.size) {
      throw new RangeError(`range [${start}, ${end}) out of bounds for size ${this.size}`);
    }
  }
}
