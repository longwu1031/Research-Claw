/**
 * Cron expression to human-readable string mapper.
 *
 * Maps the 5 known preset cron expressions to localized human-readable strings.
 * Unknown expressions fall back to the raw expression string.
 */

const CRON_MAP: Record<string, { en: string; zh: string }> = {
  '0 7 * * *':   { en: 'Daily at 07:00',      zh: '每天 07:00' },
  '0 8 * * 1':   { en: 'Mondays at 08:00',    zh: '每周一 08:00' },
  '0 9 * * *':   { en: 'Daily at 09:00',      zh: '每天 09:00' },
  '0 9 * * 1-5': { en: 'Weekdays at 09:00',   zh: '工作日 09:00' },
  '0 17 * * 5':  { en: 'Fridays at 17:00',    zh: '每周五 17:00' },
};

export function cronToHuman(expr: string, locale: string = 'en'): string {
  const entry = CRON_MAP[expr.trim()];
  if (!entry) return expr; // fallback to raw expression for unknown patterns
  return locale.startsWith('zh') ? entry.zh : entry.en;
}
