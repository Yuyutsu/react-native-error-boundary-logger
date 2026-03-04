# react-native-error-boundary-logger

A production-ready React Native Error Boundary with built-in logging utilities.

Catch UI crashes, log errors with rich device context, and keep your app alive — with a simple, fully-typed API.

---

## Problem

React Native applications can silently crash when a component throws during rendering. The native error boundary lifecycle catches these, but wiring up logging, fallback UIs, reset behaviour, deduplication, rate limiting, and async error capture takes significant boilerplate in every project.

This library solves that by providing a zero-dependency, TypeScript-first component you can drop in immediately.

---

## Installation

```bash
npm install react-native-error-boundary-logger
# or
yarn add react-native-error-boundary-logger
```

---

## Usage

### Basic usage

```tsx
import { ErrorBoundaryLogger } from 'react-native-error-boundary-logger';

export default function App() {
  return (
    <ErrorBoundaryLogger>
      <YourScreen />
    </ErrorBoundaryLogger>
  );
}
```

When `YourScreen` (or any of its descendants) throws during rendering, the library:

1. Catches the error via React's error boundary lifecycle.
2. Collects device context (platform, timestamp, device model, app version).
3. Calls your `onError` callback (or the global logger if set).
4. Renders the default fallback UI with a **Try again** button.

---

### Custom fallback UI

Pass a **ReactNode** for a static fallback:

```tsx
<ErrorBoundaryLogger fallback={<Text>Oops! Something broke.</Text>}>
  <YourScreen />
</ErrorBoundaryLogger>
```

Pass a **function** to get access to the `reset` callback:

```tsx
<ErrorBoundaryLogger
  fallback={(reset) => (
    <View>
      <Text>Something went wrong.</Text>
      <Button title="Try again" onPress={reset} />
    </View>
  )}
>
  <YourScreen />
</ErrorBoundaryLogger>
```

---

### Logging errors

Provide an `onError` prop to handle errors inline:

```tsx
<ErrorBoundaryLogger
  onError={(error, info, context) => {
    console.log('Error:', error.message);
    console.log('Component stack:', info.componentStack);
    console.log('Platform:', context.platform);
    console.log('Error type:', context.errorType); // 'UI_ERROR'
  }}
>
  <YourScreen />
</ErrorBoundaryLogger>
```

---

### Global logger

Configure a global logger once (e.g. in `App.tsx`) so every boundary reports errors automatically:

```tsx
import { setGlobalErrorLogger } from 'react-native-error-boundary-logger';

setGlobalErrorLogger((error, context) => {
  Sentry.captureException(error, { extra: context });
});
```

If `onError` is **not** provided on the component, the global logger is used instead.

---

### Screen tracking (optional)

Pass `screenName` to identify where a crash happened:

```tsx
<ErrorBoundaryLogger screenName="ProfileScreen">
  <ProfileScreen />
</ErrorBoundaryLogger>
```

The `screenName` is included in the `ErrorContext` sent to your logger.

---

## Advanced Features

### 1 — Error deduplication

Prevent the same error from flooding your logging service when it repeats rapidly (e.g. inside a render loop).

```tsx
<ErrorBoundaryLogger dedupeWindowMs={5000}>
  <YourScreen />
</ErrorBoundaryLogger>
```

Errors with the same message **and** component stack within the window are silently dropped. The window resets automatically on the next unique error or after the window expires.

---

### 2 — Rate limiting

Cap the number of errors reported per minute to protect your backend:

```tsx
<ErrorBoundaryLogger maxErrorsPerMinute={10}>
  <YourScreen />
</ErrorBoundaryLogger>
```

After the limit is reached, errors are silently dropped until the 60-second window resets.

---

### 3 — Global JS error handler

React error boundaries only catch **render** errors. Install a global handler to also catch async errors, event-handler errors, and unhandled promise rejections surfaced by the React Native runtime:

```tsx
import { enableGlobalJsHandler, disableGlobalJsHandler } from 'react-native-error-boundary-logger';

// Call once, early in your app lifecycle
enableGlobalJsHandler();

// Clean up when no longer needed
disableGlobalJsHandler();
```

Uses `ErrorUtils.setGlobalHandler` internally. The previous handler is preserved and called after ours runs. Errors captured this way are classified as `UNKNOWN` in the `ErrorContext`.

---

### 4 — Breadcrumb tracking

Record events leading up to a crash to understand the user journey:

