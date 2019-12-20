import { Treeducer, Config } from "./immutable";

const MAX_SAFE_INTEGER = 9007199254740991;

function cmp(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

class Tree<V, R> {
  _root: Treeducer<Node<V, R>, R>;
  _hi: number;
  _lo: number;

  constructor(options: Config<V, R>) {
    this._root = new Treeducer({
      cmp(a, b, am, bm) {
        return options.cmp(a.value, b.value, am, bm) || cmp(a._hi, b._hi) || cmp(a._lo, b._lo);
      },
      map(a) {
        return options.map(a.value);
      },
      reduce: options.reduce
    });
    this._hi = 0;
    this._lo = 0;
  }

  reduce(): R | undefined {
    return this._root.reduce();
  }

  insert(value: V): Node<V, R> {
    const node = new Node<V, R>(this, value, this._hi, this._lo);
    if (this._lo < MAX_SAFE_INTEGER) {
      this._lo++;
    } else {
      this._hi++;
      this._lo = 0;
    }
    this._root = this._root.insert(node);
    return node;
  }

  forEach(func: (value: V) => void, thisArg?: unknown): void {
    return this._root.forEach(node => func(node.value), thisArg);
  }
}

class Node<V, R> {
  value: V;

  _tree?: Tree<V, R>;
  _hi: number;
  _lo: number;

  constructor(tree: Tree<V, R>, value: V, hi: number, lo: number) {
    this.value = value;
    this._tree = tree;
    this._hi = hi;
    this._lo = lo;
  }

  delete(): boolean {
    const tree = this._tree;
    if (!tree) {
      return false;
    }

    const root = tree._root.delete(this);
    if (root === tree._root) {
      throw new Error("cmp function is inconsistent");
    }

    tree._root = root;
    this._tree = undefined;
    return true;
  }

  update(value: V): boolean {
    const tree = this._tree;
    if (!tree) {
      return false;
    }

    let root = tree._root.delete(this);
    if (root === tree._root) {
      throw new Error("cmp function is inconsistent");
    }

    this.value = value;
    tree._root = root.insert(this);
    return true;
  }
}

export interface MutableTreeducerNode<V> {
  readonly value: V;
  delete(): boolean;
  update(value: V): boolean;
}
export interface MutableTreeducer<V, R> {
  reduce(): R | undefined;
  insert(value: V): MutableTreeducerNode<V>;
  forEach(func: (value: V) => void, thisArg?: unknown): void;
}
export const MutableTreeducer = Tree as {
  new <V, R>(config: Config<V, R>): MutableTreeducer<V, R>;
};
