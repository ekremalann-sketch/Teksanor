/** Workers may cancel I/O with its originating request. Never share pending I/O
 * between requests: remember only successful initialization, per binding. */
export function requestSafeInitializer<T extends object>(initialize: (target: T) => Promise<void>) {
  const ready = new WeakSet<T>();
  return async (target: T): Promise<void> => {
    if (ready.has(target)) return;
    await initialize(target);
    ready.add(target);
  };
}
