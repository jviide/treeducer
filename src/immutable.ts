type Cmp<V, R> = (a: V, b: V, am: R, bm: R) => number;
type Mapper<V, M> = (a: V) => M;
type Reducer<M> = (a: M, b: M) => M;

export type Config<V, R> = {
  readonly cmp: Cmp<V, R>;
  readonly map: Mapper<V, R>;
  readonly reduce: Reducer<R>;
};

function copyConfig<V, R>(config: Config<V, R>): Config<V, R> {
  return {
    cmp: config.cmp,
    map: config.map,
    reduce: config.reduce
  };
}

class Mutable<V, R> {
  _root?: Node<V, R>;
  _config?: Config<V, R>;

  constructor(_config: Config<V, R>) {
    this._root = undefined;
    this._config = _config;
  }

  reduce(): R | undefined {
    return this._root && this._root.reduce();
  }

  insert(value: V): void {
    if (!this._config) {
      throw new Error();
    }
    const mapped = this._config.map(value);
    const newNode = new Node(value, this._config, mapped, mapped, undefined, undefined, 1);
    this._root = insert(this._root, newNode);
  }

  delete(value: V): boolean {
    if (!this._config) {
      throw new Error();
    }
    if (!this._root) {
      return false;
    }
    const mapped = this._config.map(value);
    const result = delete_(this._config, this._root, value, mapped);
    if (!result) {
      return false;
    }
    this._root = result.root;
    return true;
  }

  update(from: V, to: V): boolean {
    if (!this._config) {
      throw new Error();
    }
    if (!this._root) {
      return false;
    }
    const result = delete_(this._config, this._root, from, this._config.map(from));
    if (!result) {
      return false;
    }
    const node = unlock(this._config, result.detached);
    const toMapped = this._config.map(to);
    node.value = to;
    node._mapped = toMapped;
    node._reduced = toMapped;
    node.left = undefined;
    node.right = undefined;
    node._level = 1;
    this._root = insert(result.root, node);
    return true;
  }

  forEach(func: (value: V) => void, thisArg?: unknown): void {
    if (!this._config) {
      throw new Error();
    }
    if (this._root) {
      this._root.forEach(func, this);
    }
  }
}

class Empty<V, R> {
  constructor(readonly _config: Config<V, R>) {}

  reduce(): undefined {
    return undefined;
  }

  insert(value: V): Node<V, R> {
    const mapped = this._config.map(value);
    return new Node(value, this._config, mapped, mapped, undefined, undefined, 1);
  }

  delete(value: V): Empty<V, R> {
    return this;
  }

  update(from: V, to: V): Empty<V, R> {
    return this;
  }

  forEach(func: (value: V) => void, thisArg?: unknown): void {
    return;
  }

  withMutations(mutator: (mutable: Mutable<V, R>) => Promise<void>): Promise<Treeducer<V, R>>;
  withMutations(mutator: (mutable: Mutable<V, R>) => void): Treeducer<V, R>;
  withMutations(mutator: (mutable: Mutable<V, R>) => void | Promise<void>): unknown {
    const mutable = new Mutable(this._config);
    const result = mutator(mutable);
    if (result && typeof result.then === "function") {
      return result.then(() => {
        mutable._config = undefined;
        return mutable._root || this;
      });
    }
    mutable._config = undefined;
    return mutable._root || this;
  }
}

class Node<V, R> {
  value: V;
  _config: Config<V, R>;
  _mapped: R;
  _reduced: R;
  left?: Node<V, R>;
  right?: Node<V, R>;
  _level: number;

