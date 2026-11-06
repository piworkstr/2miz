import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';
import type { Couple } from './session';

// Kuponu yazan kişi "owner"dır; partneri puan harcayarak kuponu açar,
// owner da yerine getirince "kullanıldı" olarak işaretler.
export type Coupon = {
  id: string;
  owner: string;
  title: string;
  cost: number;
  status: 'active' | 'redeemed' | 'used';
  redeemedBy?: string;
};

export const COSTS = [10, 20, 30, 50, 80];

export const IDEAS = [
  'Sabah kahvaltısı benden',
  'Bu akşam film seçme hakkı',
  '30 dakika masaj',
  'Bulaşıklar bir hafta benden',
  'Sevdiğin tatlıyı alıp gelirim',
  'Bir gün boyunca "evet" derim',
  'Telefonsuz akşam yemeği',
  'Seçtiğin yere date',
];

// Ücretsiz planda aynı anda en fazla 3 aktif kupon (premium devreye girince açılır).
export const FREE_COUPON_LIMIT = 3;
export const PREMIUM_LIMITS_ENABLED = false;

// İki partner aynı puanı kazanır; herkesin harcadığı ayrı tutulur.
export function walletOf(couple: Couple, uid: string): number {
  return Math.max(0, (couple.points ?? 0) - (couple.spent?.[uid] ?? 0));
}

function col(coupleId: string) {
  return collection(db, 'couples', coupleId, 'coupons');
}

export function useCoupons(coupleId: string | undefined) {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      query(col(coupleId), orderBy('createdAt', 'desc')),
      (snap) => setCoupons(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Coupon, 'id'>) }))),
      () => setCoupons([]),
    );
  }, [coupleId]);
  return coupons;
}

export async function createCoupon(coupleId: string, owner: string, title: string, cost: number) {
  await addDoc(col(coupleId), { owner, title: title.trim(), cost, status: 'active', createdAt: serverTimestamp() });
}

export async function removeCoupon(coupleId: string, id: string) {
  await deleteDoc(doc(col(coupleId), id));
}

export async function markUsed(coupleId: string, id: string) {
  await updateDoc(doc(col(coupleId), id), { status: 'used', usedAt: serverTimestamp() });
}

// Puanı düşüp kuponu açmak tek işlemde yapılır; iki kişi aynı anda basarsa bile puan bir kez düşer.
export async function redeemCoupon(coupleId: string, couponId: string, uid: string) {
  const coupleRef = doc(db, 'couples', coupleId);
  const couponRef = doc(col(coupleId), couponId);
  await runTransaction(db, async (tx) => {
    const [c, k] = [await tx.get(coupleRef), await tx.get(couponRef)];
    if (!c.exists() || !k.exists()) throw new Error('Kupon bulunamadı.');
    const couple = c.data() as Couple;
    const coupon = k.data() as Coupon;
    if (coupon.status !== 'active') throw new Error('Bu kupon zaten açılmış.');
    if (coupon.owner === uid) throw new Error('Kendi kuponunu açamazsın.');
    if (walletOf(couple, uid) < coupon.cost) throw new Error('Yeterli puanın yok.');
    tx.update(coupleRef, { [`spent.${uid}`]: (couple.spent?.[uid] ?? 0) + coupon.cost });
    tx.update(couponRef, { status: 'redeemed', redeemedBy: uid, redeemedAt: serverTimestamp() });
  });
}
