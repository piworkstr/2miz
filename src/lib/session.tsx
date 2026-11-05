import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db } from './firebase';

export type Profile = { name: string; theme?: string };

export type Couple = {
  id: string;
  members: string[];
  names: Record<string, string>;
  points: number;
  streak: number;
  lastCompleteDay: string | null;
};

type Session = {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  couple: Couple | null;
  partnerId: string | null;
  partnerName: string;
};

const SessionContext = createContext<Session>({
  loading: true,
  user: null,
  profile: null,
  couple: null,
  partnerId: null,
  partnerName: '',
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [coupleReady, setCoupleReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCouple(null);
      setCoupleReady(true);
      return;
    }
    setCoupleReady(false);

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as Profile) : null);
    });

    // Kullanıcının üyesi olduğu çift belgesini dinler. Partner davet kodunu
    // girdiği anda, davet eden tarafta da eşleşme otomatik görünür.
    const q = query(collection(db, 'couples'), where('members', 'array-contains', user.uid), limit(1));
    const unsubCouple = onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        setCouple(d ? ({ id: d.id, ...d.data() } as Couple) : null);
        setCoupleReady(true);
      },
      () => setCoupleReady(true),
    );

    return () => {
      unsubProfile();
      unsubCouple();
    };
  }, [user]);

  const partnerId = couple && user ? couple.members.find((m) => m !== user.uid) ?? null : null;
  const partnerName = (partnerId && couple?.names[partnerId]) || 'Partnerin';

  return (
    <SessionContext.Provider
      value={{ loading: !authReady || !coupleReady, user, profile, couple, partnerId, partnerName }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
