import { Treeducer } from "../index";
import { expect } from "chai";

function createSumTree() {
  return new Treeducer({
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

function collect<T>(tree: Treeducer<T, unknown>): T[] {
  const arr: T[] = [];
  tree.forEach(value => arr.push(value));
  return arr;
}

describe("Treeducer", () => {
  describe("reduce()", () => {
    it("should return undefined for an empty tree", () => {
      const t = createSumTree();
      expect(t.reduce()).to.be.undefined;
    });
    it("should return the only mapped value for a tree of size === 1", () => {
      const t = createSumTree().insert(1);
      expect(t.reduce()).to.equal(1);
    });
    it("should return the reduced value of all the mapped values in the tree", () => {
      const t = createSumTree()
        .insert(1)
        .insert(2)
        .insert(3);
      expect(t.reduce()).to.equal(6);
    });
    it("should return the reduced value after deletions", () => {
      const t = createSumTree()
        .insert(1)
        .insert(2)
        .insert(3)
        .delete(2);
      expect(t.reduce()).to.equal(4);
    });
  });

  describe("forEach()", () => {
    it("should iterate throught the values in sorted order", () => {
      const original = [5, 3, 6, 8, 4, -1, 1, 4, 8, 5, 3];
      const tree = original.reduce((t, v) => t.insert(v), createSumTree());
      original.sort((a, b) => a - b);
      expect(collect(tree)).to.deep.equal(original);
    });
  });

  it("should stay consistent over multiple inserts and deletions", () => {
    for (let x = 0; x < 10; x++) {
      const original = [];
      for (let i = 0; i < 1024; i++) {
        original.push(i);
      }
      let tree = original.reduce((t, n) => t.insert(n), createSumTree());
      for (let i = 0; i < 1; i++) {
        const index = (Math.random() * original.length) | 0;
        tree = tree.delete(original[index]);
        original.splice(index, 1);
      }

      original.sort((a, b) => a - b);
      expect(collect(tree)).to.deep.equal(original);
      expect(tree.reduce()).to.equal(
        original.reduce((acc, val) => acc + val, 0)
      );
    }
  });

  describe("delete()", () => {
    it("should return the original empty tree", () => {
      const t = createSumTree();
      expect(t.delete(2)).to.equal(t);
    });
    it("should return the original tree when nothing got deleted", () => {
      const t = createSumTree().insert(1);
      expect(t.delete(2)).to.equal(t);
    });
    it("should return a new tree when the something got deleted", () => {
      const t = createSumTree().insert(1);
      expect(t.delete(1)).to.not.equal(t);
    });
  });
});
