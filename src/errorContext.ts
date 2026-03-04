import { Platform } from 'react-native';
import { ErrorContext, ErrorType } from './types';
import { getErrorMetadata } from './metadata';
import { getBreadcrumbs } from './breadcrumbs';
import { getSnapshot } from './snapshot';

let _appVersion: string | undefined;

/**
 * Set the application version to be included in error context.
 * Call this early in your app's lifecycle (e.g. in App.tsx).
 */
export function setAppVersion(version: string): void {
  _appVersion = version;
}

function getDeviceModel(): string | undefined {
  try {
    if (Platform.OS === 'android') {
      const constants = Platform.constants as { Model?: string };
      return constants.Model ?? undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds an ErrorContext object with device and environment information,
 * including any metadata, breadcrumbs, and snapshot that have been set.
 */
export function buildErrorContext(
  screenName?: string,
  errorType?: ErrorType
): ErrorContext {
  const context: ErrorContext = {
    timestamp: Date.now(),
    platform: Platform.OS,
    appVersion: _appVersion,
    deviceModel: getDeviceModel(),
  };

  if (screenName !== undefined) {
    context.screenName = screenName;
  }

  if (errorType !== undefined) {
    context.errorType = errorType;
  }

  const metadata = getErrorMetadata();
  if (Object.keys(metadata).length > 0) {
    context.metadata = metadata;
  }

  const breadcrumbs = getBreadcrumbs();
  if (breadcrumbs.length > 0) {
    context.breadcrumbs = breadcrumbs;
  }

  const snapshot = getSnapshot();
  if (snapshot !== undefined) {
    context.snapshot = snapshot;
  }

  return context;
}
