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

function collect<T>(tree: MutableTreeducer<T, any>): T[] {
  const arr: T[] = [];
  tree.select().forEach(value => arr.push(value));
  return arr;
}

describe("MutableTreeducer", () => {
  describe("reduce()", () => {
    it("should return undefined for an empty tree", () => {
      const t = createSumTree();
      expect(t.select().reduce()).to.be.undefined;
    });
    it("should return the only mapped value for a tree of size === 1", () => {
      const t = createSumTree();
      t.insert(1);
      expect(t.select().reduce()).to.equal(1);
    });
    it("should return the reduced value of all the mapped values in the tree", () => {
      const t = createSumTree();
      t.insert(1);
      t.insert(2);
      t.insert(3);
      expect(t.select().reduce()).to.equal(6);
    });
    it("should return the reduced value after deletions", () => {
      const t = createSumTree();
      t.insert(1);
      t.insert(2);
      t.insert(3);
      t.delete(2);
      expect(t.select().reduce()).to.equal(4);
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
      original.forEach(n => tree.insert(n));
      for (let i = 0; i < 1024; i++) {
        const index = (Math.random() * original.length) | 0;
        tree.delete(original[index]);
        original[index] = original[original.length - 1];
        original.pop();
      }
      for (let i = 0; i < 128; i++) {
        const index: number = (Math.random() * original.length) | 0;
        tree.update(original[index], -i);
        original[index] = -i;
      }
      original.sort((a, b) => a - b);
      expect(collect(tree)).to.deep.equal(original);
      expect(tree.select().reduce()).to.equal(original.reduce((acc, val) => acc + val, 0));
    }
  });
});
