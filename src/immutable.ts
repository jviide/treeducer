type Cmp<V, R> = (a: V, b: V, am: R, bm: R) => number;
type Mapper<V, M> = (a: V) => M;
type Reducer<M> = (a: M, b: M) => M;

export type Config<V, R> = {
  readonly cmp: Cmp<V, R>;
  readonly map: Mapper<V, R>;
  readonly reduce: Reducer<R>;
};

type Generation = {
  [K in string | number | symbol]: never;
};

class Empty<V, R> {
  constructor(readonly _config: Config<V, R>) {}

  reduce(): undefined {
    return undefined;
  }

  insert(value: V): Node<V, R> {
    const mapped = this._config.map(value);
    return new Node({}, value, this._config, mapped, mapped);
  }

  delete(value: V): Empty<V, R> {
    return this;
  }

  forEach(func: (value: V) => void, thisArg?: unknown): void {
    return;
  }
}

class Node<V, R> {
  _gen: Generation;
  value: V;
  _config: Config<V, R>;
  _mapped: R;
  _reduced: R;
  left?: Node<V, R>;
  right?: Node<V, R>;
  _level: number;

  constructor(
    _gen: Generation,
    value: V,
    _config: Config<V, R>,
    _mapped: R,
    _reduced: R,
    left?: Node<V, R> | undefined,
    right?: Node<V, R> | undefined,
    _level: number = 1
  ) {
    this._gen = _gen;
    this.value = value;
    this._config = _config;
    this._mapped = _mapped;
    this.left = left;
    this.right = right;
    this._level = _level;
    this._reduced = _reduced;
  }

  reduce(): R {
    return this._reduced;
  }

  forEach(func: (value: V) => void, thisArg?: unknown): void {
    if (this.left) {
      this.left.forEach(func, thisArg);
    }
    func.call(thisArg, this.value);
    if (this.right) {
      this.right.forEach(func, thisArg);
    }
  }

  delete(value: V): Node<V, R> | Empty<V, R> {
    const node = delete_({}, this, value, this._config.map(value));
    if (node === null) {
      return this;
    }
    return node || new Empty(this._config);
  }

  insert(value: V): Node<V, R> {
    return insert({}, this, value, this._config.map(value));
  }
}

function delete_<V, R>(gen: Generation, node: Node<V, R>, value: V, mapped: R): Node<V, R> | undefined | null {
  const cmp = node._config.cmp(value, node.value, mapped, node._mapped);
  if (cmp === 0) {
    if (!node.left) {
      return node.right;
    }
    const min = detachMin(gen, node.right!);
    const root = unlock(gen, min.detached);
    root.left = node.left;
    root.right = min.root;
    root._level = node._level;
    return rebalance(gen, rereduce(root));
  } else if (cmp < 0) {
    if (!node.left) {
      return null;
    }
    const left = delete_(gen, node.left, value, mapped);
    if (left === null) {
      return null;
    }
    const root = unlock(gen, node);
    root.left = left;
    return rebalance(gen, rereduce(root));
  } else {
    if (!node.right) {
      return null;
    }
    const right = delete_(gen, node.right, value, mapped);
    if (right === null) {
      return null;
    }
    const root = unlock(gen, node);
    root.right = right;
    return rebalance(gen, rereduce(root));
  }
}

function rebalance<V, R>(gen: Generation, root: Node<V, R>): Node<V, R> {
  let node = root;
  const shouldBe = Math.min(node.left ? node.left._level : 0, node.right ? node.right._level : 0) + 1;
  if (shouldBe >= node._level) {
    return node;
  }

  let right = node.right;
  if (right && shouldBe < right._level) {
    right = unlock(gen, right);
    right._level = shouldBe;
  }

  node = unlock(gen, node);
  node._level = shouldBe;
  node.right = right;

  node = skew(gen, node);
  right = skew(gen, node.right);
  if (right && right.right) {
    const rr = skew(gen, right.right);
    if (rr !== right.right) {
      right = unlock(gen, right);
      right.right = rr;
    }
  }

  node.right = right;
  node = split(gen, node);
  node.right = split(gen, node.right);
  return node;
}

function detachMin<V, R>(gen: Generation, node: Node<V, R>): { root?: Node<V, R>; detached: Node<V, R> } {
  if (!node.left) {
    return { root: node.right, detached: node };
  }
  const min = detachMin(gen, node.left);
  const root = unlock(gen, node);
  root.left = min.root;
  min.root = rebalance(gen, rereduce(root));
  return min;
}

function unlock<V, R>(gen: Generation, node: Node<V, R>): Node<V, R> {
  if (gen === node._gen) {
    return node;
  }
  return new Node(gen, node.value, node._config, node._mapped, node._reduced, node.left, node.right, node._level);
}

function insert<V, R>(gen: Generation, parent: Node<V, R>, value: V, mapped: R): Node<V, R> {
  let node = unlock(gen, parent);

  if (node._config.cmp(value, node.value, mapped, node._mapped) < 0) {
    node.left = node.left ? insert(gen, node.left, value, mapped) : new Node(gen, value, node._config, mapped, mapped);
  } else {
    node.right = node.right
      ? insert(gen, node.right, value, mapped)
      : new Node(gen, value, node._config, mapped, mapped);
  }
  return split(gen, skew(gen, rereduce(node)));
}

function rereduce<V, R>(node: Node<V, R>): Node<V, R> {
  let reduced = node._mapped;
  if (node.left) {
    reduced = node._config.reduce(reduced, node.left._reduced);
  }
  if (node.right) {
    reduced = node._config.reduce(reduced, node.right._reduced);
  }
  node._reduced = reduced;
  return node;
}

function split<V, R>(gen: Generation, node: Node<V, R>): Node<V, R>;
function split<V, R>(gen: Generation, node?: Node<V, R>): Node<V, R> | undefined;
function split<V, R>(gen: Generation, node?: Node<V, R>): Node<V, R> | undefined {
  if (!node) {
    return node;
  }

  const right = node.right;
  if (!right || !right.right || node._level !== right.right._level) {
    return node;
  }

  const root = unlock(gen, right);
  root._level += 1;
  root._reduced = node._reduced;

  const left = unlock(gen, node);
  left.right = right.left;

  root.left = rereduce(left);
  return root;
}

function skew<V, R>(gen: Generation, node: Node<V, R>): Node<V, R>;
function skew<V, R>(gen: Generation, node?: Node<V, R>): Node<V, R> | undefined;
function skew<V, R>(gen: Generation, node?: Node<V, R>): Node<V, R> | undefined {
  if (!node) {
    return node;
  }

  const left = node.left;
  if (!left || node._level !== left._level) {
    return node;
  }

  const root = unlock(gen, left);
  root._reduced = node._reduced;

  const right = unlock(gen, node);
  right.left = root.right;

  root.right = rereduce(right);
  return root;
}

export interface Treeducer<V, R> {
  reduce(): R | undefined;
  insert(value: V): Treeducer<V, R>;
  delete(value: V): Treeducer<V, R>;
  forEach(func: (value: V) => void, thisArg?: unknown): void;
}
export const Treeducer = Empty as {
  new <V, R>(config: Config<V, R>): Treeducer<V, R>;
};
