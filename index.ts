type Cmp<V> = (a: V, b: V) => number;
type Mapper<V, M> = (a: V) => M;
type Reducer<M> = (a: M, b: M) => M;

class Tree<V, R> {
  _root?: TreeNode<V, R>;

  readonly _cmp: Cmp<V>;
  readonly _map: Mapper<V, R>;
  readonly _reduce: Reducer<R>;

  reduce(): R | undefined {
    return this._root ? this._root._reduced : undefined;
  }

  constructor(options: { cmp: Cmp<V>; map: Mapper<V, R>; reduce: Reducer<R> }) {
    this._cmp = options.cmp;
    this._map = options.map;
    this._reduce = options.reduce;
  }

  insert(value: V): TreeducerNode<V> {
    const mapped = this._map(value);
    const node = new TreeNode(this, value, mapped);

    this._root = insert(this, this._root, node);
    return node as TreeducerNode<V>;
  }

  minNode(): TreeducerNode<V> | undefined {
    let node = this._root;
    while (node && node._left) {
      node = node._left;
    }
    return node;
  }

  maxNode(): TreeducerNode<V> | undefined {
    let node = this._root;
    while (node && node._right) {
      node = node._right;
    }
    return node;
  }

  forEach(func: (value: V) => void, thisArg?: unknown): void {
    forEach(this._root, func, thisArg);
  }
}

function forEach<V>(
  node: TreeNode<V, unknown> | undefined,
  func: (value: V) => void,
  thisArg: unknown
): void {
  if (node) {
    forEach(node._left, func, thisArg);
    func.call(thisArg, node.value);
    forEach(node._right, func, thisArg);
  }
}

class TreeNode<V, R> {
  _tree?: Tree<V, R>;
  _left?: TreeNode<V, R>;
  _right?: TreeNode<V, R>;
  _parent?: TreeNode<V, R>;
  _level: number;

  value: V;
  _mapped: R;
  _reduced: R;

  constructor(tree: Tree<V, R>, value: V, mapped: R) {
    this._tree = tree;
    this.value = value;
    this._mapped = mapped;

    this._reduced = mapped;
    this._level = 1;
    this._parent = undefined;
  }

  update(newValue: V): boolean {
    const tree = this._tree;
    if (!tree) {
      return false;
    }
    this.delete();
    this._tree = tree;

    const mapped = tree._map(newValue);
    this.value = newValue;
    this._mapped = mapped;
    this._reduced = mapped;
    this._level = 1;
    tree._root = insert(tree, tree._root, this);
    return true;
  }

  delete(): boolean {
    const tree = this._tree;
    if (!tree) {
      return false;
    }

    let up = this._parent;
    if (!this._right) {
      takeParent(this, undefined);
    } else if (!this._right._left) {
      takeParent(this, this._right);
      this._right._left = this._left;
      if (this._left) {
        this._left._parent = this._right;
      }
      up = this._right;
    } else {
      let left = this._right._left;
      while (left._left) {
        left = left._left;
      }

      up = left._parent!;
      up._left = left._right;
      if (left._right) {
        left._right._parent = up;
        left._right = undefined;
      }

      takeParent(this, left);

      left._level = this._level;
      left._left = this._left;
      left._right = this._right;
      if (this._left) {
        this._left._parent = left;
      }
      if (this._right) {
        this._right._parent = left;
      }
    }

    tree._root = rebalance(tree, up);

    this._tree = undefined;
    this._parent = undefined;
    this._left = undefined;
    this._right = undefined;
    this._reduced = this._mapped;
    return true;
  }
}

