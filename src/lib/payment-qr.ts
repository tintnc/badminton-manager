import type { Member, Session } from '@/core/models/types';

export const guestPaymentQrConfig = {
  bank: 'ACB',
  account: '2180347',
};

export function normalizeTransferName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function buildGuestPaymentDateText(unpaidSessions: Session[]): string {
  const sortedDates = unpaidSessions
    .map(session => new Date(session.date))
    .toSorted((a, b) => a.getTime() - b.getTime());
  if (sortedDates.length === 0) return '';

  const firstMonth = sortedDates[0].getMonth();
  const firstYear = sortedDates[0].getFullYear();
  const isSameMonth = sortedDates.every(date => date.getMonth() === firstMonth && date.getFullYear() === firstYear);
  const twoDigits = (value: number) => String(value).padStart(2, '0');

  if (isSameMonth) {
    const days = sortedDates.map(date => twoDigits(date.getDate())).join(' & ');
    return `${days} ${twoDigits(firstMonth + 1)}${firstYear}`;
  }

  return sortedDates
    .map(date => `${twoDigits(date.getDate())}${twoDigits(date.getMonth() + 1)}${date.getFullYear()}`)
    .join(' & ');
}

export function buildGuestPaymentDescription(member: Member, unpaidSessions: Session[]): string {
  const displayName = normalizeTransferName(member.nickname || member.name);
  const dateText = buildGuestPaymentDateText(unpaidSessions);
  return `${displayName} THANH TOAN CAU LONG ${dateText}`.trim();
}

export function buildSepayQrUrl(amount: number, description: string): string {
  const params = new URLSearchParams({
    bank: guestPaymentQrConfig.bank,
    acc: guestPaymentQrConfig.account,
    template: '',
    amount: String(amount),
    des: description,
  });

  return `https://qr.sepay.vn/img?${params.toString()}`;
}
