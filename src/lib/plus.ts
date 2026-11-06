import { router } from 'expo-router';
import { doc, increment, updateDoc } from 'firebase/firestore';
import { dayKey } from './date';
import { db } from './firebase';
import { useSession, type Couple } from './session';

// 2miz Plus: çift aboneliği. Biri öder, ikisi kullanır.
// Ödeme gelince (RevenueCat) çift belgesine `plus` yazılır; bu alanı uygulama yazamaz, kurallar engeller.

// Beta boyunca Plus herkese açık. Satışlar başlayınca false yapılacak.
export const BETA_ALL_OPEN = true;

export const PRICES = {
  monthly: { label: 'Aylık', price: '99,99 TL', per: '/ay' },
  yearly: { label: 'Yıllık', price: '599,99 TL', per: '/yıl', note: 'Ayda ~50 TL · 7 gün ücretsiz' },
};

// Ücretsiz sınırlar. Plus'ta oyun ve çark sınırsız.
export const FREE = { spinsPerDay: 1, gamesPerDay: 1, trips: 1, tripPhotos: 20 };
export const PLUS = { tripPhotos: 100 };

export type PlusInfo = { until: number; by: string; product?: 'monthly' | 'yearly' };

export type PlusState = {
  active: boolean; // Plus özellikleri açık mı (beta dahil)
  paid: boolean; // gerçekten satın alınmış mı
  beta: boolean;
  by: string | null; // kim ödedi
  until: number | null;
};

export function plusOf(couple: Couple | null | undefined): PlusState {
  const p = couple?.plus;
  const paid = !!p && p.until > Date.now();
  return {
    active: paid || BETA_ALL_OPEN,
    paid,
    beta: !paid && BETA_ALL_OPEN,
    by: paid ? p!.by : null,
    until: paid ? p!.until : null,
  };
}

export function usePlus() {
  const { couple } = useSession();
  return plusOf(couple);
}

export const tripPhotoLimit = (plus: PlusState) => (plus.active ? PLUS.tripPhotos : FREE.tripPhotos);

// Sınıra gelince açılan teklif ekranı; `from` başlığı değiştirir.
export type PlusReason = 'wheel' | 'game' | 'trip' | 'tripPhotos' | 'card';
export function openPlus(from: PlusReason = 'card') {
  router.push({ pathname: '/plus', params: { from } });
}

// Günün oyun hakkı: çift belgesinde gün + sayı.
export function gamesToday(couple: Couple | null | undefined) {
  const g = couple?.gameUse;
  return g && g.day === dayKey() ? g.n : 0;
}

export async function countGame(coupleId: string, couple: Couple) {
  const today = dayKey();
  const ref = doc(db, 'couples', coupleId);
  if (couple.gameUse?.day === today) await updateDoc(ref, { 'gameUse.n': increment(1) });
  else await updateDoc(ref, { gameUse: { day: today, n: 1 } });
}
