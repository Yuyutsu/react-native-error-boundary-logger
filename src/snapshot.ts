let _snapshot: Record<string, unknown> | undefined;

/**
 * Store a snapshot of the current UI/application state. The snapshot is
 * attached to every subsequent `ErrorContext`, helping reproduce the exact
 * state at the time of a crash.
 *
 * @example
 * captureSnapshot({ currentUser, screenState });
 */
export function captureSnapshot(data: Record<string, unknown>): void {
  _snapshot = { ...data };
}

/** Returns a copy of the last captured snapshot, or `undefined` if none. */
export function getSnapshot(): Record<string, unknown> | undefined {
  return _snapshot !== undefined ? { ..._snapshot } : undefined;
}

/** Clears the stored snapshot. */
export function clearSnapshot(): void {
  _snapshot = undefined;
}