```tsx
import { addBreadcrumb, clearBreadcrumbs } from 'react-native-error-boundary-logger';

// Anywhere in your app
addBreadcrumb({ type: 'navigation', message: 'User opened ProfileScreen' });
addBreadcrumb({ type: 'user_action', message: 'Clicked edit button' });
addBreadcrumb({ type: 'network', message: 'POST /api/profile responded 200' });
```

When an error is captured, the breadcrumb list is automatically attached to the `ErrorContext`:

```ts
context.breadcrumbs = [
  { type: 'navigation', message: 'User opened ProfileScreen', timestamp: 1709000000000 },
  { type: 'user_action', message: 'Clicked edit button', timestamp: 1709000001000 },
  ...
]
```

Up to 50 breadcrumbs are retained (oldest are evicted). Call `clearBreadcrumbs()` to reset.

---

### 5 — Error metadata injection

Attach persistent key/value pairs to every error context (e.g. user ID, tenant, environment):

```tsx
import { setErrorMetadata } from 'react-native-error-boundary-logger';

// Call after login
setErrorMetadata({
  userId: '12345',
  tenant: 'acme',
  environment: 'production',
});
```

Metadata is merged on each call and automatically included in every `ErrorContext`:

```ts
context.metadata = { userId: '12345', tenant: 'acme', environment: 'production' }
```

Call `clearErrorMetadata()` to reset (e.g. on logout).

---

### 6 — Error classification

Every error captured by the library is automatically classified:

| Source | `errorType` |
|---|---|
| `ErrorBoundaryLogger` (render) | `UI_ERROR` |
| `safeAsync` | `ASYNC_ERROR` |
| `enableGlobalJsHandler` | `UNKNOWN` |

Use this field in your logging pipeline to filter or route errors:

```ts
onError={(error, info, context) => {
  if (context.errorType === 'UI_ERROR') {
    sendToUiErrorDashboard(error, context);
  }
}}
```

---

### 7 — State snapshot capture

Store the current UI/app state before a crash to aid debugging:

```tsx
import { captureSnapshot } from 'react-native-error-boundary-logger';

// Call when state changes, or right before a risky operation
captureSnapshot({ currentUser, screenState, formData });
```

The snapshot is automatically included in every subsequent `ErrorContext`:

```ts
context.snapshot = { currentUser: {...}, screenState: 'editing', formData: {...} }
```

Call `clearSnapshot()` to reset.

---

### 8 — Debug mode

Enable verbose console output for local development:

```tsx
<ErrorBoundaryLogger debug>
  <YourScreen />
</ErrorBoundaryLogger>
```

Outputs:
```
[ErrorBoundaryLogger] Captured error: Something went wrong
[ErrorBoundaryLogger] Sending to logger
```

Also logs when errors are suppressed by deduplication or rate limiting.

---

### 9 — Async-safe logging (`logAsync`)

Ensure the logger never blocks the UI thread by scheduling it asynchronously:

```tsx
<ErrorBoundaryLogger logAsync>
  <YourScreen />
</ErrorBoundaryLogger>
```

The logger is called via `setTimeout(0)` so rendering is never delayed.

---

### Async error handling (`safeAsync`)

React error boundaries do not catch async errors. Use `safeAsync` to bridge that gap:

```tsx
import { safeAsync } from 'react-native-error-boundary-logger';

async function loadData() {
  await safeAsync(async () => {
    const data = await fetchUser();
    setUser(data);
  });
}
```

`safeAsync` catches any thrown error, classifies it as `ASYNC_ERROR`, and forwards it to the global logger. It returns `undefined` on failure so your app continues running.

---

### Setting app version

```tsx
import { setAppVersion } from 'react-native-error-boundary-logger';

// Call this early in App.tsx
setAppVersion('1.2.3');
```

The version is then automatically included in every `ErrorContext`.

---

## Production-grade example

```tsx
import React, { useEffect } from 'react';
import {
  ErrorBoundaryLogger,
  setGlobalErrorLogger,
  setAppVersion,
  setErrorMetadata,
  enableGlobalJsHandler,
  addBreadcrumb,
} from 'react-native-error-boundary-logger';
import Sentry from '@sentry/react-native';

export default function App() {
  useEffect(() => {
    // One-time setup
    setAppVersion('3.1.0');
    setGlobalErrorLogger((error, context) => Sentry.captureException(error, { extra: context }));
    enableGlobalJsHandler();

    // After authentication
    setErrorMetadata({ userId: auth.userId, plan: 'pro' });
  }, []);

  return (
    <ErrorBoundaryLogger
      screenName="Root"
      dedupeWindowMs={5000}
      maxErrorsPerMinute={20}
      logAsync
      fallback={(reset) => (
        <View>
          <Text>Something went wrong</Text>
          <Button title="Retry" onPress={reset} />
        </View>
      )}
    >
      <Navigator />
    </ErrorBoundaryLogger>
  );
}

// In a screen component
function ProfileScreen() {
  useEffect(() => {
    addBreadcrumb({ type: 'navigation', message: 'Entered ProfileScreen' });
  }, []);
  // ...
}
```

