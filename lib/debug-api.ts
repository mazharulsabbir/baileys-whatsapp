/**
 * Sensitive diagnostics under `/api/debug/*`.
 * Production: disabled unless `DEBUG_API_ENABLED=true`.
 * Development: enabled unless `DEBUG_API_ENABLED=false`.
 */
export function isDebugApiAllowed(): boolean {
  const flag = process.env.DEBUG_API_ENABLED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}
