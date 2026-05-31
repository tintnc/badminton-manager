const vndNumberFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

const shortDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
});

const fullDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatNumber(value: number): string {
  return vndNumberFormatter.format(value);
}

export function formatVnd(value: number): string {
  return `${formatNumber(value)} ₫`;
}

export function formatShortDate(date: string | Date): string {
  return shortDateFormatter.format(new Date(date));
}

export function formatFullDate(date: string | Date): string {
  return fullDateFormatter.format(new Date(date));
}
