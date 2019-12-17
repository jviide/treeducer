# treeducer ![](https://github.com/jviide/treeducer/workflows/tests/badge.svg) [![npm](https://img.shields.io/npm/v/treeducer.svg)](https://www.npmjs.com/package/treeducer)

## Installation

```sh
$ npm install --save treeducer
```

## Usage

```ts
import { Treeducer } from "treeducer";

const tree = new Treeducer({
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

tree.insert(1);
tree.insert(3);

tree.reduced; // 4
```

## License

This library is licensed under the MIT license. See [LICENSE](./LICENSE).
