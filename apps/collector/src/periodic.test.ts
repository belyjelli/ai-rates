import { describe, expect, test } from "bun:test";
import { PeriodicTask } from "./periodic";

describe("PeriodicTask", () => {
  test("repeats the job, logs failures, and keeps going", async () => {
    let runs = 0;
    const logs: string[] = [];
    const task = new PeriodicTask(
      "stats",
      5,
      async () => {
        runs++;
        if (runs === 2) throw new Error("db down");
      },
      (m) => logs.push(m),
    );

    task.start();
    await Bun.sleep(60);
    await task.stop();

    expect(runs).toBeGreaterThanOrEqual(3);
    expect(logs).toEqual(["stats failed: db down"]);
  });

  test("stop waits for the in-flight run and prevents further runs", async () => {
    let runs = 0;
    let release: () => void = () => {};
    const task = new PeriodicTask("slow", 1, () => {
      runs++;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });

    task.start();
    await Bun.sleep(10);
    let stopped = false;
    const stopping = task.stop().then(() => {
      stopped = true;
    });
    await Bun.sleep(10);
    expect(stopped).toBe(false);

    release();
    await stopping;
    await Bun.sleep(10);
    expect(stopped).toBe(true);
    expect(runs).toBe(1);
  });
});
