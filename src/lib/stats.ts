import { useFocusEffect } from 'expo-router';
import { trDate } from './date';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { db } from './firebase';
import type { LoveLanguage } from './loveLanguage';

export type CoupleStats = { days: number; games: number; photos: number; coupons: number };

// Biz ekranına her girildiğinde sayıları sunucudan sayar (belgeleri indirmeden).
export function useCoupleStats(coupleId: string | undefined) {
  const [stats, setStats] = useState<CoupleStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!coupleId) return;
      let alive = true;
      const col = (name: string) => collection(db, 'couples', coupleId, name);
      const count = (q: ReturnType<typeof query>) =>
        getCountFromServer(q)
          .then((s) => s.data().count)
          .catch(() => 0);
      Promise.all([
        count(query(col('days'), where('rewarded', '==', true))),
        count(query(col('games'), where('status', '==', 'done'))),
        count(query(col('photos'))),
        count(query(col('coupons'), where('status', '==', 'used'))),
      ]).then(([days, games, photos, coupons]) => alive && setStats({ days, games, photos, coupons }));
      return () => {
        alive = false;
      };
    }, [coupleId]),
  );
  return stats;
}

function parse(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// Bir sonraki yıllık tekrara (doğum günü, yıl dönümü) kaç gün kaldı.
export function daysUntilYearly(key: string): { days: number; years: number } {
  const { y, m, d } = parse(key);
  const t = today();
  let next = new Date(t.getFullYear(), m - 1, d);
  if (next < t) next = new Date(t.getFullYear() + 1, m - 1, d);
  return { days: Math.round((next.getTime() - t.getTime()) / 86400000), years: next.getFullYear() - y };
}

// Gün sayacında sıradaki yuvarlak sayı (100, 200 … 1000, 1500 …).
export function nextMilestone(dayCount: number): { at: number; inDays: number } {
  const step = dayCount < 1000 ? 100 : 500;
  const at = Math.floor(dayCount / step) * step + step;
  return { at, inDays: at - dayCount };
}

export function birthdayLabel(key: string) {
  const { m, d } = parse(key);
  return trDate(new Date(2000, m - 1, d));
}

// Partnerin sevgi diline göre küçük bir öneri.
export const LOVE_TIPS: Record<LoveLanguage, (name: string) => string> = {
  soz: (n) => `${n} güzel sözlerle beslenir. Bugün ona neden sevdiğini bir cümleyle yaz.`,
  zaman: (n) => `${n} için en değerli şey birlikte zaman. Bu hafta telefonsuz bir akşam ayır.`,
  hediye: (n) => `${n} düşünülmüş olmayı sever. Küçük ama ona özel bir sürpriz hazırla.`,
  temas: (n) => `${n} sarılınca sevildiğini hisseder. Bugün sebepsiz uzun bir sarılma ver.`,
  hizmet: (n) => `${n} için sevgi, yükünü paylaşmak demek. Onun bir işini habersizce hallet.`,
};
