import React from 'react';
import { Text, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundaryLogger } from '../src/ErrorBoundaryLogger';
import { setGlobalErrorLogger, getGlobalLogger } from '../src/logger';
import { safeAsync } from '../src/safeAsync';
import { setAppVersion, buildErrorContext } from '../src/errorContext';

// Suppress React's console.error output for intentional error tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
  // Reset the global logger between tests
  setGlobalErrorLogger(() => undefined);
});

// Component that throws during render
function ThrowingComponent({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

// Component that renders normally
function NormalComponent(): React.ReactElement {
  return <View testID="normal-component"><Text>All good</Text></View>;
}

describe('ErrorBoundaryLogger', () => {
  it('renders children when there is no error', () => {
    const { getByTestId } = render(
      <ErrorBoundaryLogger>
        <NormalComponent />
      </ErrorBoundaryLogger>
    );
    expect(getByTestId('normal-component')).toBeTruthy();
  });

  it('renders the default fallback UI when a child throws', () => {
    const { getByTestId, getByText } = render(
      <ErrorBoundaryLogger>
        <ThrowingComponent message="test error" />
      </ErrorBoundaryLogger>
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByTestId('error-message').props.children).toBe('test error');
  });

  it('renders a static ReactNode fallback when provided', () => {
    const CustomFallback = <View testID="custom-fallback"><Text>Custom</Text></View>;
    const { getByTestId } = render(
      <ErrorBoundaryLogger fallback={CustomFallback}>
        <ThrowingComponent message="oops" />
      </ErrorBoundaryLogger>
    );
    expect(getByTestId('custom-fallback')).toBeTruthy();
  });

  it('renders a function fallback and provides a reset callback', () => {
    const { getByTestId } = render(
      <ErrorBoundaryLogger
        fallback={(reset) => (
          <View>
            <Text testID="fn-fallback">Error occurred</Text>
            <Text testID="reset-btn" onPress={reset}>Reset</Text>
          </View>
        )}
      >
        <ThrowingComponent message="fn fallback test" />
      </ErrorBoundaryLogger>
    );
    expect(getByTestId('fn-fallback')).toBeTruthy();
  });

  it('resets to render children again after pressing "Try again"', () => {
    let shouldThrow = true;

    function ConditionalThrower(): React.ReactElement {
      if (shouldThrow) {
        throw new Error('conditional error');
      }
      return <View testID="recovered" />;
    }

    const { getByTestId } = render(
      <ErrorBoundaryLogger>
        <ConditionalThrower />
      </ErrorBoundaryLogger>
    );

    // The default fallback retry button should be present
    expect(getByTestId('retry-button')).toBeTruthy();

    // Simulate recovery
    shouldThrow = false;
    fireEvent.press(getByTestId('retry-button'));

    expect(getByTestId('recovered')).toBeTruthy();
  });

  it('calls onError prop with error, info, and context when a child throws', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError}>
        <ThrowingComponent message="callback test" />
      </ErrorBoundaryLogger>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    const [error, info, context] = onError.mock.calls[0] as [Error, React.ErrorInfo, { timestamp: number; platform: string }];
    expect(error.message).toBe('callback test');
    expect(info).toHaveProperty('componentStack');
    expect(context).toHaveProperty('timestamp');
    expect(context).toHaveProperty('platform');
  });

  it('calls onError with screenName in context when provided', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError} screenName="ProfileScreen">
        <ThrowingComponent message="screen error" />
      </ErrorBoundaryLogger>
    );

    const [, , context] = onError.mock.calls[0] as [Error, React.ErrorInfo, { screenName?: string }];
    expect(context.screenName).toBe('ProfileScreen');
  });

  it('uses the global logger when no onError prop is provided', () => {
    const globalLogger = jest.fn();
    setGlobalErrorLogger(globalLogger);

    render(
      <ErrorBoundaryLogger>
        <ThrowingComponent message="global logger test" />
      </ErrorBoundaryLogger>
    );

    expect(globalLogger).toHaveBeenCalledTimes(1);
    const [error] = globalLogger.mock.calls[0] as [Error];
    expect(error.message).toBe('global logger test');
  });

  it('does not throw when the onError callback itself throws', () => {
    const onError = jest.fn(() => {
      throw new Error('logger exploded');
    });

    expect(() => {
      render(
        <ErrorBoundaryLogger onError={onError}>
          <ThrowingComponent message="trigger" />
        </ErrorBoundaryLogger>
      );
    }).not.toThrow();
  });
});

describe('setGlobalErrorLogger / getGlobalLogger', () => {
  it('stores and retrieves the global logger', () => {
    const logger = jest.fn();
    setGlobalErrorLogger(logger);
    expect(getGlobalLogger()).toBe(logger);
  });
});

describe('safeAsync', () => {
  it('returns the resolved value on success', async () => {
    const result = await safeAsync(async () => 42);
    expect(result).toBe(42);
  });

  it('returns undefined and logs on failure', async () => {
    const logger = jest.fn();
    setGlobalErrorLogger(logger);

    const result = await safeAsync(async () => {
      throw new Error('async failure');
    });

    expect(result).toBeUndefined();
    expect(logger).toHaveBeenCalledTimes(1);
    const [error] = logger.mock.calls[0] as [Error];
    expect(error.message).toBe('async failure');
  });

  it('wraps non-Error thrown values in an Error', async () => {
    const logger = jest.fn();
    setGlobalErrorLogger(logger);

    await safeAsync(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'string error';
    });

    const [error] = logger.mock.calls[0] as [Error];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('string error');
  });
});

describe('buildErrorContext', () => {
  it('returns an object with timestamp, platform, and optional fields', () => {
    const context = buildErrorContext();
    expect(typeof context.timestamp).toBe('number');
    expect(typeof context.platform).toBe('string');
  });

  it('includes screenName when provided', () => {
    const context = buildErrorContext('HomeScreen');
    expect(context.screenName).toBe('HomeScreen');
  });

  it('does not include screenName when not provided', () => {
    const context = buildErrorContext();
    expect(context.screenName).toBeUndefined();
  });
});

describe('setAppVersion', () => {
  it('sets appVersion that appears in subsequent error contexts', () => {
    setAppVersion('2.0.0');
    const context = buildErrorContext();
    expect(context.appVersion).toBe('2.0.0');
  });
});
