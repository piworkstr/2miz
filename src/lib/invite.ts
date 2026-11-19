import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang } from './i18n';

// Partner beklerken kullanılan küçük yerel kayıtlar (telefon başına): davet kodu, son gönderim, önceden yazılan kupon.
// Uygulama mağazada yayınlanınca buraya mağaza bağlantısı yazılır; boşken davet mesajına bağlantı satırı eklenmez.
export const INVITE_URL = 'https://testflight.apple.com/join/pyEsWDFD';

export type InviteState = { code: string; sentAt?: number };
const inviteKey = (uid: string) => `biriz.invite.${uid}`;
const draftKey = (uid: string) => `biriz.couponDraft.${uid}`;
const TOUR_KEY = 'biriz.tour.';

async function read<V>(key: string): Promise<V | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : null;
  } catch {
    return null;
  }
}
const write = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

export const loadInvite = (uid: string) => read<InviteState>(inviteKey(uid));
export const saveInvite = (uid: string, s: InviteState) => write(inviteKey(uid), s);
export const clearInvite = (uid: string) => AsyncStorage.removeItem(inviteKey(uid)).catch(() => {});

export type CouponDraft = { title: string; cost: number };
export const loadCouponDraft = (uid: string) => read<CouponDraft>(draftKey(uid));
export const saveCouponDraft = (uid: string, d: CouponDraft) => write(draftKey(uid), d);
export const clearCouponDraft = (uid: string) => AsyncStorage.removeItem(draftKey(uid)).catch(() => {});

export const tourSeen = async (id: string) => (await read<boolean>(TOUR_KEY + id)) === true;
export const markTour = (id: string) => write(TOUR_KEY + id, true);

export function inviteMessage(code: string, lang: Lang, remind: boolean): string {
  const link = INVITE_URL ? (lang === 'en' ? `\nGet the app: ${INVITE_URL}` : `\nUygulamayı indir: ${INVITE_URL}`) : '';
  if (lang === 'en') {
    return remind
      ? `Still waiting for you on "bir iz" 💕${link}\nSign up and enter my invite code: ${code}`
      : `I want to leave a mark with you 💕\n"bir iz" is a diary for couples: a small task every day, a shared album, games.${link}\nSign up and enter my invite code: ${code}`;
  }
  return remind
    ? `"bir iz"de seni bekliyorum 💕${link}\nKayıt ol ve davet kodumu gir: ${code}`
    : `Seninle bir iz bırakmak istiyorum 💕\n"bir iz" çiftler için bir günlük: her gün küçük bir görev, ortak albüm, oyunlar.${link}\nKayıt ol ve davet kodumu gir: ${code}`;
}

// "Dün gönderdin" gibi kısa zaman etiketi.
export function sentLabel(sentAt: number, lang: Lang, now = Date.now()): string {
  const days = Math.floor((now - sentAt) / 86_400_000);
  if (lang === 'en') return days <= 0 ? 'Sent today' : days === 1 ? 'Sent yesterday' : `Sent ${days} days ago`;
  return days <= 0 ? 'Bugün gönderdin' : days === 1 ? 'Dün gönderdin' : `${days} gün önce gönderdin`;
}
