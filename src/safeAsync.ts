import { buildErrorContext } from './errorContext';
import { logError } from './logger';

/**
 * Wraps an async function and catches any errors it throws, forwarding them
 * to the global logger. React error boundaries do not catch async errors;
 * use this utility to bridge that gap.
 *
 * @returns The resolved value, or `undefined` if the function threw.
 *
 * @example
 * safeAsync(async () => {
 *   await fetchData();
 * });
 */
export async function safeAsync<T>(
  asyncFn: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await asyncFn();
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err : new Error(String(err));
    const context = buildErrorContext();
    logError(error, context);
    return undefined;
  }
}