function rebalance<V, R>(
  tree: Tree<V, R>,
  up?: TreeNode<V, R>
): TreeNode<V, R> | undefined {
  const reduce = tree._reduce;
  while (up) {
    rereduce(up, reduce);

    const shouldBe =
      Math.min(
        up._left ? up._left._level : 0,
        up._right ? up._right._level : 0
      ) + 1;
    if (shouldBe < up._level) {
      up._level = shouldBe;
      if (up._right && shouldBe < up._right._level) {
        up._right._level = shouldBe;
      }
    }

    up = skew(up, reduce);
    if (up._right) {
      up._right = skew(up._right, reduce);
      if (up._right._right) {
        up._right._right = skew(up._right._right, reduce);
      }
    }
    up = split(up, reduce);
    if (up._right) {
      up._right = split(up._right, reduce);
    }

    if (!up._parent) {
      return up;
    }
    up = up._parent;
  }
  return up;
}

function rereduce<V, R>(
  node: TreeNode<V, R>,
  reduce: Reducer<R>
): TreeNode<V, R> {
  let reduced = node._mapped;
  if (node._left) {
    reduced = reduce(reduced, node._left._reduced);
  }
  if (node._right) {
    reduced = reduce(reduced, node._right._reduced);
  }
  node._reduced = reduced;
  return node;
}

function insert<V, R>(
  tree: Tree<V, R>,
  root: TreeNode<V, R> | undefined,
  node: TreeNode<V, R>
): TreeNode<V, R> {
  if (!root) {
    return node;
  }

  node._parent = root;
  if (tree._cmp(node.value, root.value) < 0) {
    root._left = insert(tree, root._left, node);
  } else {
    root._right = insert(tree, root._right, node);
  }
  return split(skew(rereduce(root, tree._reduce), tree._reduce), tree._reduce);
}

function takeParent<V, R>(from: TreeNode<V, R>, to?: TreeNode<V, R>) {
  const parent = from._parent;
  if (parent) {
    if (from === parent._left) {
      parent._left = to;
    } else {
      parent._right = to;
    }
  }
  if (to) {
    to._parent = parent;
  }
}

function skew<R>(node: undefined, reduce: Reducer<R>): undefined;
function skew<V, R>(node: TreeNode<V, R>, reduce: Reducer<R>): TreeNode<V, R>;
function skew<V, R>(
  node: TreeNode<V, R> | undefined,
  reduce: Reducer<R>
): TreeNode<V, R> | undefined {
  if (!node) {
    return node;
  }
  const left = node._left;
  if (!left || node._level !== left._level) {
    return node;
  }

  takeParent(node, left);

  node._parent = left;
  if (left._right) {
    left._right._parent = node;
  }
  node._left = left._right;
  left._right = node;

  left._reduced = node._reduced;
  rereduce(node, reduce);
  return left;
}

function split<R>(node: undefined, reduce: Reducer<R>): undefined;
function split<V, R>(node: TreeNode<V, R>, reduce: Reducer<R>): TreeNode<V, R>;
function split<V, R>(
  node: TreeNode<V, R> | undefined,
  reduce: Reducer<R>
): TreeNode<V, R> | undefined {
  if (!node) {
    return node;
  }
  const right = node._right;
  if (!right || !right._right || node._level !== right._right._level) {
    return node;
  }

  takeParent(node, right);

  node._parent = right;
  if (right._left) {
    right._left._parent = node;
  }
  node._right = right._left;
  right._left = node;
  right._level += 1;

  right._reduced = node._reduced;
  rereduce(node, reduce);
  return right;
}

export interface TreeducerNode<V> {
  readonly value: V;
  delete(): boolean;
  update(newValue: V): boolean;
}
export interface Treeducer<V, R> {
  reduce(): R | undefined;
  insert(value: V): TreeducerNode<V>;
  minNode(): TreeducerNode<V> | undefined;
  maxNode(): TreeducerNode<V> | undefined;
  forEach(func: (value: V) => void, thisArg?: unknown): void;
}
export const Treeducer = Tree as {
  new <V, R>(options: {
    cmp: Cmp<V>;
    map: Mapper<V, R>;
    reduce: Reducer<R>;
  }): Treeducer<V, R>;
};
