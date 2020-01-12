type Cmp<V, R> = (a: V, b: V, am: R, bm: R) => number;
type Mapper<V, M> = (a: V) => M;
type Reducer<M> = (a: M, b: M) => M;

type Config<V, R> = {
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

  select(cmp?: (value: V) => number): Selection<V, R> {
    if (!this._config) {
      throw new Error();
    }
    this._config = copyConfig(this._config);
    return new Selection(undefined, this._root);
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
}

class Empty<V, R> {
  constructor(readonly _config: Config<V, R>) {}

  select(cmp?: (value: V) => number): Selection<V, R> {
    return new Selection(cmp, undefined);
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

  withMutations(mutator: (mutable: MutableTreeducer<V, R>) => Promise<void>): Promise<Treeducer<V, R>>;
  withMutations(mutator: (mutable: MutableTreeducer<V, R>) => void): Treeducer<V, R>;
  withMutations(mutator: (mutable: MutableTreeducer<V, R>) => void | Promise<void>): unknown {
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

  select(cmp?: (value: V) => number): Selection<V, R> {
    return new Selection(cmp, this);
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

  withMutations(mutator: (mutable: MutableTreeducer<V, R>) => Promise<void>): Promise<Treeducer<V, R>>;
  withMutations(mutator: (mutable: MutableTreeducer<V, R>) => void): Treeducer<V, R>;
  withMutations(mutator: (mutable: MutableTreeducer<V, R>) => void | Promise<void>): unknown {
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

function find<V, R>(root: Node<V, R> | undefined, cmp: (value: V) => number, first: boolean): V | undefined {
  let node = root;
  let value: V | undefined;
  while (node) {
    const result = cmp(node.value);
    if (result > 0) {
      node = node.left;
    } else if (result < 0) {
      node = node.right;
    } else {
      value = node.value;
      node = first ? node.left : node.right;
    }
  }
  return value;
}

function iterate<V, R>(
  node: Node<V, R> | undefined,
  cmp: (value: V) => number,
  allLeft: boolean,
  allRight: boolean
): Iterator<V, undefined> {
  const stack: unknown[] = [];
  let current: Node<V, R> | undefined = node;
  let left = allLeft;
  let right = allRight;

  return {
    next() {
      while (current) {
        const value = current.value;
        const result = left && right ? 0 : cmp(value);

        if (result > 0) {
          current = current.left;
        } else if (result < 0) {
          current = current.right;
        } else if (current.left) {
          stack.push(value, current.right, right);
          current = current.left;
          right = true;
        } else {
          current = current.right;
          left = true;
          return { done: false, value };
        }
      }
      if (stack.length !== 0) {
        left = true;
        right = stack.pop() as boolean;
        current = stack.pop() as Node<V, R> | undefined;
        return { done: false, value: stack.pop() as V };
      }
      return { done: true, value: undefined };
    }
  };
}

function reduce<V, R>(
  node: Node<V, R>,
  cmp: (value: V) => number,
  allLeft: boolean,
  allRight: boolean
): { found: boolean; reduced: R | undefined } {
  if (allLeft && allRight) {
    return { found: true, reduced: node._reduced };
  }

  const comparison = cmp(node.value);
  let found = comparison === 0;
  let reduced = found ? node._mapped : undefined;
  if (comparison >= 0 && node.left) {
    const left = reduce(node.left, cmp, allLeft, comparison === 0);
    if (left.found) {
      reduced = found ? node._config.reduce(left.reduced!, reduced!) : left.reduced;
      found = true;
    }
  }
  if (comparison <= 0 && node.right) {
    const right = reduce(node.right, cmp, comparison === 0, allRight);
    if (right.found) {
      reduced = found ? node._config.reduce(right.reduced!, reduced!) : right.reduced;
      found = true;
    }
  }
  return { found, reduced };
}

class Selection<V, R> {
  constructor(
    private readonly _cmp = (value: V) => 0,
    private readonly _root?: Node<V, R>,
    private readonly _allLeft: boolean = false,
    private readonly _allRight: boolean = false
  ) {}

  first(): V | undefined {
    return find(this._root, this._cmp, true);
  }
  last(): V | undefined {
    return find(this._root, this._cmp, false);
  }
  before(): Selection<V, R> {
    const cmp = this._cmp;
    return new Selection(v => (cmp(v) < 0 ? 0 : 1), this._root, true, false);
  }
  after(): Selection<V, R> {
    const cmp = this._cmp;
    return new Selection(v => (cmp(v) > 0 ? 0 : -1), this._root, false, true);
  }
  [Symbol.iterator](): Iterator<V, undefined> {
    return iterate(this._root, this._cmp, this._allLeft, this._allRight);
  }
  forEach(func: (value: V) => void, thisArg?: any) {
    const iterator = iterate(this._root, this._cmp, this._allLeft, this._allRight);
    for (let next = iterator.next(); !next.done; next = iterator.next()) {
      func.call(this, next.value);
    }
  }
  reduce(): R | undefined {
    return this._root && reduce(this._root, this._cmp, this._allLeft, this._allRight).reduced;
  }
}

export interface MutableTreeducer<V, R> {
  select(cmp?: (value: V) => number): Selection<V, R>;
  insert(value: V): void;
  delete(value: V): boolean;
  update(from: V, to: V): boolean;
}
export const MutableTreeducer = Mutable as {
  new <V, R>(config: Config<V, R>): MutableTreeducer<V, R>;
};
export interface Treeducer<V, R> {
  select(cmp?: (value: V) => number): Selection<V, R>;
  insert(value: V): Treeducer<V, R>;
  delete(value: V): Treeducer<V, R>;
  update(from: V, to: V): Treeducer<V, R>;
  withMutations(mutator: (mutable: Mutable<V, R>) => Promise<void>): Promise<Treeducer<V, R>>;
  withMutations(mutator: (mutable: Mutable<V, R>) => void): Treeducer<V, R>;
}
export const Treeducer = Empty as {
  new <V, R>(config: Config<V, R>): Treeducer<V, R>;
};
