// Telefonun yerel saatine göre "2026-11-06" biçiminde gün anahtarı.
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export function prettyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return trDate(new Date(y, m - 1, d), { year: true });
}

// Türkçe tarih yazımı, cihazın Intl ayarından bağımsız. (Bazı telefonlarda toLocaleDateString yerel geceyarısını
// UTC'ye çevirip bir gün öncesini yazıyordu: 30 Aralık → "29 Aralık".)
const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export function trDate(d: Date, o: { month?: 'long' | 'short' | false; year?: boolean; weekday?: 'long' | 'short' } = {}): string {
  const parts: string[] = [];
  if (o.month !== false) parts.push(`${d.getDate()} ${(o.month === 'short' ? TR_MONTHS_SHORT : TR_MONTHS)[d.getMonth()]}`);
  if (o.year) parts.push(String(d.getFullYear()));
  let s = parts.join(' ');
  if (o.weekday) s = `${s} ${(o.weekday === 'short' ? TR_DAYS_SHORT : TR_DAYS)[d.getDay()]}`.trim();
  return s;
}
export const trMonth = (m: number, short = false) => (short ? TR_MONTHS_SHORT : TR_MONTHS)[m]; // m: 0..11
