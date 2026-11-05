import { promiseAllSettledWithLimit } from "@/utils/concurrency";

describe("promiseAllSettledWithLimit", () => {
  it("returns all fulfilled results in order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await promiseAllSettledWithLimit(items, 2, async (n) => n * 10);

    expect(results).toHaveLength(5);
    results.forEach((r, i) => {
      expect(r.status).toBe("fulfilled");
      expect((r as PromiseFulfilledResult<number>).value).toBe((i + 1) * 10);
    });
  });

  it("captures rejections without throwing", async () => {
    const items = [1, 2, 3];
    const results = await promiseAllSettledWithLimit(items, 2, async (n) => {
      if (n === 2) throw new Error("fail");
      return n * 10;
    });

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("fulfilled");
    expect((results[0] as PromiseFulfilledResult<number>).value).toBe(10);
    expect(results[1].status).toBe("rejected");
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect(results[2].status).toBe("fulfilled");
    expect((results[2] as PromiseFulfilledResult<number>).value).toBe(30);
  });

  it("handles all failures", async () => {
    const items = [1, 2, 3];
    const results = await promiseAllSettledWithLimit(items, 2, async () => {
      throw new Error("boom");
    });

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.status).toBe("rejected");
    });
  });

  it("limits concurrency", async () => {
    let running = 0;
    let maxRunning = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await promiseAllSettledWithLimit(items, 2, async (n) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return n;
    });

    expect(maxRunning).toBeLessThanOrEqual(2);
  });

  it("handles empty array", async () => {
    const results = await promiseAllSettledWithLimit([] as number[], 5, async (n) => n);
    expect(results).toEqual([]);
  });

  it("preserves result order regardless of completion order", async () => {
    const items = [1, 2, 3];
    const results = await promiseAllSettledWithLimit(items, 3, async (n) => {
      // Item 1 takes longest, item 3 resolves first
      await new Promise((r) => setTimeout(r, (4 - n) * 10));
      return n * 100;
    });

    expect(results).toHaveLength(3);
    expect((results[0] as PromiseFulfilledResult<number>).value).toBe(100);
    expect((results[1] as PromiseFulfilledResult<number>).value).toBe(200);
    expect((results[2] as PromiseFulfilledResult<number>).value).toBe(300);
  });
});
