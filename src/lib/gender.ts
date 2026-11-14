// Cinsiyet isteğe bağlıdır ve herkes yalnızca kendini yanıtlar. Partnerin cinsiyeti hiçbir yerde varsayılmaz,
// eşleşmeyi etkilemez; yalnızca görev ve mekan tekliflerini kişiye göre sıralamak ve avatarı başlatmak için kullanılır.
export type Gender = 'f' | 'm';
export const GENDER_OPTIONS: { id: Gender | ''; label: string }[] = [
  { id: 'f', label: 'Kadın' },
  { id: 'm', label: 'Erkek' },
  { id: '', label: 'Belirtmek istemiyorum' },
];
// Mekan teklifi kime uygun (boş = herkes).
export const AUDIENCE_OPTIONS: { id: Gender | ''; label: string }[] = [
  { id: '', label: 'Herkes' },
  { id: 'f', label: 'Kadınlar' },
  { id: 'm', label: 'Erkekler' },
];
