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
      const original = [];
      for (let i = 0; i < 1024; i++) {
        original.push(i);
      }

      const tree = createSumTree();
      const nodes = original.map(n => {
        return tree.insert(n);
      });

      for (let i = 0; i < 512; i++) {
        const index = (Math.random() * original.length) | 0;
        nodes[index].delete();
        original.splice(index, 1);
        nodes.splice(index, 1);
      }

      for (let i = 1; i < 128; i++) {
        const index: number = (Math.random() * original.length) | 0;
        nodes[index].update(-i);
        original[index] = -i;
      }

      original.sort((a, b) => a - b);
      expect(collect(tree)).to.deep.equal(original);
      expect(tree.reduce()).to.equal(
        original.reduce((acc, val) => acc + val, 0)
      );
    }
  });
});

describe("TreeducerNode", () => {
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

  describe("delete()", () => {
    it("should return true when the node is still in the tree", () => {
      const t = createSumTree();
      const n = t.insert(1);
      expect(n.update(2)).to.equal(true);
    });
    it("should return false when the node has already been deleted", () => {
      const t = createSumTree();
      const n = t.insert(1);
      n.delete();
      expect(n.update(2)).to.equal(false);
    });
  });
});
