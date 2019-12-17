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

describe("Treeducer", () => {
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
  });

  describe("minNode", () => {
    it("should return undefined for an empty tree", () => {
      const t = createSumTree();
      expect(t.minNode()).to.be.undefined;
    });
    it("should return the only node in the tree for a tree of size === 1", () => {
      const t = createSumTree();
      const n = t.insert(1);
      expect(t.minNode()).to.equal(n);
    });
    it("should return the node with the smallest value in the tree", () => {
      const t = createSumTree();
      t.insert(2);
      t.insert(1);
      t.insert(3);
      expect(t.minNode()!.value).to.equal(1);
    });
  });

  describe("maxNode", () => {
    it("should return undefined for an empty tree", () => {
      const t = createSumTree();
      expect(t.maxNode()).to.be.undefined;
    });
    it("should return the only node in the tree for a tree of size === 1", () => {
      const t = createSumTree();
      const n = t.insert(1);
      expect(t.maxNode()).to.equal(n);
    });
    it("should return the node with the smallest value in the tree", () => {
      const t = createSumTree();
      t.insert(2);
      t.insert(3);
      t.insert(1);
      expect(t.maxNode()!.value).to.equal(3);
    });
  });
});
