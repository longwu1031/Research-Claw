/**
 * Cron expression to human-readable string converter.
 *
 * Parses standard 5-field cron expressions (minute hour dom month dow)
 * and returns a localized human-readable string.
 *
 * Supported patterns:
 *   - "M H * * *"   → Daily at HH:MM
 *   - "M H * * 1-5" → Weekdays at HH:MM
 *   - "M H * * N"   → Weekly on {day} at HH:MM
 */

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function cronToHuman(expr: string, locale: string = 'en'): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;

  const [minStr, hourStr, , , dow] = parts;
  const minute = parseInt(minStr);
  const hour = parseInt(hourStr);

  if (isNaN(minute) || isNaN(hour)) return expr;

  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const isZh = locale.startsWith('zh');

  if (dow === '*') {
    return isZh ? `每天 ${time}` : `Daily at ${time}`;
  }

  if (dow === '1-5') {
    return isZh ? `工作日 ${time}` : `Weekdays at ${time}`;
  }

  // Single day of week: 0-6
  const dayNum = parseInt(dow);
  if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
    const dayName = isZh ? DAY_NAMES_ZH[dayNum] : DAY_NAMES_EN[dayNum];
    return isZh ? `每${dayName} ${time}` : `${dayName}s at ${time}`;
  }

  // Fallback for complex expressions
  return expr;
}
