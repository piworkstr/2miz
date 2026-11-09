import * as Notifications from 'expo-notifications';
import { doc, increment, updateDoc } from 'firebase/firestore';
import { dayKey } from './date';
import { db } from './firebase';
import type { Couple } from './session';

// "Kalp" ve iletişim serisi (Snapchat'teki alev gibi).
// Her etkileşim çift belgesine günlük bir sayaç olarak yazılır: activity.YYYY-MM-DD.uid
// Puanlar: mesaj 1, sesli mesaj 2, anlık fotoğraf 2, görev 3, oyun 3, bonus 2, albüm/seyahat/kupon 1.
// Çiftlik: tek başına iş (ekme, toplama, satma) 1; birlikte iş (partnerin ürününü sulamak, sipariş, hasat günü, pazar) 3.
export const WEIGHT = {
  message: 1,
  voice: 2,
  photo: 2,
  task: 3,
  game: 3,
  bonus: 2,
  album: 1,
  trip: 1,
  coupon: 1,
  farm: 1,
  farmTogether: 3,
};
export type ActivityKind = keyof typeof WEIGHT;

export async function logActivity(coupleId: string, uid: string, kind: ActivityKind, times = 1) {
  await updateDoc(doc(db, 'couples', coupleId), { [`activity.${dayKey()}.${uid}`]: increment(WEIGHT[kind] * times) }).catch(() => {});
  // Bugün bir şey yaptın: akşamki "serin bitmek üzere" hatırlatmasına gerek kalmadı.
  Notifications.cancelScheduledNotificationAsync(RISK_ID).catch(() => {});
}

// Çiftlikte art arda onlarca dokunuş kalbi şişirmesin: türe göre günlük üst sınır (bu cihazda, uygulama açıkken).
const DAILY_CAP: Partial<Record<ActivityKind, number>> = { farm: 3, farmTogether: 9 };
const given: Record<string, number> = {};
export function logActivityCapped(coupleId: string, uid: string, kind: ActivityKind) {
  const cap = DAILY_CAP[kind];
  const key = `${dayKey()}.${kind}`;
  if (cap !== undefined && (given[key] ?? 0) + WEIGHT[kind] > cap) return;
  given[key] = (given[key] ?? 0) + WEIGHT[kind];
  logActivity(coupleId, uid, kind);
}

type Activity = Record<string, Record<string, number>>;

function keyDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

export type Bond = {
  level: number; // 0..1: son 7 günün sıcaklığı
  label: string;
  streak: number; // ikinizin de etkileşim kurduğu ardışık günler
  atRisk: boolean; // seri var ama bugün henüz ikiniz de bir şey yapmadınız
  meToday: number;
  themToday: number;
};

const W = [1, 1, 0.85, 0.7, 0.55, 0.4, 0.3];

export function bondOf(couple: Couple | null, uid: string | undefined, partnerId: string | null): Bond {
  const act = (couple?.activity ?? {}) as Activity;
  const get = (k: string, who: string | null | undefined) => (who ? (act[k]?.[who] ?? 0) : 0);
  const val = (k: string) => {
    const a = get(k, uid);
    const b = get(k, partnerId);
    return (a > 0 && b > 0 ? 0.5 : a > 0 || b > 0 ? 0.15 : 0) + Math.min(0.5, (a + b) / 30);
  };
  // Gün bitmeden bugün yüzünden kalp küçülmesin: bugünü yalnızca kalbi büyütüyorsa sayarız.
  const score = (fromToday: boolean) => {
    let sum = 0;
    let wsum = 0;
    for (let i = 0; i < 7; i++) {
      const k = keyDaysAgo(fromToday ? i : i + 1);
      sum += W[i] * val(k);
      wsum += W[i];
    }
    return sum / wsum;
  };
  const level = Math.min(1, Math.max(score(true), score(false)));

  const both = (k: string) => get(k, uid) > 0 && get(k, partnerId) > 0;
  const today = keyDaysAgo(0);
  let streak = 0;
  for (let i = both(today) ? 0 : 1; i < 400 && both(keyDaysAgo(i)); i++) streak++;

  const label = level >= 0.75 ? 'Alev alev' : level >= 0.5 ? 'Sıcacık' : level >= 0.25 ? 'Ilık' : level > 0 ? 'Soğuyor' : 'Kalp üşüyor';
  return { level, label, streak, atRisk: streak > 0 && !both(today), meToday: get(today, uid), themToday: get(today, partnerId) };
}

const RISK_ID = 'streak-risk';

// Seri varken bugün henüz bir şey yapmadıysan saat 21:00'de telefonun kendisi hatırlatır (sunucu gerekmez).
export async function scheduleRiskReminder(bond: Bond, partnerName: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(RISK_ID);
    if (bond.streak < 1 || bond.meToday > 0) return;
    const at = new Date();
    at.setHours(21, 0, 0, 0);
    if (at.getTime() <= Date.now()) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      identifier: RISK_ID,
      content: {
        title: `🔥 ${bond.streak} günlük seriniz bitmek üzere`,
        body: `Bugün ${partnerName} ile henüz hiç iletişim kurmadın. Bir mesaj yeter.`,
        data: { type: 'message', url: '/chat' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  } catch {
    // Expo Go ya da izin yok
  }
}
