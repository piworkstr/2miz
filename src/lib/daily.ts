import { doc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey, yesterdayKey } from './date';
import { db } from './firebase';
import { pickTask, TASKS, trimSeen } from './tasks';

export type Response = 'accept' | 'decline';

export type Completion = { note: string; at: unknown };

export type DayDoc = {
  sharedTaskId: string;
  separate: Record<string, string>;
  responses: Record<string, Response>;
  completions: Record<string, Completion>;
  rewarded: boolean;
  bonus?: { taskId: string; by: string; atMs: number }; // çarktan çıkıp yapılan bonus görev
  wheel?: WheelSpin; // ortak çark: son çevirme, iki telefonda da aynı görünür
};

export type WheelSpin = {
  spinId: string;
  by: string;
  atMs: number;
  taskId: string;
  slices: string[]; // çevrildiği andaki dilimler (kategoriler)
  k: number; // durduğu dilim
  jitter: number; // dilim içindeki küçük kayma, iki ekranda aynı yerde dursun diye
};

export async function saveSpin(coupleId: string, key: string, spin: WheelSpin) {
  await updateDoc(dayRef(coupleId, key), { wheel: spin });
}

export type DayMode = 'pending' | 'shared' | 'separate';

export const POINTS = { shared: 20, separate: 15 };

function dayRef(coupleId: string, key: string) {
  return doc(db, 'couples', coupleId, 'days', key);
}

// Görevler gün + çift kimliğinden seçilir ve çiftin yakın zamanda gördüğü görevler hariç tutulur.
function buildDay(coupleId: string, members: string[], key: string, seen: string[]): DayDoc {
  const shared = pickTask(`${coupleId}:${key}:shared`, seen);
  const separate: Record<string, string> = {};
  members.forEach((m) => {
    separate[m] = pickTask(`${coupleId}:${key}:${m}`, [...seen, shared.id, ...Object.values(separate)]).id;
  });
  return { sharedTaskId: shared.id, separate, responses: {}, completions: {}, rewarded: false };
}

// Günün belgesini yalnızca yoksa oluşturur (iki telefon aynı anda açsa bile tek kez)
// ve seçilen görevleri çiftin "görülenler" listesine ekler.
async function createDay(coupleId: string, members: string[], key: string) {
  const ref = dayRef(coupleId, key);
  const coupleRef = doc(db, 'couples', coupleId);
  await runTransaction(db, async (tx) => {
    const [daySnap, coupleSnap] = [await tx.get(ref), await tx.get(coupleRef)];
    if (daySnap.exists() || !coupleSnap.exists()) return;
    const seen: string[] = (coupleSnap.data() as { seenTasks?: string[] }).seenTasks ?? [];
    const day = buildDay(coupleId, members, key, seen);
    const picked = [day.sharedTaskId, ...Object.values(day.separate)];
    // Havuzun en az üçte biri her zaman seçilebilir kalsın.
    const keep = Math.max(0, TASKS.length - Math.ceil(TASKS.length / 3));
    tx.set(ref, day);
    tx.update(coupleRef, { seenTasks: trimSeen([...seen.filter((id) => !picked.includes(id)), ...picked], keep) });
  });
}

export function modeOf(day: DayDoc, members: string[]): DayMode {
  const values = members.map((m) => day.responses[m]);
  if (values.includes('decline')) return 'separate';
  if (values.every((v) => v === 'accept')) return 'shared';
  return 'pending';
}

export function useToday(coupleId: string | undefined, members: string[] | undefined) {
  const [day, setDay] = useState<DayDoc | null>(null);
  const key = dayKey();

  useEffect(() => {
    if (!coupleId || !members) return;
    const ref = dayRef(coupleId, key);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setDay(snap.data() as DayDoc);
      } else {
        createDay(coupleId, members, key).catch(() => {});
      }
    });
    // members dizisi her render'da yeni olabilir; kimlik değişmedikçe yeniden abone olmayız.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, key, members?.join(',')]);

  return { day, key };
}

export async function respond(coupleId: string, key: string, uid: string, value: Response) {
  await updateDoc(dayRef(coupleId, key), { [`responses.${uid}`]: value });
}

export async function completeTask(
  coupleId: string,
  key: string,
  uid: string,
  members: string[],
  note: string,
) {
  const coupleRef = doc(db, 'couples', coupleId);
  const ref = dayRef(coupleId, key);

  await runTransaction(db, async (tx) => {
    const daySnap = await tx.get(ref);
    const coupleSnap = await tx.get(coupleRef);
    if (!daySnap.exists() || !coupleSnap.exists()) return;

    const day = daySnap.data() as DayDoc;
    const completions = { ...day.completions, [uid]: { note, at: serverTimestamp() } };
    const allDone = members.every((m) => completions[m]);

    tx.update(ref, { [`completions.${uid}`]: { note: note.trim(), at: serverTimestamp() } });

    // İkiniz de tamamladığınızda puan ve seri bir kez işlenir.
    if (allDone && !day.rewarded) {
      const c = coupleSnap.data() as { points: number; streak: number; lastCompleteDay: string | null };
      const earned = modeOf(day, members) === 'shared' ? POINTS.shared : POINTS.separate;
      const streak = c.lastCompleteDay === yesterdayKey() ? c.streak + 1 : c.lastCompleteDay === key ? c.streak : 1;
      tx.update(ref, { rewarded: true });
      const best = Math.max((c as { bestStreak?: number }).bestStreak ?? 0, streak);
      tx.update(coupleRef, { points: c.points + earned, streak, bestStreak: best, lastCompleteDay: key });
    }
  });
}
