// Çiftlik bonusu: yönetim panelinden seçilen çifte gönderilen hediye paketi (altın, tecrübe, ambar ürünü).
// Kayıt couples/{id}/bonuses altında durur; çift çiftlikte paketi açınca içindekiler çiftliğe eklenir.
// Bu dosya hem uygulamada hem panelde kullanılır; uygulamaya özel hiçbir şeyi içe almaz.
export type FarmBonus = {
  id: string;
  coins: number;
  xp: number;
  stock: Record<string, number>;
  note: string;
  by: string; // gönderen yöneticinin e-postası
  atMs: number;
  opened?: { by: string; atMs: number } | null;
};

// Paketle gönderilebilen ambar ürünleri (anahtarlar çiftlikteki stok anahtarlarıyla aynı).
export const BONUS_ITEMS: Record<string, string> = {
  bugday: 'Buğday',
  havuc: 'Havuç',
  domates: 'Domates',
  misir: 'Mısır',
  cilek: 'Çilek',
  egg: 'Yumurta',
  milk: 'Süt',
  honey: 'Bal',
  ekmek: 'Ekmek',
  omlet: 'Omlet',
  peynir: 'Peynir',
  kek: 'Kek',
  recel: 'Reçel',
  ballisut: 'Ballı süt',
};
export const BONUS_MAX = { coins: 100000, xp: 5000, item: 99 };

// "500 altın, 50 tecrübe, 3 yumurta"
export function bonusText(b: Pick<FarmBonus, 'coins' | 'xp' | 'stock'>): string {
  const parts: string[] = [];
  if (b.coins > 0) parts.push(`${b.coins} altın`);
  if (b.xp > 0) parts.push(`${b.xp} tecrübe`);
  for (const [k, n] of Object.entries(b.stock ?? {})) if (n > 0) parts.push(`${n} ${(BONUS_ITEMS[k] ?? k).toLocaleLowerCase('tr')}`);
  return parts.join(', ');
}
