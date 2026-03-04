import React from 'react';
import { Text, View } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ErrorBoundaryLogger } from '../src/ErrorBoundaryLogger';
import { setGlobalErrorLogger, getGlobalLogger } from '../src/logger';
import { safeAsync } from '../src/safeAsync';
import { setAppVersion, buildErrorContext } from '../src/errorContext';
import { addBreadcrumb, getBreadcrumbs, clearBreadcrumbs } from '../src/breadcrumbs';
import { setErrorMetadata, getErrorMetadata, clearErrorMetadata } from '../src/metadata';
import { captureSnapshot, getSnapshot, clearSnapshot } from '../src/snapshot';
import { enableGlobalJsHandler, disableGlobalJsHandler } from '../src/globalHandler';
import { ErrorContext } from '../src/types';

// Suppress React's console.error output for intentional error tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
  // Reset global logger between tests
  setGlobalErrorLogger(() => undefined);
  // Reset new module-level state
  clearBreadcrumbs();
  clearErrorMetadata();
  clearSnapshot();
});

// Component that throws during render
function ThrowingComponent({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

// Component that renders normally
function NormalComponent(): React.ReactElement {
  return <View testID="normal-component"><Text>All good</Text></View>;
}

// ─── Existing tests ────────────────────────────────────────────────────────────

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

    expect(getByTestId('retry-button')).toBeTruthy();

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
    const [error, info, context] = onError.mock.calls[0] as [Error, React.ErrorInfo, ErrorContext];
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

    const [, , context] = onError.mock.calls[0] as [Error, React.ErrorInfo, ErrorContext];
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

  it('sets errorType to UI_ERROR in context', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError}>
        <ThrowingComponent message="type test" />
      </ErrorBoundaryLogger>
    );

    const [, , context] = onError.mock.calls[0] as [Error, React.ErrorInfo, ErrorContext];
    expect(context.errorType).toBe('UI_ERROR');
  });
});

// ─── Error deduplication ───────────────────────────────────────────────────────

describe('Error deduplication', () => {
  it('logs the first occurrence of an error normally', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundaryLogger onError={onError} dedupeWindowMs={5000}>
        <ThrowingComponent message="first error" />
      </ErrorBoundaryLogger>
    );
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('suppresses duplicate errors within dedupeWindowMs on retry', () => {
    const onError = jest.fn();
    const { getByTestId } = render(
      <ErrorBoundaryLogger onError={onError} dedupeWindowMs={5000}>
        <ThrowingComponent message="same error" />
      </ErrorBoundaryLogger>
    );
    expect(onError).toHaveBeenCalledTimes(1);

    // Press retry — ThrowingComponent throws again with the same message
    // within the dedup window, so the second event should be suppressed.
    fireEvent.press(getByTestId('retry-button'));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('logs the same error again after dedupeWindowMs has passed', () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    const { getByTestId } = render(
      <ErrorBoundaryLogger onError={onError} dedupeWindowMs={1000}>
        <ThrowingComponent message="timed error" />
      </ErrorBoundaryLogger>
    );
    expect(onError).toHaveBeenCalledTimes(1);

    // Advance past the dedup window then retry
    jest.advanceTimersByTime(2000);
    fireEvent.press(getByTestId('retry-button'));
    expect(onError).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});

// ─── Rate limiting ─────────────────────────────────────────────────────────────

describe('Rate limiting', () => {
  it('logs errors up to the maxErrorsPerMinute limit', () => {
    const onError = jest.fn();
    const { getByTestId } = render(
      <ErrorBoundaryLogger onError={onError} maxErrorsPerMinute={2}>
        <ThrowingComponent message="rate test" />
      </ErrorBoundaryLogger>
    );
    expect(onError).toHaveBeenCalledTimes(1); // first error

    fireEvent.press(getByTestId('retry-button'));
    expect(onError).toHaveBeenCalledTimes(2); // second error (at limit)

    fireEvent.press(getByTestId('retry-button'));
    expect(onError).toHaveBeenCalledTimes(2); // third — dropped
  });

  it('resets the rate-limit window after 60 seconds', () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    const { getByTestId } = render(
      <ErrorBoundaryLogger onError={onError} maxErrorsPerMinute={1}>
        <ThrowingComponent message="window reset" />
      </ErrorBoundaryLogger>
    );
    expect(onError).toHaveBeenCalledTimes(1);

    // Within the window — dropped
    fireEvent.press(getByTestId('retry-button'));
    expect(onError).toHaveBeenCalledTimes(1);

    // Advance past the 60-second window
    jest.advanceTimersByTime(61_000);

    fireEvent.press(getByTestId('retry-button'));
    expect(onError).toHaveBeenCalledTimes(2); // new window

    jest.useRealTimers();
  });
});

// ─── Debug mode ────────────────────────────────────────────────────────────────

describe('Debug mode', () => {
  it('emits [ErrorBoundaryLogger] console.log entries when debug is true', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError} debug>
        <ThrowingComponent message="debug test" />
      </ErrorBoundaryLogger>
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorBoundaryLogger]'),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it('does not emit console.log entries when debug is omitted', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    render(
      <ErrorBoundaryLogger>
        <ThrowingComponent message="no debug" />
      </ErrorBoundaryLogger>
    );

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('logs a suppression message when dedup fires and debug is true', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const onError = jest.fn();
    const { getByTestId } = render(
      <ErrorBoundaryLogger onError={onError} dedupeWindowMs={5000} debug>
        <ThrowingComponent message="dedup debug" />
      </ErrorBoundaryLogger>
    );

    consoleSpy.mockClear(); // ignore first-error log calls

    fireEvent.press(getByTestId('retry-button'));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorBoundaryLogger]'),
      expect.stringContaining('Duplicate')
    );

    consoleSpy.mockRestore();
  });
});

