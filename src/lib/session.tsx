import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db } from './firebase';

export type Profile = {
  name: string;
  theme?: string;
  loveLanguage?: string;
  birthDate?: string; // YYYY-MM-DD
  interests?: string[];
  notifyTime?: 'sabah' | 'ogle' | 'aksam';
  onboarded?: boolean;
};

export type Couple = {
  id: string;
  members: string[];
  names: Record<string, string>;
  points: number;
  streak: number;
  lastCompleteDay: string | null;
  startDate?: string; // birliktelik başlangıcı, YYYY-MM-DD
  spent?: Record<string, number>; // kuponlara harcanan puan, kişi başı
  passes?: Record<string, { week: string; used: number }>; // haftalık "şimdi olmaz" hakları
  lastGameDay?: string; // günün oyun puanı bir kez verilsin
  bestStreak?: number;
  seenTasks?: string[]; // yakın zamanda gösterilen görevler (tekrar etmesin)
  seenGames?: { thisthat?: number[]; knowme?: number[] }; // oyunlarda görülen sorular
  status?: 'sevgili' | 'nisanli' | 'evli' | 'uzak';
};

type Session = {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  couple: Couple | null;
  partnerId: string | null;
  partnerName: string;
  partnerProfile: Profile | null;
};

const SessionContext = createContext<Session>({
  loading: true,
  user: null,
  profile: null,
  couple: null,
  partnerId: null,
  partnerName: '',
  partnerProfile: null,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [coupleReady, setCoupleReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

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
      setProfileReady(true);
      return;
    }
    setCoupleReady(false);
    setProfileReady(false);

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setProfile(snap.exists() ? (snap.data() as Profile) : null);
      setProfileReady(true);
    }, () => setProfileReady(true));

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

  // Partnerin profili (sevgi dili, doğum günü, ilgi alanları). Kurallar bunu sadece eşleşmiş partnere açar.
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (!partnerId) {
      setPartnerProfile(null);
      return;
    }
    return onSnapshot(
      doc(db, 'users', partnerId),
      (snap) => setPartnerProfile(snap.exists() ? (snap.data() as Profile) : null),
      () => setPartnerProfile(null),
    );
  }, [partnerId]);

  return (
    <SessionContext.Provider
      value={{ loading: !authReady || !coupleReady || !profileReady, user, profile, couple, partnerId, partnerName, partnerProfile }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
