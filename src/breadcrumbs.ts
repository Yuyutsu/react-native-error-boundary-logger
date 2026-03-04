import { Breadcrumb } from './types';

const MAX_BREADCRUMBS = 50;
let _breadcrumbs: Breadcrumb[] = [];

/**
 * Record an event breadcrumb. Breadcrumbs are attached to every subsequent
 * `ErrorContext`, providing a trail of user actions leading up to a crash.
 *
 * @example
 * addBreadcrumb({ type: 'navigation', message: 'User opened ProfileScreen' });
 */
export function addBreadcrumb(
  breadcrumb: Omit<Breadcrumb, 'timestamp'>
): void {
  _breadcrumbs.push({ ...breadcrumb, timestamp: Date.now() });
  if (_breadcrumbs.length > MAX_BREADCRUMBS) {
    _breadcrumbs.shift();
  }
}

/** Returns a snapshot of the current breadcrumb list (newest last). */
export function getBreadcrumbs(): Breadcrumb[] {
  return [..._breadcrumbs];
}

/** Removes all stored breadcrumbs. */
export function clearBreadcrumbs(): void {
  _breadcrumbs = [];
}
