import { collection, deleteDoc, deleteField, doc, increment, onSnapshot, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';
import { shrinkTo } from './photos';
import type { Couple } from './session';

// Ortak hayal panosu: çiftin gerçekleştirmek istediği şeyler. Her hayalin adı, isteğe bağlı fotoğrafı, hedef tarihi,
// tahmini bütçesi, biriken tutarı ve tamamlanma durumu vardır. İkisi de ekler, düzenler, siler (couples/{id}/dreams).
export type Dream = {
  id: string;
  title: string;
  photo?: string; // base64 JPEG (küçültülmüş)
  date?: string; // hedef: 'YYYY' ya da 'YYYY-MM'
  budget?: number; // TL
  saved?: number; // biriken TL
  done?: number; // gerçekleştiği an (ms)
  donePhoto?: string; // anı fotoğrafı
  rewarded?: boolean; // çiftlik ödülü verildi (geri alınıp yeniden işaretlenince ikinci kez verilmez)
  by: string;
  createdAt: number;
};
export type DreamInput = Pick<Dream, 'title' | 'photo' | 'date' | 'budget' | 'saved'>;

export const DREAM_MAX = 40;
export const DREAM_TITLE_MAX = 80;
export const DREAM_COINS = 100; // gerçekleşen hayal başına çiftlik kumbarasına giden altın
const FIRST_ID = 'ilk';

const col = (coupleId: string) => collection(db, 'couples', coupleId, 'dreams');

export function useDreams(coupleId: string | undefined): Dream[] | null {
  const [list, setList] = useState<Dream[] | null>(null);
  useEffect(() => {
    if (!coupleId) return setList(null);
    return onSnapshot(
      col(coupleId),
      (s) => setList(s.docs.map((d) => ({ ...(d.data() as Omit<Dream, 'id'>), id: d.id })).sort((a, b) => a.createdAt - b.createdAt)),
      () => setList([]),
    );
  }, [coupleId]);
  return list;
}

export const dreamPhoto = (uri: string) => shrinkTo(uri, 640, 0.55);
export const dreamUri = (b64: string) => `data:image/jpeg;base64,${b64}`;

// Boş alanlar belgeden silinir (Firestore undefined kabul etmez).
const fields = (d: DreamInput) => ({
  title: d.title.trim().slice(0, 240),
  photo: d.photo ?? deleteField(),
  date: d.date ?? deleteField(),
  budget: d.budget && d.budget > 0 ? Math.round(d.budget) : deleteField(),
  saved: d.saved && d.saved > 0 ? Math.round(d.saved) : deleteField(),
});

export async function addDream(coupleId: string, uid: string, d: DreamInput) {
  const ref = doc(col(coupleId));
  const b = writeBatch(db);
  const f = fields(d);
  b.set(ref, {
    title: f.title,
    ...(d.photo ? { photo: d.photo } : {}),
    ...(d.date ? { date: d.date } : {}),
    ...(typeof f.budget === 'number' ? { budget: f.budget } : {}),
    ...(typeof f.saved === 'number' ? { saved: f.saved } : {}),
    by: uid,
    createdAt: Date.now(),
  });
  await b.commit();
  return ref.id;
}

export async function editDream(coupleId: string, id: string, d: DreamInput) {
  const b = writeBatch(db);
  b.update(doc(col(coupleId), id), fields(d));
  await b.commit();
}

export const removeDream = (coupleId: string, id: string) => deleteDoc(doc(col(coupleId), id));

// Gerçekleşti: ilk kez işaretlenince çiftlik kumbarasına altın düşer (çiftlik açılınca kendiliğinden alınır).
export async function completeDream(coupleId: string, dream: Dream, donePhoto?: string) {
  const b = writeBatch(db);
  b.update(doc(col(coupleId), dream.id), { done: Date.now(), rewarded: true, ...(donePhoto ? { donePhoto } : {}) });
  if (!dream.rewarded) b.update(doc(db, 'couples', coupleId), { dreamBank: increment(DREAM_COINS) });
  await b.commit();
  return !dream.rewarded;
}
export async function reopenDream(coupleId: string, id: string) {
  const b = writeBatch(db);
  b.update(doc(col(coupleId), id), { done: deleteField() });
  await b.commit();
}

// Eski tek "gerçek hayalimiz" notu panonun ilk kartına taşınır (bir kez; iki telefonda aynı belge kimliği).
export async function migrateNote(couple: Couple, uid: string) {
  const note = couple.dreamNote?.trim();
  if (!note) return;
  const b = writeBatch(db);
  b.set(doc(col(couple.id), FIRST_ID), {
    title: note.slice(0, 240), // eski not 240 karaktere kadar olabilir; olduğu gibi taşınır
    ...(couple.dreamYear ? { date: String(couple.dreamYear) } : {}),
    by: uid,
    createdAt: Date.now(),
  });
  b.update(doc(db, 'couples', couple.id), { dreamNote: deleteField(), dreamYear: deleteField() });
  await b.commit();
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export function dateLabel(date?: string) {
  if (!date) return '';
  const [y, m] = date.split('-');
  return m ? `${MONTHS[parseInt(m, 10) - 1]} ${y}` : y;
}
// Hedefe kalan süre (geçtiyse boş).
export function leftLabel(date: string | undefined, now = Date.now()) {
  if (!date) return '';
  const [y, m] = date.split('-').map((x) => parseInt(x, 10));
  const d = new Date(now);
  const months = (y - d.getFullYear()) * 12 + ((m || 12) - (d.getMonth() + 1));
  if (months < 0) return 'Hedef tarihi geçti';
  if (months === 0) return 'Hedef bu ay';
  if (months < 12) return `Hedefe ${months} ay`;
  const yrs = Math.floor(months / 12);
  return `Hedefe ${yrs} yıl${months % 12 && m ? ` ${months % 12} ay` : ''}`;
}
export const money = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} TL`;
export const parseMoney = (s: string) => {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};
