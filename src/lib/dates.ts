import { logUse } from './usage';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  documentId,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey, trDate } from './date';
import { db } from './firebase';

// Her date günü, gün anahtarıyla saklanır: couples/{id}/dates/2026-11-08
export type DatePlan = {
  id: string; // gün anahtarı
  status: 'proposed' | 'confirmed';
  by: string; // öneren kişi
  instant: boolean; // "Bugün date'teyiz" ile mi başladı
  selfie: string | null; // ortak selfieyi ekleyen kişi (fotoğrafın kendisi photos koleksiyonunda)
  cat?: import('./events').EventCat; // etkinliğin türü: takvimde nokta yerine simge (konser, tiyatro, sinema…)
  fromEvent?: boolean; // date bu etkinlik için açıldı (iptalinde date de silinir); yoksa var olan date'e not eklenmiştir
  what?: string; // ne yapılacak: şehir etkinliğinden planlandıysa etkinliğin adı, saati ve mekanı
  // Date planlayıcıdan geldiyse adım adım program:
  title?: string;
  steps?: import('./datePlan').Step[];
  start?: number; // başlangıç (gün içi dakika)
  total?: number; // yaklaşık tutar (TL)
  seed?: number; // soru adımının soruları bundan türetilir
  done?: number[]; // date günü işaretlenen adımlar
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
  logUse(coupleId, 'date');
}

// Şehir etkinliğinden date planı: o gün için date yoksa öneri açar, varsa yalnızca "ne yapılacak" notunu ekler
// (onaylanmış bir date'in durumu bozulmaz).
export async function planDateFor(coupleId: string, key: string, uid: string, what: string, cat: import('./events').EventCat) {
  const ref = doc(datesCol(coupleId), key);
  const text = what.trim().slice(0, 140);
  if ((await getDoc(ref)).exists()) return updateDoc(ref, { what: text, cat });
  await setDoc(ref, {
    status: 'proposed',
    by: uid,
    instant: false,
    selfie: null,
    what: text,
    cat,
    fromEvent: true,
    createdAt: serverTimestamp(),
  });
  logUse(coupleId, 'date');
}

// Etkinlikten planlanan date'i geri al: date bu etkinlik için açıldıysa (ya da hâlâ öneriyse) silinir;
// önceden var olan, onaylanmış bir date'e yalnızca not eklendiyse date kalır, not ve simge kaldırılır.
export async function unplanDateFor(coupleId: string, plan: DatePlan) {
  const ref = doc(datesCol(coupleId), plan.id);
  if (plan.fromEvent || plan.status === 'proposed') return deleteDoc(ref);
  await updateDoc(ref, { what: deleteField(), cat: deleteField() });
}

// Date planlayıcının planını bir güne yazar: o gün date yoksa öneri açar, varsa durumunu bozmadan programı ekler.
export async function planDateWith(
  coupleId: string,
  key: string,
  uid: string,
  plan: import('./datePlan').Plan,
  title: string,
  what: string,
) {
  const ref = doc(datesCol(coupleId), key);
  const fields = { what, title, steps: plan.steps, start: plan.start, total: plan.total, seed: plan.seed, done: [] };
  if ((await getDoc(ref)).exists()) return updateDoc(ref, fields);
  await setDoc(ref, { status: 'proposed', by: uid, instant: false, selfie: null, ...fields, createdAt: serverTimestamp() });
  logUse(coupleId, 'date');
}
export async function toggleDateStep(coupleId: string, key: string, index: number, on: boolean) {
  await updateDoc(doc(datesCol(coupleId), key), { done: on ? arrayUnion(index) : arrayRemove(index) });
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
      label: i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : trDate(d, { month: 'short' }),
      weekday: trDate(d, { month: false, weekday: 'short' }),
    });
  }
  return out;
}
