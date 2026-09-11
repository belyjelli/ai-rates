import { describeError } from "./scheduler";

/** Runs an async job repeatedly with a fixed pause between runs; never overlaps and never throws. */
export class PeriodicTask {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private current: Promise<void> | null = null;

  constructor(
    private readonly name: string,
    private readonly pauseMs: number,
    private readonly job: () => Promise<void>,
    private readonly log?: (message: string) => void,
  ) {}

  start(initialDelayMs = 0): void {
    this.stopped = false;
    this.timer = setTimeout(() => this.tick(), initialDelayMs);
  }

  /** Stops scheduling and resolves once an in-flight run has finished. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.current;
  }

  private tick(): void {
    this.current = this.job()
      .catch((error) => this.log?.(`${this.name} failed: ${describeError(error)}`))
      .finally(() => {
        this.current = null;
        if (!this.stopped) this.timer = setTimeout(() => this.tick(), this.pauseMs);
      });
  }
}
