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
}

class TreeNode<V, R> {
  _tree?: Tree<V, R>;
  _left?: TreeNode<V, R>;
  _right?: TreeNode<V, R>;
  _parent?: TreeNode<V, R>;
  _level: number;

  readonly value: V;
  readonly _mapped: R;
  _reduced: R;

  constructor(tree: Tree<V, R>, value: V, mapped: R) {
    this._tree = tree;
    this.value = value;
    this._mapped = mapped;

    this._reduced = mapped;
    this._level = 1;
    this._parent = undefined;
  }
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
  left._parent = node._parent;
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
  if (!right || !right._right) {
    return node;
  }
  right._parent = node._parent;
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
}
export interface Treeducer<V, R> {
  reduce(): R | undefined;
  insert(value: V): TreeducerNode<V>;
  minNode(): TreeducerNode<V> | undefined;
  maxNode(): TreeducerNode<V> | undefined;
}
export const Treeducer = Tree as {
  new <V, R>(options: {
    cmp: Cmp<V>;
    map: Mapper<V, R>;
    reduce: Reducer<R>;
  }): Treeducer<V, R>;
};
