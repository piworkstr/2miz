import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db } from './firebase';

export const LAST_EMAIL_KEY = '2miz.lastEmail';

export type Profile = {
  name: string;
  theme?: string;
  loveLanguage?: string;
  birthDate?: string; // YYYY-MM-DD
  phone?: string; // partnerin arayabilmesi için (isteğe bağlı); yalnızca partner görür
  interests?: string[];
  notifyTime?: 'sabah' | 'ogle' | 'aksam';
  onboarded?: boolean;
  avatar?: import('./avatar').AvatarData;
  petNames?: string[]; // partnerine nasıl hitap ettiği
  calendarShare?: 'titles' | 'busy' | null; // telefon takvimini paylaşıyor mu
  mood?: { key: import('./avatar').MoodKey; atMs: number } | null;
  hints?: Record<string, boolean>; // "Anladım" denen ipuçları; ünlem bir daha çıkmaz
  lang?: 'tr' | 'en'; // uygulama dili (src/lib/i18n.tsx)
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
  farm?: import('./farm').Farm; // Bizim Bahçe (ortak çiftlik)
  sea?: import('./dreams').Sea; // Mavi Yolculuk
  home?: import('./dreams').Home; // Sahilde Ev
  dreamBank?: number; // günlük görevden gelen, hayal dünyasında toplanmayı bekleyen altın
  dreamVotes?: Record<string, Record<string, boolean>>; // hangi hayal dünyasını kim istiyor
  dreamNote?: string; // çiftin gerçek hayali (ör. emeklilikte tekneyle koy koy gezmek)
  dreamYear?: number; // gerçek hedefin yılı
  anniversary?: string; // MM-DD, dileklerin açıldığı gün
  askedQ?: string[]; // sorulan hayal soruları
  sceneCount?: number; // birlikte yaşanan sahne sayısı (tekne ve arazi bununla büyür)
  tavlaWins?: Record<string, number>; // tavla skor tablosu (mars 2 sayılır)
  blocksBest?: number; // Birlikte Blok çift rekoru
  lastGameDay?: string; // günün oyun puanı bir kez verilsin
  bestStreak?: number;
  lastRead?: Record<string, number>; // mesajları en son ne zaman okudu
  lastDelivered?: Record<string, number>; // telefonuna en son hangi mesaj ulaştı (mesaj zamanı)
  seenTasks?: string[]; // yakın zamanda gösterilen görevler (tekrar etmesin)
  favorites?: string[]; // favori görevler (arşiv ve çark)
  lastBonusDay?: string; // bonus görev puanı günde bir kez
  activity?: Record<string, Record<string, number>>; // günlük etkileşim puanları (kalp ve iletişim serisi)
  openBonus?: { id: string; taskId: string; by: string; atMs: number }[]; // kabul edilmiş, bekleyen bonus görevler
  seenGames?: { thisthat?: number[]; knowme?: number[] }; // oyunlarda görülen sorular
  status?: 'sevgili' | 'nisanli' | 'evli' | 'uzak';
  living?: 'together' | 'city' | 'far'; // aynı ev / aynı şehir ayrı ev / farklı şehir — görevler buna göre seçilir
  plus?: { until: number; by: string; product?: 'monthly' | 'yearly' }; // 2miz Plus; yalnızca ödeme sunucusu yazar
  gameUse?: { day: string; n: number }; // ücretsizde günlük oyun hakkı
  delReq?: Record<string, import('./delreq').DelReq>; // ortak albümlerde bekleyen silme istekleri
  farmKeep?: unknown; // çiftliğin v3 yedeği (eski sürüm üstüne yazarsa buradan döner)
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
        // Çıkış yapıp tekrar girişte hoş geldin ekranı "Giriş yap"ı öne alsın, e-posta hazır gelsin (şifre saklanmaz).
        if (u?.email) AsyncStorage.setItem(LAST_EMAIL_KEY, u.email).catch(() => {});
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

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as Profile) : null);
        setProfileReady(true);
      },
      () => setProfileReady(true),
    );

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

  const partnerId = couple && user ? (couple.members.find((m) => m !== user.uid) ?? null) : null;
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
  // Ad değişirse profil kazanır; couples.names eşleşme anındaki addır.
  const partnerName = partnerProfile?.name || (partnerId && couple?.names[partnerId]) || 'Partnerin';

  return (
    <SessionContext.Provider
      value={{ loading: !authReady || !coupleReady || !profileReady, user, profile, couple, partnerId, partnerName, partnerProfile }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
