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
    const node = this._delete(value, this._config.map(value));
    return node || new Empty(this._config);
  }

  private _detachMin(): { root?: Node<V, R>; detached: Node<V, R> } {
    if (!this.left) {
      return { root: this.right, detached: this };
    }
    const min = this.left._detachMin();
    return {
      detached: min.detached,
      root: new Node(
        this.value,
        this._config,
        this._mapped,
        min.root,
        this.right,
        this._level
      )._rebalanced()
    };
  }

  private _decreaseLevel(): Node<V, R> {
    const shouldBe =
      Math.min(
        this.left ? this.left._level : 0,
        this.right ? this.right._level : 0
      ) + 1;
    if (shouldBe >= this._level) {
      return this;
    }

    let right = this.right;
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
      this.value,
      this._config,
      this._mapped,
      this.left,
      this.right,
      shouldBe,
      this._reduced
    );
  }

  private _rebalanced(): Node<V, R> {
    let node = this._decreaseLevel();
    node = node._skew();

    let right = node.right && node.right._skew();
    if (right && right.right) {
      const rr = right.right._skew();
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

    node = node._split();
    right = node.right && node.right._split();
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

  private _delete(value: V, mapped: R): Node<V, R> | undefined {
    const cmp = this._config.cmp(value, this.value, mapped, this._mapped);
    if (cmp === 0) {
      if (!this.left) {
        return this.right;
      }
      const { root, detached } = this.right!._detachMin();
      return new Node(
        detached.value,
        detached._config,
        detached._mapped,
        this.left,
        root,
        this._level
      )._rebalanced();
    } else if (cmp < 0) {
      const left = this.left && this.left._delete(value, mapped);
      if (left === this.left) {
        return this;
      }
      return new Node(
        this.value,
        this._config,
        this._mapped,
        left,
        this.right,
        this._level
      )._rebalanced();
    } else {
      const right = this.right && this.right._delete(value, mapped);
      if (right === this.right) {
        return this;
      }
      return new Node(
        this.value,
        this._config,
        this._mapped,
        this.left,
        right,
        this._level
      )._rebalanced();
    }
  }

  insert(value: V): Node<V, R> {
    return this._insert(value, this._config.map(value));
  }

  private _insert(value: V, mapped: R): Node<V, R> {
    let node: Node<V, R>;
    if (this._config.cmp(value, this.value, mapped, this._mapped) < 0) {
      node = new Node(
        this.value,
        this._config,
        this._mapped,
        this.left
          ? this.left._insert(value, mapped)
          : new Node(value, this._config, mapped),
        this.right,
        this._level
      );
    } else {
      node = new Node(
        this.value,
        this._config,
        this._mapped,
        this.left,
        this.right
          ? this.right._insert(value, mapped)
          : new Node(value, this._config, mapped),
        this._level
      );
    }
    return node._skew()._split();
  }

  private _skew(): Node<V, R> {
    const left = this.left;
    if (!left || this._level !== left._level) {
      return this;
    }
    const right = new Node(
      this.value,
      this._config,
      this._mapped,
      left.right,
      this.right,
      this._level
    );
    return new Node(
      left.value,
      left._config,
      left._mapped,
      left.left,
      right,
      left._level,
      this._reduced
    );
  }

  private _split(): Node<V, R> {
    const right = this.right;
    if (!right || !right.right || this._level !== right.right._level) {
      return this;
    }

    const left = new Node(
      this.value,
      this._config,
      this._mapped,
      this.left,
      right.left,
      this._level
    );

    return new Node(
      right.value,
      right._config,
      right._mapped,
      left,
      right.right,
      right._level + 1,
      this._reduced
    );
  }
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
