# react-native-error-boundary-logger

A production-ready React Native Error Boundary with built-in logging utilities.

Catch UI crashes, log errors with rich device context, and keep your app alive — with a simple, fully-typed API.

---

## Problem

React Native applications can silently crash when a component throws during rendering. The native error boundary lifecycle catches these, but wiring up logging, fallback UIs, and reset behaviour takes boilerplate in every project.

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
4. Renders the default fallback UI.

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
    console.log('Timestamp:', context.timestamp);
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

### Async error handling

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

`safeAsync` catches any thrown error and forwards it to the global logger. It returns `undefined` on failure so your app continues running.

---

### Setting app version

```tsx
import { setAppVersion } from 'react-native-error-boundary-logger';

// Call this early in App.tsx
setAppVersion('1.2.3');
```

The version is then automatically included in every `ErrorContext`.

---

## API Reference

### `<ErrorBoundaryLogger>`

| Prop         | Type                                                              | Required | Description                                           |
|--------------|-------------------------------------------------------------------|----------|-------------------------------------------------------|
| `children`   | `React.ReactNode`                                                 | ✅        | The components to protect.                            |
| `fallback`   | `ReactNode \| ((reset: () => void) => ReactNode)`                 | ❌        | Custom fallback UI. Defaults to a built-in error view.|
| `onError`    | `(error: Error, info: React.ErrorInfo, context: ErrorContext) => void` | ❌ | Called when a child throws. Overrides global logger.  |
| `screenName` | `string`                                                          | ❌        | Included in `ErrorContext` for crash location tracking.|

---

### `ErrorContext`

```ts
interface ErrorContext {
  timestamp: number;    // Unix ms timestamp of the error
  platform: string;     // 'ios' | 'android'
  appVersion?: string;  // Set via setAppVersion()
  deviceModel?: string; // Available on Android via Platform.constants
  screenName?: string;  // Set via the screenName prop
}
```

---

### `setGlobalErrorLogger(logger)`

```ts
setGlobalErrorLogger((error: Error, context: ErrorContext) => void): void
```

Registers a global error logger used by all `ErrorBoundaryLogger` components that have no `onError` prop, and by `safeAsync`.

---

### `safeAsync(asyncFn)`

```ts
safeAsync<T>(asyncFn: () => Promise<T>): Promise<T | undefined>
```

Wraps an async function. On error, logs via the global logger and returns `undefined`.

---

### `setAppVersion(version)`

```ts
setAppVersion(version: string): void
```

Sets the app version included in all subsequent `ErrorContext` objects.

---

### `getGlobalLogger()`

```ts
getGlobalLogger(): GlobalErrorLogger | null
```

Returns the currently registered global logger, or `null`.

---

### `buildErrorContext(screenName?)`

```ts
buildErrorContext(screenName?: string): ErrorContext
```

Builds an `ErrorContext` object at the current moment. Useful for constructing context in `safeAsync` or custom logging scenarios.

---

## Design Principles

- **Predictable** — same behaviour every time, no hidden state.
- **Simple API** — one component, one config function, one async helper.
- **Strongly typed** — `strict: true`, `noImplicitAny: true`, full public API types.
- **Zero runtime crashes** — errors in callbacks or fallbacks are silently swallowed.
- **Minimal dependencies** — only React and React Native (peer deps).

---

## License

MIT
