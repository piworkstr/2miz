// "Nelerden hoşlanırsın?" seçenekleri: tanışma ekranında ve profil düzenlemede aynı liste kullanılır.
export const INTERESTS = [
  'Müzik',
  'Yemek',
  'Doğa',
  'Film ve dizi',
  'Spor',
  'Oyun',
  'Seyahat',
  'Sanat',
  'Kitap',
  'Kahve',
  'Dans',
  'Hayvanlar',
];

// Kayıtlı değer hep Türkçe kalır (profilde ve iki kişinin ortaklarını bulurken aynı olsun); yalnız gösterim çevrilir.
const INTERESTS_EN: Record<string, string> = {
  Müzik: 'Music',
  Yemek: 'Food',
  Doğa: 'Nature',
  'Film ve dizi': 'Movies & TV',
  Spor: 'Sports',
  Oyun: 'Games',
  Seyahat: 'Travel',
  Sanat: 'Art',
  Kitap: 'Books',
  Kahve: 'Coffee',
  Dans: 'Dance',
  Hayvanlar: 'Animals',
};
export const interestLabel = (i: string, lang: 'tr' | 'en' = 'tr') => (lang === 'en' ? (INTERESTS_EN[i] ?? i) : i);
