import { MutableTreeducer } from "../src/index";
import { expect } from "chai";

function createSumTree() {
  return new MutableTreeducer({
    cmp(a: number, b: number) {
      return a - b;
    },
    map(a: number): number {
      return a;
    },
    reduce(a: number, b: number): number {
      return a + b;
    }
  });
}

function collect<T>(tree: MutableTreeducer<T, unknown>): T[] {
  const arr: T[] = [];
  tree.forEach(value => arr.push(value));
  return arr;
}

describe("MutableTreeducer", () => {
  describe("reduce()", () => {
    it("should return undefined for an empty tree", () => {
      const t = createSumTree();
      expect(t.reduce()).to.be.undefined;
    });
    it("should return the only mapped value for a tree of size === 1", () => {
      const t = createSumTree();
      t.insert(1);
      expect(t.reduce()).to.equal(1);
    });
    it("should return the reduced value of all the mapped values in the tree", () => {
      const t = createSumTree();
      t.insert(1);
      t.insert(2);
      t.insert(3);
      expect(t.reduce()).to.equal(6);
    });
    it("should return the reduced value after deletions", () => {
      const t = createSumTree();
      t.insert(1);
      const node = t.insert(2);
      t.insert(3);
      node.delete();
      expect(t.reduce()).to.equal(4);
    });
  });

  describe("forEach()", () => {
    it("should iterate throught the values in sorted order", () => {
      const original = [5, 3, 6, 8, 4, -1, 1, 4, 8, 5, 3];
      const tree = createSumTree();

      original.forEach(v => tree.insert(v));
      original.sort((a, b) => a - b);
      expect(collect(tree)).to.deep.equal(original);
    });
  });

  it("should stay consistent over multiple inserts and deletions", () => {
    for (let x = 0; x < 10; x++) {
      const original: number[] = [];
      for (let i = 0; i < 8024; i++) {
        original.push((Math.random() * 2 ** 32) | 0);
      }
      const tree = createSumTree();
      const nodes = original.map(n => tree.insert(n));
      for (let i = 0; i < 1024; i++) {
        const index = (Math.random() * original.length) | 0;
        nodes[index].delete();
        nodes[index] = nodes[nodes.length - 1];
        original[index] = original[original.length - 1];
        original.pop();
        nodes.pop();
      }
      for (let i = 0; i < 128; i++) {
        const index: number = (Math.random() * original.length) | 0;
        nodes[index].update(-i);
        original[index] = -i;
      }
      original.sort((a, b) => a - b);
      original.reduce((acc, val) => acc + val, 0);
      expect(collect(tree)).to.deep.equal(original);
      expect(tree.reduce()).to.equal(original.reduce((acc, val) => acc + val, 0));
    }
  });
});

describe("MutableTreeducerNode", () => {
  describe("value", () => {
    it("should be the node's original value", () => {
      const t = createSumTree();
      const n = t.insert(1);
      expect(n.value).to.equal(1);
    });
  });

  describe("delete()", () => {
    it("should return true when the node is in the tree prior to the deletion", () => {
      const t = createSumTree();
      const n = t.insert(1);
      expect(n.delete()).to.equal(true);
    });
    it("should return false when the node has already been deleted", () => {
      const t = createSumTree();
      const n = t.insert(1);
      n.delete();
      expect(n.delete()).to.equal(false);
    });
  });
});
