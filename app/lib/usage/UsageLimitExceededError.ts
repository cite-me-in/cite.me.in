export default class UsageLimitExceededError extends Error {
  public readonly current: number;
  public readonly limit: number;
  public readonly timeWindow: string;

  constructor({
    current,
    limit,
    timeWindow,
  }: {
    current: number;
    limit: number;
    timeWindow: string;
  }) {
    super(`${timeWindow} cost limit exceeded: ${current} / ${limit}`);
    this.current = current;
    this.limit = limit;
    this.timeWindow = timeWindow;
    this.name = "UsageLimitExceededError";
  }
}
