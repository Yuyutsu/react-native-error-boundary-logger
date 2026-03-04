import { ErrorMetadata } from './types';

let _metadata: ErrorMetadata = {};

/**
 * Inject key/value metadata that will be included in every subsequent
 * `ErrorContext`. Subsequent calls **merge** (not replace) the metadata.
 *
 * @example
 * setErrorMetadata({ userId: '12345', environment: 'production' });
 */
export function setErrorMetadata(metadata: ErrorMetadata): void {
  _metadata = { ..._metadata, ...metadata };
}

/** Returns a copy of the currently stored metadata. */
export function getErrorMetadata(): ErrorMetadata {
  return { ..._metadata };
}

/** Removes all stored metadata. */
export function clearErrorMetadata(): void {
  _metadata = {};
}
