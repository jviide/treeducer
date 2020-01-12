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
  for (let i = 1; i < 1024; i++) {
    mutable.insert(i);
  }
});

// Select a contiguous range of values (i.e. values 10..=100)...
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
```

## License

This library is licensed under the MIT license. See [LICENSE](./LICENSE).
