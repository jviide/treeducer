type Cmp<V, R> = (a: V, b: V, am: R, bm: R) => number;
type Mapper<V, M> = (a: V) => M;
type Reducer<M> = (a: M, b: M) => M;

export type Config<V, R> = {
  readonly cmp: Cmp<V, R>;
  readonly map: Mapper<V, R>;
  readonly reduce: Reducer<R>;
};

function reduced<V, R>(
  reduce: Reducer<R>,
  mapped: R,
  left?: Node<V, R>,
  right?: Node<V, R>
): R {
  let result = mapped;
  if (left) {
    result = reduce(result, left._reduced);
  }
  if (right) {
    result = reduce(result, right._reduced);
  }
  return result;
}

class Empty<V, R> {
  constructor(readonly _config: Config<V, R>) {}

  reduce(): undefined {
    return undefined;
  }

  insert(value: V): Node<V, R> {
    return new Node(value, this._config);
  }

  delete(value: V): Empty<V, R> {
    return this;
  }

  forEach(func: (value: V) => void, thisArg?: unknown): void {
    return;
  }
}

class Node<V, R> {
  constructor(
    readonly value: V,
    readonly _config: Config<V, R>,
    readonly _mapped = _config.map(value),
    readonly left?: Node<V, R>,
    readonly right?: Node<V, R>,
    readonly _level: number = 1,
    readonly _reduced = reduced(_config.reduce, _mapped, left, right)
  ) {}

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
    const node = delete_(this, value, this._config.map(value));
    return node || new Empty(this._config);
  }

  insert(value: V): Node<V, R> {
    return insert(this, value, this._config.map(value));
  }
}

function delete_<V, R>(
  node: Node<V, R>,
  value: V,
  mapped: R
): Node<V, R> | undefined {
  const cmp = node._config.cmp(value, node.value, mapped, node._mapped);
  if (cmp === 0) {
    if (!node.left) {
      return node.right;
    }
    const { root, detached } = detachMin(node.right!);
    return rebalance(
      new Node(
        detached.value,
        detached._config,
        detached._mapped,
        node.left,
        root,
        node._level
      )
    );
  } else if (cmp < 0) {
    const left = node.left && delete_(node.left, value, mapped);
    if (left === node.left) {
      return node;
    }
    return rebalance(
      new Node(
        node.value,
        node._config,
        node._mapped,
        left,
        node.right,
        node._level
      )
    );
  } else {
    const right = node.right && delete_(node.right, value, mapped);
    if (right === node.right) {
      return node;
    }
    return rebalance(
      new Node(
        node.value,
        node._config,
        node._mapped,
        node.left,
        right,
        node._level
      )
    );
  }
}

function rebalance<V, R>(root: Node<V, R>): Node<V, R> {
  let node = skew(decreaseLevel(root));

  let right = skew(node.right);
  if (right && right.right) {
    const rr = skew(right.right);
    if (rr !== right.right) {
      right = new Node(
        right.value,
        right._config,
        right._mapped,
        right.left,
        rr,
        right._level,
        right._reduced
      );
    }
  }

  if (right !== node.right) {
    node = new Node(
      node.value,
      node._config,
      node._mapped,
      node.left,
      right,
      node._level,
      node._reduced
    );
  }

  node = split(node);
  right = split(node.right && node.right);
  if (right !== node.right) {
    node = new Node(
      node.value,
      node._config,
      node._mapped,
      node.left,
      right,
      node._level,
      node._reduced
    );
  }

  return node;
}

function decreaseLevel<V, R>(node: Node<V, R>): Node<V, R> {
  const shouldBe =
    Math.min(
      node.left ? node.left._level : 0,
      node.right ? node.right._level : 0
    ) + 1;
  if (shouldBe >= node._level) {
    return node;
  }

  let right = node.right;
  if (right && shouldBe < right._level) {
    right = new Node(
      right.value,
      right._config,
      right._mapped,
      right.left,
      right.right,
      shouldBe,
      right._reduced
    );
  }

  return new Node(
    node.value,
    node._config,
    node._mapped,
    node.left,
    right,
    shouldBe,
    node._reduced
  );
}

function detachMin<V, R>(
  node: Node<V, R>
): { root?: Node<V, R>; detached: Node<V, R> } {
  if (!node.left) {
    return { root: node.right, detached: node };
  }
  const min = detachMin(node.left);
  return {
    detached: min.detached,
    root: rebalance(
      new Node(
        node.value,
        node._config,
        node._mapped,
        min.root,
        node.right,
        node._level
      )
    )
  };
}

function insert<V, R>(parent: Node<V, R>, value: V, mapped: R): Node<V, R> {
  let node: Node<V, R>;
  if (parent._config.cmp(value, parent.value, mapped, parent._mapped) < 0) {
    node = new Node(
      parent.value,
      parent._config,
      parent._mapped,
      parent.left
        ? insert(parent.left, value, mapped)
        : new Node(value, parent._config, mapped),
      parent.right,
      parent._level
    );
  } else {
    node = new Node(
      parent.value,
      parent._config,
      parent._mapped,
      parent.left,
      parent.right
        ? insert(parent.right, value, mapped)
        : new Node(value, parent._config, mapped),
      parent._level
    );
  }
  return split(skew(node));
}

function split<V, R>(node: Node<V, R>): Node<V, R>;
function split<V, R>(node?: Node<V, R>): Node<V, R> | undefined;
function split<V, R>(node?: Node<V, R>): Node<V, R> | undefined {
  if (!node) {
    return node;
  }

  const right = node.right;
  if (!right || !right.right || node._level !== right.right._level) {
    return node;
  }

  const left = new Node(
    node.value,
    node._config,
    node._mapped,
    node.left,
    right.left,
    node._level
  );

  return new Node(
    right.value,
    right._config,
    right._mapped,
    left,
    right.right,
    right._level + 1,
    node._reduced
  );
}

function skew<V, R>(node: Node<V, R>): Node<V, R>;
function skew<V, R>(node?: Node<V, R>): Node<V, R> | undefined;
function skew<V, R>(node?: Node<V, R>): Node<V, R> | undefined {
  if (!node) {
    return node;
  }

  const left = node.left;
  if (!left || node._level !== left._level) {
    return node;
  }
  const right = new Node(
    node.value,
    node._config,
    node._mapped,
    left.right,
    node.right,
    node._level
  );
  return new Node(
    left.value,
    left._config,
    left._mapped,
    left.left,
    right,
    left._level,
    node._reduced
  );
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
