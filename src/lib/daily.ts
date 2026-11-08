import { doc, increment, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey, yesterdayKey } from './date';
import { db } from './firebase';
import { logActivity } from './bond';
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
  spins?: number; // bugün kaç kez çevrildi (ret sonrası yeniden çevirme sayılmaz)
};

export type WheelSpin = {
  spinId: string;
  by: string;
  atMs: number;
  taskId: string;
  slices: string[]; // çevrildiği andaki dilimler (kategoriler)
  k: number; // durduğu dilim
  jitter: number; // dilim içindeki küçük kayma, iki ekranda aynı yerde dursun diye
  answers?: Record<string, { text: string; atMs: number }>; // ikisi de yazınca açılır
  decision?: 'accepted' | 'rejected'; // yapılacak görevlerde kabul / ret
  decidedBy?: string;
};

// Yapılacak bonus görev: biri kabul ederse görev listenize eklenir, reddederse yeniden çevrilir.
export async function decideSpin(coupleId: string, key: string, spinId: string, uid: string, accept: boolean) {
  const ref = dayRef(coupleId, key);
  const coupleRef = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx) => {
    const [snap, c] = [await tx.get(ref), await tx.get(coupleRef)];
    const w = (snap.data() as DayDoc | undefined)?.wheel;
    if (!w || w.spinId !== spinId || w.decision || !c.exists()) return false;
    tx.update(ref, { 'wheel.decision': accept ? 'accepted' : 'rejected', 'wheel.decidedBy': uid });
    if (accept) {
      const open = ((c.data() as { openBonus?: OpenBonus[] }).openBonus ?? []).filter((o) => o.taskId !== w.taskId);
      tx.update(coupleRef, { openBonus: [...open, { id: spinId, taskId: w.taskId, by: uid, atMs: Date.now() }].slice(-10) });
    }
    return true;
  });
}

export type OpenBonus = { id: string; taskId: string; by: string; atMs: number };

// Kabul edilen bonus görev tamamlandı: listeden çıkar, puan günde bir kez.
export async function finishOpenBonus(coupleId: string, id: string, uid: string, bonusPoints: number) {
  const key = dayKey();
  const ref = dayRef(coupleId, key);
  const coupleRef = doc(db, 'couples', coupleId);
  const ok = await runTransaction(db, async (tx) => {
    const [c, d] = [await tx.get(coupleRef), await tx.get(ref)];
    if (!c.exists()) return false;
    const data = c.data() as { points: number; lastBonusDay?: string; openBonus?: OpenBonus[] };
    const item = (data.openBonus ?? []).find((o) => o.id === id);
    if (!item) return false;
    const update: Record<string, unknown> = { openBonus: (data.openBonus ?? []).filter((o) => o.id !== id) };
    if (data.lastBonusDay !== key) {
      update.points = data.points + bonusPoints;
      update.lastBonusDay = key;
    }
    tx.update(coupleRef, update);
    if (d.exists()) tx.update(ref, { bonus: { taskId: item.taskId, by: uid, atMs: Date.now() } });
    return true;
  });
  if (ok) logActivity(coupleId, uid, 'bonus');
  return ok;
}

// Bonus göreve cevap: aynı çevirmeye aitse kaydedilir. İkinci cevap gelince ikisi de açılır.
export async function answerSpin(coupleId: string, key: string, spinId: string, uid: string, text: string) {
  const ref = dayRef(coupleId, key);
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const w = (snap.data() as DayDoc | undefined)?.wheel;
    if (!w || w.spinId !== spinId) return { ok: false, both: false };
    tx.update(ref, { [`wheel.answers.${uid}`]: { text: text.trim().slice(0, 500), atMs: Date.now() } });
    const others = Object.keys(w.answers ?? {}).filter((k) => k !== uid);
    return { ok: true, both: others.length > 0 };
  });
  if (res.ok) logActivity(coupleId, uid, 'bonus');
  return res;
}

export async function saveSpin(coupleId: string, key: string, spin: WheelSpin, counted = true) {
  await updateDoc(dayRef(coupleId, key), counted ? { wheel: spin, spins: increment(1) } : { wheel: spin });
}

export type DayMode = 'pending' | 'shared' | 'separate';

export const DREAM_REWARD = 20;

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

export async function completeTask(coupleId: string, key: string, uid: string, members: string[], note: string) {
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
    // Hayal dünyası kumbarasına: 20 altın + seri başına 2 (en çok 20).
    if (allDone && !day.rewarded) {
      const c = coupleSnap.data() as { points: number; streak: number; lastCompleteDay: string | null };
      const earned = modeOf(day, members) === 'shared' ? POINTS.shared : POINTS.separate;
      const streak = c.lastCompleteDay === yesterdayKey() ? c.streak + 1 : c.lastCompleteDay === key ? c.streak : 1;
      tx.update(ref, { rewarded: true });
      const best = Math.max((c as { bestStreak?: number }).bestStreak ?? 0, streak);
      // Gerçek hayattaki emek hayal dünyasına altın olarak gider (Hayalimiz kumbarası).
      const bank = ((c as { dreamBank?: number }).dreamBank ?? 0) + DREAM_REWARD + Math.min(streak, 10) * 2;
      tx.update(coupleRef, { points: c.points + earned, streak, bestStreak: best, lastCompleteDay: key, dreamBank: bank });
    }
  });
  logActivity(coupleId, uid, 'task');
}
