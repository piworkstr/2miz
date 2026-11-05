import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useSession } from './session';
import { getTheme, type ThemeId } from './theme';

// Her kişinin teması kendi profilinde saklanır; partnerin seçimi seni etkilemez.
export function useTheme() {
  const { profile } = useSession();
  return getTheme(profile?.theme);
}

export async function saveTheme(uid: string, id: ThemeId) {
  await updateDoc(doc(db, 'users', uid), { theme: id });
}
