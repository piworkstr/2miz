import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { db } from './firebase';
import { useSession } from './session';

// Çok dilli altyapı. Şimdilik Türkçe ve İngilizce.
// İngilizce yayından 1-2 ay sonra herkese açılacak; o güne kadar EN_OPEN = false:
// cihaz dili ne olursa olsun uygulama Türkçe açılır, dil seçimi yalnız kurucu çiftte (Biz sekmesi) görünür.
export const EN_OPEN = false;

export type Lang = 'tr' | 'en';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'tr', label: 'Türkçe' },
  { id: 'en', label: 'English' },
];

const KEY = '2miz.lang';

// Cihazın dili (ek paket gerekmez; Hermes Intl'i destekler). Türkçe değilse İngilizce.
function deviceLang(): Lang {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return loc.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  } catch {
    return 'tr';
  }
}

function isLang(v: unknown): v is Lang {
  return v === 'tr' || v === 'en';
}

type Ctx = { lang: Lang; setLang: (l: Lang) => Promise<void> };
const LangCtx = createContext<Ctx>({ lang: 'tr', setLang: async () => {} });

// Öncelik: profildeki seçim (hesap varsa) → bu telefonda yapılan seçim → (EN_OPEN ise) cihaz dili → Türkçe.
export function LangProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useSession();
  const [stored, setStored] = useState<Lang | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => isLang(v) && setStored(v))
      .catch(() => {});
  }, []);

  const fromProfile = isLang(profile?.lang) ? profile.lang : null;
  const lang: Lang = fromProfile ?? stored ?? (EN_OPEN ? deviceLang() : 'tr');

  const setLang = useCallback(
    async (l: Lang) => {
      setStored(l);
      AsyncStorage.setItem(KEY, l).catch(() => {});
      // Profilde de dursun: ileride sunucudan giden bildirimler bu dille yazılacak.
      if (user) await updateDoc(doc(db, 'users', user.uid), { lang: l });
    },
    [user],
  );

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

// Ekran metinleri için kısa yol: const l = useL(); l('Teste başla', 'Take the quiz')
// Çevrilmemiş metinler bulunması kolay olsun diye her iki dil yan yana yazılır.
export function useL() {
  const { lang } = useLang();
  return useCallback((tr: string, en: string) => (lang === 'en' ? en : tr), [lang]);
}

// Dil başına değer seçer (fonksiyon, nesne, liste).
export function pick<V>(lang: Lang, v: { tr: V; en: V }): V {
  return v[lang];
}

// Büyük harfe çevirirken kullanılacak yerel ayar (Türkçe İ/ı kuralları yalnız Türkçede).
export function localeOf(lang: Lang): string {
  return lang === 'en' ? 'en-US' : 'tr-TR';
}
