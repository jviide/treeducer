# treeducer ![](https://github.com/jviide/treeducer/workflows/tests/badge.svg) [![npm](https://img.shields.io/npm/v/treeducer.svg)](https://www.npmjs.com/package/treeducer)

## Installation

```sh
$ npm install --save treeducer
```

## Usage

```ts
import { Treeducer } from "treeducer";

let tree = new Treeducer({
  cmp(a: number, b: number) {
    return a - b;
  },
  map(a: number): number {
    return a;
  },
  reduce(a: number, b: number) {
    return a + b;
  }
});

// Use as an immutable tree where each insertion / deletion / update
// returns a new tree...
tree = tree
  .insert(1)
  .insert(2)
  .delete(2)
  .update(1, 0);

// ...or use a temporary mutable version of the tree.
tree = tree.withMutations(mutable => {
  for (let i = 1000; i > 0; i--) {
    mutable.insert(i);
  }
});

// Insertion order doesn't matter - the tree is sorted by value (with the given `cmp`).
Array.from(tree.select()); // [0, 1, 2, ..., 998, 999, 1000]

// By default select() "selects" all values in the tree, but it can also be used to
// select a contiguous range of values (i.e. values 10..=100)...
const selection = tree.select(value => {
  if (value < 10) {
    return -1;
  } else if (value > 100) {
    return 1;
  } else {
    return 0;
  }
});

// ...and do stuff with the selected values.
selection.first(); // 10
selection.last(); // 100
selection.reduce(); // 5005 (i.e. the sum of the selected values)
Array.from(selection); // [10, 11, ..., 99, 100]
```

## License

This library is licensed under the MIT license. See [LICENSE](./LICENSE).
