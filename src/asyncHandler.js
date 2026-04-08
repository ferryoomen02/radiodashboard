/**
 * Zorgt dat fouten uit async route-handlers bij Express terechtkomen.
 */
export function asyncHandler(fn) {
  return function asyncRoute(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
