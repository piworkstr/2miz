import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { DayDoc } from './daily';
import { dayKey } from './date';
import { db } from './firebase';

export const BONUS_POINTS = 5;

// Geçmiş günler, en yeni en üstte (belge kimlikleri "YYYY-MM-DD").
export function useDays(coupleId: string | undefined, max = 90) {
  const [days, setDays] = useState<{ key: string; day: DayDoc }[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      query(collection(db, 'couples', coupleId, 'days'), orderBy(documentId(), 'desc'), limit(max)),
      (snap) => setDays(snap.docs.map((d) => ({ key: d.id, day: d.data() as DayDoc }))),
      () => setDays([]),
    );
  }, [coupleId, max]);
  return days;
}

export async function toggleFavorite(coupleId: string, taskId: string, on: boolean) {
  await updateDoc(doc(db, 'couples', coupleId), { favorites: on ? arrayUnion(taskId) : arrayRemove(taskId) });
}

// Çarktan çıkan görev yapıldı: güne yazılır, puan günde bir kez verilir.
export async function completeBonus(coupleId: string, taskId: string, uid: string) {
  const key = dayKey();
  const coupleRef = doc(db, 'couples', coupleId);
  const ref = doc(db, 'couples', coupleId, 'days', key);
  return runTransaction(db, async (tx) => {
    const [c, d] = [await tx.get(coupleRef), await tx.get(ref)];
    if (!c.exists()) return false;
    const data = c.data() as { points: number; lastBonusDay?: string };
    if (data.lastBonusDay === key) return false;
    if (d.exists()) tx.update(ref, { bonus: { taskId, by: uid, atMs: Date.now() } });
    tx.update(coupleRef, { points: data.points + BONUS_POINTS, lastBonusDay: key });
    return true;
  });
}
