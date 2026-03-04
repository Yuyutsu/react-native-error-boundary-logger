import { Platform } from 'react-native';
import { ErrorContext } from './types';

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
 * Builds an ErrorContext object with device and environment information.
 */
export function buildErrorContext(screenName?: string): ErrorContext {
  const context: ErrorContext = {
    timestamp: Date.now(),
    platform: Platform.OS,
    appVersion: _appVersion,
    deviceModel: getDeviceModel(),
  };

  if (screenName !== undefined) {
    context.screenName = screenName;
  }

  return context;
}