// ─── Async logging ─────────────────────────────────────────────────────────────

describe('logAsync', () => {
  it('defers the logger call to the next tick when logAsync is true', () => {
    jest.useFakeTimers();
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError} logAsync>
        <ThrowingComponent message="async log test" />
      </ErrorBoundaryLogger>
    );

    // Logger should NOT have been called yet
    expect(onError).toHaveBeenCalledTimes(0);

    // Flush pending timers
    act(() => {
      jest.runAllTimers();
    });

    expect(onError).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('calls the logger synchronously when logAsync is omitted', () => {
    jest.useFakeTimers();
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError}>
        <ThrowingComponent message="sync log test" />
      </ErrorBoundaryLogger>
    );

    // Logger should already have been called
    expect(onError).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});

// ─── Existing singleton-module tests ──────────────────────────────────────────

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

  it('classifies safeAsync errors as ASYNC_ERROR', async () => {
    const logger = jest.fn();
    setGlobalErrorLogger(logger);

    await safeAsync(async () => {
      throw new Error('async type test');
    });

    const [, context] = logger.mock.calls[0] as [Error, ErrorContext];
    expect(context.errorType).toBe('ASYNC_ERROR');
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

// ─── Breadcrumbs ───────────────────────────────────────────────────────────────

describe('Breadcrumbs', () => {
  it('adds a breadcrumb with an auto-assigned timestamp', () => {
    addBreadcrumb({ type: 'navigation', message: 'User opened ProfileScreen' });
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].type).toBe('navigation');
    expect(crumbs[0].message).toBe('User opened ProfileScreen');
    expect(typeof crumbs[0].timestamp).toBe('number');
  });

  it('accumulates multiple breadcrumbs in insertion order', () => {
    addBreadcrumb({ type: 'nav', message: 'A' });
    addBreadcrumb({ type: 'action', message: 'B' });
    const crumbs = getBreadcrumbs();
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].message).toBe('A');
    expect(crumbs[1].message).toBe('B');
  });

  it('returns a copy — mutations do not affect stored breadcrumbs', () => {
    addBreadcrumb({ type: 'test', message: 'x' });
    const crumbs = getBreadcrumbs();
    crumbs.push({ type: 'hack', message: 'injected', timestamp: 0 });
    expect(getBreadcrumbs()).toHaveLength(1);
  });

  it('clears all breadcrumbs', () => {
    addBreadcrumb({ type: 'nav', message: 'x' });
    clearBreadcrumbs();
    expect(getBreadcrumbs()).toHaveLength(0);
  });

  it('includes breadcrumbs in error context when present', () => {
    addBreadcrumb({ type: 'user', message: 'Clicked edit' });
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError}>
        <ThrowingComponent message="with breadcrumbs" />
      </ErrorBoundaryLogger>
    );

    const [, , context] = onError.mock.calls[0] as [Error, React.ErrorInfo, ErrorContext];
    expect(context.breadcrumbs).toBeDefined();
    expect(context.breadcrumbs?.[0].message).toBe('Clicked edit');
  });

  it('omits breadcrumbs key from context when list is empty', () => {
    const context = buildErrorContext();
    expect(context.breadcrumbs).toBeUndefined();
  });
});

// ─── Error metadata ────────────────────────────────────────────────────────────

describe('Error metadata', () => {
  it('stores and retrieves metadata', () => {
    setErrorMetadata({ userId: '123', environment: 'production' });
    const meta = getErrorMetadata();
    expect(meta.userId).toBe('123');
    expect(meta.environment).toBe('production');
  });

  it('merges metadata on successive calls', () => {
    setErrorMetadata({ userId: '123' });
    setErrorMetadata({ tenant: 'acme' });
    const meta = getErrorMetadata();
    expect(meta.userId).toBe('123');
    expect(meta.tenant).toBe('acme');
  });

  it('returns a copy — mutations do not affect stored metadata', () => {
    setErrorMetadata({ userId: '1' });
    const meta = getErrorMetadata();
    (meta as Record<string, unknown>).userId = 'hacked';
    expect(getErrorMetadata().userId).toBe('1');
  });

  it('clears all metadata', () => {
    setErrorMetadata({ userId: '123' });
    clearErrorMetadata();
    expect(getErrorMetadata()).toEqual({});
  });

  it('includes metadata in error context when present', () => {
    setErrorMetadata({ userId: '999' });
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError}>
        <ThrowingComponent message="with metadata" />
      </ErrorBoundaryLogger>
    );

    const [, , context] = onError.mock.calls[0] as [Error, React.ErrorInfo, ErrorContext];
    expect(context.metadata?.userId).toBe('999');
  });

  it('omits metadata key from context when empty', () => {
    const context = buildErrorContext();
    expect(context.metadata).toBeUndefined();
  });
});

