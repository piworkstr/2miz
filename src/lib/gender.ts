// Cinsiyet isteğe bağlıdır ve herkes yalnızca kendini yanıtlar. Partnerin cinsiyeti hiçbir yerde varsayılmaz,
// eşleşmeyi etkilemez; yalnızca görev ve mekan tekliflerini kişiye göre sıralamak ve avatarı başlatmak için kullanılır.
export type Gender = 'f' | 'm';
export const GENDER_OPTIONS: { id: Gender | ''; label: string; en: string }[] = [
  { id: 'f', label: 'Kadın', en: 'Woman' },
  { id: 'm', label: 'Erkek', en: 'Man' },
  { id: '', label: 'Belirtmek istemiyorum', en: 'Prefer not to say' },
];
// Mekan teklifi kime uygun (boş = herkes).
export const AUDIENCE_OPTIONS: { id: Gender | ''; label: string }[] = [
  { id: '', label: 'Herkes' },
  { id: 'f', label: 'Kadınlar' },
  { id: 'm', label: 'Erkekler' },
];