  constructor(
    value: V,
    _config: Config<V, R>,
    _mapped: R,
    _reduced: R,
    left: Node<V, R> | undefined,
    right: Node<V, R> | undefined,
    _level: number
  ) {
    this.value = value;
    this._config = _config;
    this._mapped = _mapped;
    this._reduced = _reduced;
    this.left = left;
    this.right = right;
    this._level = _level;
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

  insert(value: V): Node<V, R> {
    const config = copyConfig(this._config);
    const mapped = config.map(value);
    const newNode = new Node(value, config, mapped, mapped, undefined, undefined, 1);
    return insert(this, newNode);
  }

  delete(value: V): Node<V, R> | Empty<V, R> {
    const config = copyConfig(this._config);
    const result = delete_(config, this, value, config.map(value));
    if (!result) {
      return this;
    }
    return result.root || new Empty(this._config);
  }

  update(from: V, to: V): Node<V, R> {
    const root = this.delete(from);
    if (root === this) {
      return this;
    }
    return root.insert(to);
  }

  withMutations(mutator: (mutable: Mutable<V, R>) => Promise<void>): Promise<Treeducer<V, R>>;
  withMutations(mutator: (mutable: Mutable<V, R>) => void): Treeducer<V, R>;
  withMutations(mutator: (mutable: Mutable<V, R>) => void | Promise<void>): unknown {
    const mutable = new Mutable(copyConfig(this._config));
    mutable._root = this;

    const result = mutator(mutable);
    if (result && typeof result.then === "function") {
      return result.then(() => {
        mutable._config = undefined;
        return mutable._root || new Empty(this._config);
      });
    }

    mutable._config = undefined;
    return mutable._root || new Empty(this._config);
  }
}

function delete_<V, R>(
  config: Config<V, R>,
  node: Node<V, R>,
  value: V,
  mapped: R
): { root?: Node<V, R>; detached: Node<V, R> } | undefined {
  let cmp = node._config.cmp(value, node.value, mapped, node._mapped);
  if (cmp === 0) {
    if (!node.left) {
      return { root: node.right, detached: node };
    }
    const min = detachMin(config, node.right!);
    const root = unlock(config, min.detached);
    root.left = node.left;
    root.right = min.root;
    root._level = node._level;
    min.root = rebalance(config, rereduce(root));
    min.detached = node;
    return min;
  } else if (cmp < 0) {
    if (!node.left) {
      return undefined;
    }
    const result = delete_(config, node.left, value, mapped);
    if (result) {
      const root = unlock(config, node);
      root.left = result.root;
      result.root = rebalance(config, rereduce(root));
    }
    return result;
  } else {
    if (!node.right) {
      return undefined;
    }
    const result = delete_(config, node.right, value, mapped);
    if (result) {
      const root = unlock(config, node);
      root.right = result.root;
      result.root = rebalance(config, rereduce(root));
    }
    return result;
  }
}

function rebalance<V, R>(config: Config<V, R>, root: Node<V, R>): Node<V, R> {
  let node = root;
  const shouldBe = Math.min(node.left ? node.left._level : 0, node.right ? node.right._level : 0) + 1;
  if (shouldBe >= node._level) {
    return node;
  }

  let right = node.right;
  if (right && shouldBe < right._level) {
    right = unlock(config, right);
    right._level = shouldBe;
  }

  node = unlock(config, node);
  node._level = shouldBe;
  node.right = right;

  node = skew(config, node);
  if (node.right) {
    right = skew(config, node.right);
    if (right.right) {
      const rr = skew(config, right.right);
      if (rr !== right.right) {
        right = unlock(config, right);
        right.right = rr;
      }
    }
    node.right = right;
  }

  node = split(config, node);
  if (node.right) {
    node.right = split(config, node.right);
  }
  return node;
}

function detachMin<V, R>(config: Config<V, R>, node: Node<V, R>): { root?: Node<V, R>; detached: Node<V, R> } {
  if (!node.left) {
    return { root: node.right, detached: node };
  }
  const min = detachMin(config, node.left);
  const root = unlock(config, node);
  root.left = min.root;
  min.root = rebalance(config, rereduce(root));
  return min;
}

function unlock<V, R>(config: Config<V, R>, node: Node<V, R>): Node<V, R> {
  if (config === node._config) {
    return node;
  }
  return new Node(node.value, config, node._mapped, node._reduced, node.left, node.right, node._level);
}

function insert<V, R>(parent: Node<V, R> | undefined, newNode: Node<V, R>): Node<V, R> {
  if (!parent) {
    return newNode;
  }
  const config = newNode._config;

  let node = unlock(config, parent);
  const cmp = node._config.cmp(newNode.value, node.value, newNode._mapped, node._mapped);
  if (cmp < 0) {
    node.left = insert(node.left, newNode);
  } else {
    node.right = insert(node.right, newNode);
  }

  return split(config, skew(config, rereduce(node)));
}

function rereduce<V, R>(node: Node<V, R>): Node<V, R> {
  const left = node.left;
  const right = node.right;

  let reduced = node._mapped;
  if (left) {
    reduced = node._config.reduce(reduced, left._reduced);
  }
  if (right) {
    reduced = node._config.reduce(reduced, right._reduced);
  }
  node._reduced = reduced;
  return node;
}

function split<V, R>(config: Config<V, R>, node: Node<V, R>): Node<V, R> {
  const right = node.right;
  if (!right || !right.right || node._level !== right.right._level) {
    return node;
  }

  const root = unlock(config, right);
  root._level += 1;
  root._reduced = node._reduced;

  const left = unlock(config, node);
  left.right = right.left;

  root.left = rereduce(left);
  return root;
}

function skew<V, R>(config: Config<V, R>, node: Node<V, R>): Node<V, R> {
  const left = node.left;
  if (!left || node._level !== left._level) {
    return node;
  }

  const root = unlock(config, left);
  root._reduced = node._reduced;

  const right = unlock(config, node);
  right.left = root.right;

  root.right = rereduce(right);
  return root;
}

export interface MutableTreeducer<V, R> {
  reduce(): R | undefined;
  insert(value: V): void;
  delete(value: V): boolean;
  update(value: V): boolean;
  forEach(func: (value: V) => void, thisArg?: unknown): void;
}
export const MutableTreeducer = Mutable as {
  new <V, R>(config: Config<V, R>): MutableTreeducer<V, R>;
};
export interface Treeducer<V, R> {
  reduce(): R | undefined;
  insert(value: V): Treeducer<V, R>;
  delete(value: V): Treeducer<V, R>;
  update(from: V, to: V): Treeducer<V, R>;
  forEach(func: (value: V) => void, thisArg?: unknown): void;
  withMutations(mutator: (mutable: Mutable<V, R>) => Promise<void>): Promise<Treeducer<V, R>>;
  withMutations(mutator: (mutable: Mutable<V, R>) => void): Treeducer<V, R>;
}
export const Treeducer = Empty as {
  new <V, R>(config: Config<V, R>): Treeducer<V, R>;
};
