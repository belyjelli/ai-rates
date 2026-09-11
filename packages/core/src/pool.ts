/**
 * Maps over `items` with at most `limit` promises in flight, preserving input order.
 * Workers allow 6 simultaneous outbound connections per invocation, so callers doing
 * fetches should keep `limit` at 5 or below.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!(limit >= 1)) {
    throw new RangeError(`limit must be >= 1, got ${limit}`);
  }
  const results = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}
