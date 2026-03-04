import { buildErrorContext } from './errorContext';
import { logError } from './logger';

type ErrorHandlerCallback = (error: Error, isFatal?: boolean) => void;

// ErrorUtils is available as a global in the React Native runtime.
// We reference it via `globalThis` so TypeScript does not complain and the
// code is safe in environments where it is absent (e.g. unit tests without
// a RN runtime).
function getErrorUtils():
  | {
      setGlobalHandler(callback: ErrorHandlerCallback): void;
      getGlobalHandler(): ErrorHandlerCallback;
    }
  | undefined {
  return (globalThis as Record<string, unknown>).ErrorUtils as
    | {
        setGlobalHandler(callback: ErrorHandlerCallback): void;
        getGlobalHandler(): ErrorHandlerCallback;
      }
    | undefined;
}

let _previousHandler: ErrorHandlerCallback | null = null;
let _isEnabled = false;

/**
 * Install a global JavaScript error handler that catches errors React error
 * boundaries miss — async errors, event-handler errors, and unhandled promise
 * rejections surfaced by the RN runtime.
 *
 * Uses `ErrorUtils.setGlobalHandler` internally. The previous handler is
 * preserved and called after our handler runs.
 *
 * Call `disableGlobalJsHandler()` to restore the previous handler.
 *
 * @example
 * enableGlobalJsHandler();
 */
export function enableGlobalJsHandler(): void {
  if (_isEnabled) {
    return;
  }

  const errorUtils = getErrorUtils();
  if (errorUtils === undefined) {
    return;
  }

  try {
    _previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      try {
        const context = buildErrorContext(undefined, 'UNKNOWN');
        logError(error, context);
      } catch {
        // Never allow our handler to throw
      }
      if (_previousHandler !== null) {
        _previousHandler(error, isFatal);
      }
    });
    _isEnabled = true;
  } catch {
    // Gracefully handle environments where ErrorUtils API is unavailable
  }
}

/**
 * Remove the global JS error handler installed by `enableGlobalJsHandler`
 * and restore the previous handler.
 */
export function disableGlobalJsHandler(): void {
  if (!_isEnabled) {
    return;
  }

  const errorUtils = getErrorUtils();
  if (errorUtils === undefined) {
    // Runtime gone — just reset our state
    _previousHandler = null;
    _isEnabled = false;
    return;
  }

  try {
    if (_previousHandler !== null) {
      errorUtils.setGlobalHandler(_previousHandler);
    }
  } catch {
    // Gracefully handle
  }

  _previousHandler = null;
  _isEnabled = false;
}
