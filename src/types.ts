import React from 'react';

export interface ErrorContext {
  timestamp: number;
  platform: string;
  appVersion?: string;
  deviceModel?: string;
  screenName?: string;
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
}

export interface ErrorBoundaryLoggerState {
  hasError: boolean;
  error: Error | null;
}

export type GlobalErrorLogger = (error: Error, context: ErrorContext) => void;
