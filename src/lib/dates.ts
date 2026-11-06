import {
  collection,
  deleteDoc,
  doc,
  documentId,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey } from './date';
import { db } from './firebase';

// Her date günü, gün anahtarıyla saklanır: couples/{id}/dates/2026-11-08
export type DatePlan = {
  id: string; // gün anahtarı
  status: 'proposed' | 'confirmed';
  by: string; // öneren kişi
  instant: boolean; // "Bugün date'teyiz" ile mi başladı
  selfie: string | null; // ortak selfieyi ekleyen kişi (fotoğrafın kendisi photos koleksiyonunda)
};

function datesCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'dates');
}

// Bugünden itibaren planlanmış date'leri canlı dinler.
export function useUpcomingDates(coupleId: string | undefined) {
  const [dates, setDates] = useState<DatePlan[]>([]);
  const today = dayKey();

  useEffect(() => {
    if (!coupleId) return;
    const q = query(datesCol(coupleId), where(documentId(), '>=', today), orderBy(documentId()));
    return onSnapshot(q, (snap) => {
      setDates(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DatePlan, 'id'>) })));
    });
  }, [coupleId, today]);

  return dates;
}

export async function proposeDate(coupleId: string, key: string, uid: string, instant: boolean) {
  await setDoc(doc(datesCol(coupleId), key), {
    status: 'proposed',
    by: uid,
    instant,
    selfie: null,
    createdAt: serverTimestamp(),
  });
}

export async function confirmDate(coupleId: string, key: string) {
  await updateDoc(doc(datesCol(coupleId), key), { status: 'confirmed' });
}

export async function markDateSelfie(coupleId: string, key: string, uid: string) {
  await updateDoc(doc(datesCol(coupleId), key), { selfie: uid });
}

export async function cancelDate(coupleId: string, key: string) {
  await deleteDoc(doc(datesCol(coupleId), key));
}

// Önümüzdeki 14 gün, planlama için.
export function nextDays(count = 14): { key: string; label: string; weekday: string }[] {
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      key: dayKey(d),
      label: i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      weekday: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
    });
  }
  return out;
}
