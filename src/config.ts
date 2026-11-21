function positive(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  name:
    String(import.meta.env.VITE_OBSERVATORY_NAME || '').trim() ||
    'Observatório Meteorológico | SESC',
  base: (
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? 'http://127.0.0.1:8080/api/v1' : '/api/v1')
  ).replace(/\/+$/, ''),
  demoInitially:
    import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true',
  pollMs: positive(import.meta.env.VITE_POLL_SECONDS, 60) * 1000,
  staleMs: positive(import.meta.env.VITE_STALE_SECONDS, 180) * 1000,
  maxDays: positive(import.meta.env.VITE_MAX_PERIOD_DAYS, 31),
}
