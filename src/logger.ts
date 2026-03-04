import { GlobalErrorLogger, ErrorContext } from './types';

let _globalLogger: GlobalErrorLogger | null = null;

/**
 * Register a global error logger. This logger is used when no `onError`
 * prop is provided to `ErrorBoundaryLogger`, and by `safeAsync`.
 *
 * @example
 * setGlobalErrorLogger((error, context) => {
 *   sendToSentry(error, context);
 * });
 */
export function setGlobalErrorLogger(logger: GlobalErrorLogger): void {
  _globalLogger = logger;
}

/**
 * Returns the currently registered global logger, or null if none is set.
 */
export function getGlobalLogger(): GlobalErrorLogger | null {
  return _globalLogger;
}

/**
 * Invokes the global logger with the given error and context.
 * Silently swallows any errors thrown by the logger itself.
 */
export function logError(error: Error, context: ErrorContext): void {
  if (_globalLogger !== null) {
    try {
      _globalLogger(error, context);
    } catch {
      // Never allow logger errors to propagate
    }
  }
}
