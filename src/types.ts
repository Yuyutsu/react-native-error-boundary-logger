import React from 'react';

export type ErrorType =
  | 'UI_ERROR'       // Thrown during React component rendering (caught by ErrorBoundaryLogger)
  | 'ASYNC_ERROR'    // Thrown inside an async function wrapped with safeAsync
  | 'NETWORK_ERROR'  // Use this when logging network-layer errors via the global logger
  | 'UNKNOWN';       // Caught by the global JS error handler or an unclassified source

export interface Breadcrumb {
  type: string;
  message: string;
  timestamp: number;
}

export type ErrorMetadata = Record<string, string | number | boolean>;

export interface ErrorContext {
  timestamp: number;
  platform: string;
  appVersion?: string;
  deviceModel?: string;
  screenName?: string;
  errorType?: ErrorType;
  metadata?: ErrorMetadata;
  breadcrumbs?: Breadcrumb[];
  snapshot?: Record<string, unknown>;
}

export interface ErrorBoundaryLoggerProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((reset: () => void) => React.ReactNode);
  onError?: (
    error: Error,
    info: React.ErrorInfo,
    context: ErrorContext
  ) => void;
  screenName?: string;
  /** Suppress duplicate errors (same message + component stack) within this window (ms). */
  dedupeWindowMs?: number;
  /** Drop errors silently after this many per minute. */
  maxErrorsPerMinute?: number;
  /** Print diagnostic console logs with [ErrorBoundaryLogger] prefix. */
  debug?: boolean;
  /** Schedule the logger call asynchronously so it never blocks the UI thread. */
  logAsync?: boolean;
}

export interface ErrorBoundaryLoggerState {
  hasError: boolean;
  error: Error | null;
}

export type GlobalErrorLogger = (error: Error, context: ErrorContext) => void;
