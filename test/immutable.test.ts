import { Treeducer } from "../src/index";
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

function collect<T>(tree: Treeducer<T, any>): T[] {
  const arr: T[] = [];
  tree.select().forEach(value => arr.push(value));
  return arr;
}

describe("Treeducer", () => {
  describe("select(...)", () => {
    it("should limit the nodes to the ones designated by the given selector", () => {
      const numbers = [];
      for (let i = 0; i < 1024; i++) {
        numbers.push(i);
      }

      let t = createSumTree();
      numbers.forEach(n => {
        t = t.insert(n);
      });

      const s = t.select(a => {
        if (a < 50) {
          return -1;
        } else if (a > 100) {
          return 1;
        } else {
          return 0;
        }
      });
      expect(s.first()).to.equal(50);
      expect(s.last()).to.equal(100);
      expect(Array.from(s)).to.deep.equal(numbers.slice(50, 101));
      expect(Array.from(s.before())).to.deep.equal(numbers.slice(0, 50));
      expect(Array.from(s.after())).to.deep.equal(numbers.slice(101));
      expect(s.reduce()).to.equal(numbers.slice(50, 101).reduce((a, b) => a + b, 0));
      expect(s.before().reduce()).to.equal(numbers.slice(0, 50).reduce((a, b) => a + b, 0));
      expect(s.after().reduce()).to.equal(numbers.slice(101).reduce((a, b) => a + b, 0));
    });

    describe("forEach()", () => {
      it("should iterate throught the values in sorted order", () => {
        const original = [5, 3, 6, 8, 4, -1, 1, 4, 8, 5, 3];
        const tree = original.reduce((t, v) => t.insert(v), createSumTree());
        original.sort((a, b) => a - b);
        expect(collect(tree)).to.deep.equal(original);
      });
    });

    describe("reduce()", () => {
      it("should return undefined for an empty tree", () => {
        const t = createSumTree();
        expect(t.select().reduce()).to.be.undefined;
      });
      it("should return the only mapped value for a tree of size === 1", () => {
        const t = createSumTree().insert(1);
        expect(t.select().reduce()).to.equal(1);
      });
      it("should return the reduced value of all the mapped values in the tree", () => {
        const t = createSumTree()
          .insert(1)
          .insert(2)
          .insert(3);
        expect(t.select().reduce()).to.equal(6);
      });
      it("should return the reduced value after deletions", () => {
        const t = createSumTree()
          .insert(1)
          .insert(2)
          .insert(3)
          .delete(2);
        expect(t.select().reduce()).to.equal(4);
      });
    });
  });

  describe("withMutations()", () => {
    it("should keep the original tree unchanged", () => {
      const tree = createSumTree()
        .insert(1)
        .insert(2);
      tree.withMutations(t => t.insert(3));
      expect(collect(tree)).to.deep.equal([1, 2]);
    });
  });

  it("should stay consistent over multiple inserts, deletions and updates", () => {
    for (let x = 0; x < 10; x++) {
      const original: number[] = [];
      for (let i = 0; i < 8024; i++) {
        original.push((Math.random() * 2 ** 32) | 0);
      }
      let tree = original.reduce((t, n) => t.insert(n), createSumTree());
      for (let i = 0; i < 1024; i++) {
        const index = (Math.random() * original.length) | 0;
        tree = tree.delete(original[index]);
        original[index] = original[original.length - 1];
        original.pop();
      }
      for (let i = 0; i < 128; i++) {
        const index: number = (Math.random() * original.length) | 0;
        tree = tree.update(original[index], -i);
        original[index] = -i;
      }
      original.sort((a, b) => a - b);
      expect(collect(tree)).to.deep.equal(original);
      expect(tree.select().reduce()).to.equal(original.reduce((acc, val) => acc + val, 0));
    }
  });

  it("should stay consistent over multiple inserts, deletions and updates inside withMutations", () => {
    for (let x = 0; x < 10; x++) {
      const original: number[] = [];
      for (let i = 0; i < 8024; i++) {
        original.push((Math.random() * 2 ** 32) | 0);
      }
      const tree = createSumTree().withMutations(tree => {
        original.forEach(n => {
          tree.insert(n);
        });
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
      });
      original.sort((a, b) => a - b);
      expect(collect(tree)).to.deep.equal(original);
      expect(tree.select().reduce()).to.equal(original.reduce((acc, val) => acc + val, 0));
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