// ─── Error snapshot ────────────────────────────────────────────────────────────

describe('Error snapshot', () => {
  it('stores and retrieves a snapshot', () => {
    captureSnapshot({ currentUser: { id: 1 }, screenState: 'loading' });
    const snap = getSnapshot();
    expect(snap?.currentUser).toEqual({ id: 1 });
    expect(snap?.screenState).toBe('loading');
  });

  it('returns a copy — mutations do not affect stored snapshot', () => {
    captureSnapshot({ val: 1 });
    const snap = getSnapshot();
    if (snap) snap.val = 99;
    expect(getSnapshot()?.val).toBe(1);
  });

  it('returns undefined before any snapshot is captured', () => {
    expect(getSnapshot()).toBeUndefined();
  });

  it('clears the snapshot', () => {
    captureSnapshot({ val: 1 });
    clearSnapshot();
    expect(getSnapshot()).toBeUndefined();
  });

  it('includes snapshot in error context when present', () => {
    captureSnapshot({ currentUser: 'alice' });
    const onError = jest.fn();

    render(
      <ErrorBoundaryLogger onError={onError}>
        <ThrowingComponent message="with snapshot" />
      </ErrorBoundaryLogger>
    );

    const [, , context] = onError.mock.calls[0] as [Error, React.ErrorInfo, ErrorContext];
    expect(context.snapshot?.currentUser).toBe('alice');
  });

  it('omits snapshot key from context when none is set', () => {
    const context = buildErrorContext();
    expect(context.snapshot).toBeUndefined();
  });
});

// ─── Global JS error handler ───────────────────────────────────────────────────

describe('Global JS error handler', () => {
  let mockPreviousHandler: jest.Mock;
  let mockSetGlobalHandler: jest.Mock;
  let mockGetGlobalHandler: jest.Mock;

  beforeEach(() => {
    mockPreviousHandler = jest.fn();
    mockGetGlobalHandler = jest.fn(() => mockPreviousHandler);
    mockSetGlobalHandler = jest.fn();
    (globalThis as Record<string, unknown>).ErrorUtils = {
      getGlobalHandler: mockGetGlobalHandler,
      setGlobalHandler: mockSetGlobalHandler,
    };
  });

  afterEach(() => {
    disableGlobalJsHandler();
    delete (globalThis as Record<string, unknown>).ErrorUtils;
  });

  it('installs a handler via ErrorUtils.setGlobalHandler', () => {
    enableGlobalJsHandler();
    expect(mockSetGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — calling enable twice installs the handler only once', () => {
    enableGlobalJsHandler();
    enableGlobalJsHandler();
    expect(mockSetGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it('restores the previous handler when disabled', () => {
    enableGlobalJsHandler();
    disableGlobalJsHandler();
    expect(mockSetGlobalHandler).toHaveBeenCalledTimes(2);
    expect(mockSetGlobalHandler.mock.calls[1][0]).toBe(mockPreviousHandler);
  });

  it('is a no-op when ErrorUtils is not available', () => {
    delete (globalThis as Record<string, unknown>).ErrorUtils;
    expect(() => enableGlobalJsHandler()).not.toThrow();
  });

  it('forwards captured errors to the global logger with UNKNOWN type', () => {
    const globalLogger = jest.fn();
    setGlobalErrorLogger(globalLogger);

    enableGlobalJsHandler();

    const installedHandler = mockSetGlobalHandler.mock.calls[0][0] as (
      e: Error,
      isFatal?: boolean
    ) => void;
    installedHandler(new Error('global error'));

    expect(globalLogger).toHaveBeenCalledTimes(1);
    const [error, context] = globalLogger.mock.calls[0] as [Error, ErrorContext];
    expect(error.message).toBe('global error');
    expect(context.errorType).toBe('UNKNOWN');
  });

  it('calls the previous handler after our logger runs', () => {
    enableGlobalJsHandler();

    const installedHandler = mockSetGlobalHandler.mock.calls[0][0] as (
      e: Error,
      isFatal?: boolean
    ) => void;
    installedHandler(new Error('forward test'), true);
    expect(mockPreviousHandler).toHaveBeenCalledWith(new Error('forward test'), true);
  });
});
