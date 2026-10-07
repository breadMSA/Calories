// Local-calendar date helpers. Dates are 'YYYY-MM-DD' strings in the user's own time zone.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toDateString(new Date());
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, days: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function weekday(s: string): string {
  return `週${WEEKDAYS[parseDate(s).getDay()]}`;
}

export function shortDate(s: string): string {
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function longDate(s: string): string {
  const d = parseDate(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${sameYear ? '' : `${d.getFullYear()}年`}${d.getMonth() + 1}月${d.getDate()}日`;
}

/** "今天" / "昨天" / "明天", otherwise the long date. */
export function relativeDay(s: string): string {
  const diff = daysBetween(today(), s);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === 1) return '明天';
  return longDate(s);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