---

## API Reference

### `<ErrorBoundaryLogger>`

| Prop | Type | Required | Description |
|---|---|---|---|
| `children` | `React.ReactNode` | ✅ | The components to protect. |
| `fallback` | `ReactNode \| ((reset: () => void) => ReactNode)` | ❌ | Custom fallback UI. |
| `onError` | `(error, info, context) => void` | ❌ | Called when a child throws. Overrides global logger. |
| `screenName` | `string` | ❌ | Included in `ErrorContext` for crash location tracking. |
| `dedupeWindowMs` | `number` | ❌ | Suppress identical errors within this window (ms). |
| `maxErrorsPerMinute` | `number` | ❌ | Drop errors silently after this many per minute. |
| `debug` | `boolean` | ❌ | Print `[ErrorBoundaryLogger]` diagnostic logs to console. |
| `logAsync` | `boolean` | ❌ | Schedule logger call asynchronously (never blocks UI). |

---

### `ErrorContext`

```ts
interface ErrorContext {
  timestamp: number;              // Unix ms timestamp of the error
  platform: string;               // 'ios' | 'android'
  appVersion?: string;            // Set via setAppVersion()
  deviceModel?: string;           // Android only, via Platform.constants
  screenName?: string;            // Set via the screenName prop
  errorType?: ErrorType;          // 'UI_ERROR' | 'ASYNC_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN'
  metadata?: ErrorMetadata;       // Set via setErrorMetadata()
  breadcrumbs?: Breadcrumb[];     // Set via addBreadcrumb()
  snapshot?: Record<string, unknown>; // Set via captureSnapshot()
}
```

---

### `ErrorType`

```ts
type ErrorType = 'UI_ERROR' | 'ASYNC_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
```

---

### `Breadcrumb`

```ts
interface Breadcrumb {
  type: string;     // Category (e.g. 'navigation', 'user_action', 'network')
  message: string;  // Human-readable description
  timestamp: number; // Auto-assigned Unix ms timestamp
}
```

---

### `ErrorMetadata`

```ts
type ErrorMetadata = Record<string, string | number | boolean>;
```

---

### Global functions

| Function | Signature | Description |
|---|---|---|
| `setGlobalErrorLogger` | `(logger: GlobalErrorLogger) => void` | Register a global logger. |
| `getGlobalLogger` | `() => GlobalErrorLogger \| null` | Return the current global logger. |
| `setAppVersion` | `(version: string) => void` | Set app version in all future contexts. |
| `buildErrorContext` | `(screenName?, errorType?) => ErrorContext` | Build a context object on demand. |
| `safeAsync` | `<T>(fn: () => Promise<T>) => Promise<T \| undefined>` | Catch async errors and log them. |
| `addBreadcrumb` | `(b: Omit<Breadcrumb, 'timestamp'>) => void` | Add a breadcrumb (max 50 retained). |
| `getBreadcrumbs` | `() => Breadcrumb[]` | Get a copy of stored breadcrumbs. |
| `clearBreadcrumbs` | `() => void` | Remove all breadcrumbs. |
| `setErrorMetadata` | `(metadata: ErrorMetadata) => void` | Merge metadata into the global set. |
| `getErrorMetadata` | `() => ErrorMetadata` | Get a copy of stored metadata. |
| `clearErrorMetadata` | `() => void` | Remove all metadata. |
| `captureSnapshot` | `(data: Record<string, unknown>) => void` | Store a state snapshot. |
| `getSnapshot` | `() => Record<string, unknown> \| undefined` | Get a copy of the stored snapshot. |
| `clearSnapshot` | `() => void` | Clear the stored snapshot. |
| `enableGlobalJsHandler` | `() => void` | Install a global JS error handler (idempotent). |
| `disableGlobalJsHandler` | `() => void` | Remove the global JS error handler and restore the previous one. |

---

## Design Principles

- **Predictable** — same behaviour every time, no hidden state.
- **Simple API** — one component, a handful of config functions, one async helper.
- **Strongly typed** — `strict: true`, `noImplicitAny: true`, full public API types.
- **Zero runtime crashes** — errors in callbacks, loggers, or fallbacks are silently swallowed.
- **Minimal dependencies** — only React and React Native (peer deps).

---

## License

MIT
