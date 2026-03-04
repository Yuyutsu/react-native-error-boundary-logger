import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  ErrorBoundaryLoggerProps,
  ErrorBoundaryLoggerState,
} from './types';
import { buildErrorContext } from './errorContext';
import { logError } from './logger';

const LOG_PREFIX = '[ErrorBoundaryLogger]';

/**
 * A React Error Boundary that catches rendering errors, logs detailed
 * diagnostic information, and renders a safe fallback UI.
 *
 * @example
 * <ErrorBoundaryLogger
 *   screenName="HomeScreen"
 *   dedupeWindowMs={5000}
 *   maxErrorsPerMinute={10}
 *   debug
 *   fallback={(reset) => <Button title="Try again" onPress={reset} />}
 *   onError={(error, info, context) => sendToServer(error, context)}
 * >
 *   <YourComponent />
 * </ErrorBoundaryLogger>
 */
export class ErrorBoundaryLogger extends React.Component<
  ErrorBoundaryLoggerProps,
  ErrorBoundaryLoggerState
> {
  // Instance variables for dedup / rate-limit — not state because they do
  // not affect rendering.
  private _lastSignature: string | null = null;
  private _lastErrorTime: number = 0;
  private _errorCount: number = 0;
  private _windowStart: number = 0;

  constructor(props: ErrorBoundaryLoggerProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(
    error: Error
  ): ErrorBoundaryLoggerState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    try {
      const { dedupeWindowMs, maxErrorsPerMinute, debug, logAsync } =
        this.props;

      // ── Error deduplication ─────────────────────────────────────────────
      if (dedupeWindowMs !== undefined) {
        const signature = error.message + (info.componentStack ?? '');
        const now = Date.now();
        if (
          signature === this._lastSignature &&
          now - this._lastErrorTime < dedupeWindowMs
        ) {
          if (debug === true) {
            console.log(
              LOG_PREFIX,
              'Duplicate error suppressed within dedupeWindowMs'
            );
          }
          return;
        }
        this._lastSignature = signature;
        this._lastErrorTime = now;
      }

      // ── Rate limiting ───────────────────────────────────────────────────
      if (maxErrorsPerMinute !== undefined) {
        const now = Date.now();
        if (now - this._windowStart > 60_000) {
          this._windowStart = now;
          this._errorCount = 0;
        }
        if (this._errorCount >= maxErrorsPerMinute) {
          if (debug === true) {
            console.log(LOG_PREFIX, 'Rate limit exceeded, error dropped');
          }
          return;
        }
        this._errorCount++;
      }

      // ── Build context ───────────────────────────────────────────────────
      const context = buildErrorContext(this.props.screenName, 'UI_ERROR');

      if (debug === true) {
        console.log(LOG_PREFIX, 'Captured error:', error.message);
        console.log(LOG_PREFIX, 'Sending to logger');
      }

      // ── Dispatch to logger ──────────────────────────────────────────────
      const doLog = (): void => {
        if (this.props.onError !== undefined) {
          this.props.onError(error, info, context);
        } else {
          logError(error, context);
        }
      };

      if (logAsync === true) {
        setTimeout(doLog, 0);
      } else {
        doLog();
      }
    } catch {
      // Never allow error reporting to throw and crash the boundary
    }
  }

  reset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props;

      if (fallback !== undefined) {
        if (typeof fallback === 'function') {
          try {
            return fallback(this.reset);
          } catch {
            // Fall through to default fallback if custom one throws
          }
        } else {
          return fallback;
        }
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} testID="error-message">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.reset}
            testID="retry-button"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
