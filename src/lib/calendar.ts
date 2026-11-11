import * as Cal from 'expo-calendar/legacy';
import { addDoc, collection, deleteDoc, doc, documentId, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey, trMonth } from './date';
import { db } from './firebase';
import { notifyPartner } from './push';

// Ortak takvim: uygulama içi planlar (kimin olduğu: kişi kimliği ya da "both") ve
// isteğe bağlı olarak telefon takviminden paylaşılan meşguliyetler.
export type CalEvent = {
  id: string;
  day: string; // YYYY-MM-DD
  time?: string; // HH:MM
  title: string;
  owner: string; // uid ya da 'both'
  by: string;
  createdAtMs: number;
};

export type BusyItem = { day: string; start?: string; end?: string; title?: string; allDay?: boolean };
export type Busy = { mode: 'titles' | 'busy'; items: BusyItem[]; syncedAtMs: number };

const eventsCol = (coupleId: string) => collection(db, 'couples', coupleId, 'events');

export const monthRange = (y: number, m: number) => {
  const mm = String(m + 1).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-31` };
};

// Bir aydaki planlar (tek alanda aralık sorgusu, ek dizin gerektirmez).
export function useMonthEvents(coupleId: string | undefined, y: number, m: number) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    if (!coupleId) return;
    const { from, to } = monthRange(y, m);
    return onSnapshot(
      query(eventsCol(coupleId), where('day', '>=', from), where('day', '<=', to)),
      (snap) =>
        setEvents(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<CalEvent, 'id'>) }))
            .sort((a, b) => (a.day + (a.time ?? '99')).localeCompare(b.day + (b.time ?? '99'))),
        ),
      () => setEvents([]),
    );
  }, [coupleId, y, m]);
  return events;
}

// Ayın günlerine ait belgeler (date'ler ve görev günleri), kimliği gün olan koleksiyonlardan.
export function useMonthDocs<T>(coupleId: string | undefined, col: 'dates' | 'days', y: number, m: number) {
  const [docs, setDocs] = useState<Record<string, T>>({});
  useEffect(() => {
    if (!coupleId) return;
    const { from, to } = monthRange(y, m);
    return onSnapshot(
      query(collection(db, 'couples', coupleId, col), where(documentId(), '>=', from), where(documentId(), '<=', to)),
      (snap) => setDocs(Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as T]))),
      () => setDocs({}),
    );
  }, [coupleId, col, y, m]);
  return docs;
}

export async function addEvent(
  coupleId: string,
  e: Omit<CalEvent, 'id' | 'createdAtMs'>,
  notify?: { to: string | null; fromName: string },
) {
  await addDoc(eventsCol(coupleId), { ...e, title: e.title.trim().slice(0, 60), createdAtMs: Date.now() });
  if (notify?.to && e.owner !== e.by) {
    const [y, mo, d] = e.day.split('-').map(Number);
    const when = `${d} ${trMonth(mo - 1)}${e.time ? ` ${e.time}` : ''}`;
    const what = e.owner === 'both' ? 'ortak plan ekledi' : 'senin için plan ekledi';
    notifyPartner(notify.to, `${notify.fromName} ${what} 📅`, `${e.title} · ${when}`, { type: 'message', url: '/' });
  }
}

export async function deleteEvent(coupleId: string, id: string) {
  await deleteDoc(doc(eventsCol(coupleId), id));
}

export function useBusy(coupleId: string | undefined, uid: string | null | undefined) {
  const [busy, setBusy] = useState<Busy | null>(null);
  useEffect(() => {
    if (!coupleId || !uid) return;
    return onSnapshot(
      doc(db, 'couples', coupleId, 'busy', uid),
      (s) => setBusy((s.data() as Busy | undefined) ?? null),
      () => setBusy(null),
    );
  }, [coupleId, uid]);
  return busy;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Telefon takvimindeki önümüzdeki 35 günü paylaşır. "busy" seçilirse başlıklar gönderilmez, sadece saatler.
export async function syncPhoneCalendar(coupleId: string, uid: string, mode: 'titles' | 'busy') {
  const perm = await Cal.requestCalendarPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('permission');
  const cals = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 35 * 86400000);
  const events = cals.length
    ? await Cal.getEventsAsync(
        cals.map((c) => c.id),
        start,
        end,
      )
    : [];
  const items: BusyItem[] = events.slice(0, 200).map((e) => {
    const s = new Date(e.startDate);
    const en = new Date(e.endDate);
    return {
      day: dayKey(s),
      allDay: !!e.allDay,
      ...(e.allDay ? {} : { start: hhmm(s), end: hhmm(en) }),
      ...(mode === 'titles' && e.title ? { title: e.title.slice(0, 40) } : {}),
    };
  });
  await setDoc(doc(db, 'couples', coupleId, 'busy', uid), { mode, items, syncedAtMs: Date.now() });
  await updateDoc(doc(db, 'users', uid), { calendarShare: mode });
}

export async function stopCalendarShare(coupleId: string, uid: string) {
  await deleteDoc(doc(db, 'couples', coupleId, 'busy', uid)).catch(() => {});
  await updateDoc(doc(db, 'users', uid), { calendarShare: null });
}
