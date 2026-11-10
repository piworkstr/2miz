import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useLang } from './i18n';
import { useOnboarding } from './onboarding';
import { useSession } from './session';
import { getTheme, type ThemeId } from './theme';

// Her kişinin teması kendi profilinde saklanır; partnerin seçimi seni etkilemez.
// Hesap açılmadan önce, testte seçilen tema kullanılır.
export function useTheme() {
  const { profile } = useSession();
  const { theme } = useOnboarding();
  const { lang } = useLang();
  return getTheme(profile?.theme ?? theme, lang);
}

export async function saveTheme(uid: string, id: ThemeId) {
  await updateDoc(doc(db, 'users', uid), { theme: id });
}
