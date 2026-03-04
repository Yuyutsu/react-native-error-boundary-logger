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

/**
 * A React Error Boundary that catches rendering errors, logs detailed
 * diagnostic information, and renders a safe fallback UI.
 *
 * @example
 * <ErrorBoundaryLogger
 *   screenName="HomeScreen"
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
      const context = buildErrorContext(this.props.screenName);
      if (this.props.onError !== undefined) {
        this.props.onError(error, info, context);
      } else {
        logError(error, context);
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
