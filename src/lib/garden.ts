import { doc, runTransaction } from 'firebase/firestore';
import { dayKey, yesterdayKey } from './date';
import { db } from './firebase';
import type { Couple } from './session';

// Bizim Bahçe: ikiniz de aynı gün sulayınca bitkiniz bir gün büyür.
// Sulamayı unutunca susar ve solar ama asla ölmez; birlikte sulayınca yeniden canlanır.

export type Garden = {
  water: Record<string, string>; // kim en son hangi gün suladı
  growth: number; // birlikte sulanan gün sayısı
  streak: number; // üst üste birlikte sulanan gün
  best: number; // en uzun seri
  lastBoth?: string;
};

export const STAGES = [
  { at: 0, name: 'Tohum', art: '🌰', line: 'Bugün ikiniz de sularsanız filiz verecek.' },
  { at: 1, name: 'Filiz', art: '🌱', line: 'İlk yaprak çıktı.' },
  { at: 3, name: 'Fide', art: '🌿', line: 'Kökleri tutunuyor.' },
  { at: 7, name: 'Genç bitki', art: '🪴', line: 'Bir haftalık emeğiniz.' },
  { at: 14, name: 'Çiçek açtı', art: '🌷', line: 'İki haftadır birlikte bakıyorsunuz.' },
  { at: 30, name: 'Fidan', art: '🌳', line: 'Bir ay oldu, artık ağaç.' },
  { at: 60, name: 'Meyve verdi', art: '🍎', line: 'Emeklerinizin meyvesi.' },
  { at: 100, name: 'Koca bahçe', art: '🏡', line: 'Yüz gün birlikte. Bu bahçe sizin.' },
];

export function stageOf(growth: number) {
  let i = 0;
  while (i + 1 < STAGES.length && growth >= STAGES[i + 1].at) i++;
  const next = STAGES[i + 1];
  return { stage: STAGES[i], index: i, next, toNext: next ? next.at - growth : 0 };
}

const EMPTY: Garden = { water: {}, growth: 0, streak: 0, best: 0 };

export function gardenOf(couple: Couple | null | undefined): Garden {
  return { ...EMPTY, ...(couple?.garden ?? {}) };
}

function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

// "ok": dün ya da bugün birlikte sulandı · "thirsty": bir gün kaçtı · "wilted": 3+ gün
export function moodOf(g: Garden): 'ok' | 'thirsty' | 'wilted' {
  if (!g.lastBoth || g.growth === 0) return 'ok';
  const gap = daysBetween(g.lastBoth, dayKey());
  if (gap <= 1) return 'ok';
  return gap >= 4 ? 'wilted' : 'thirsty';
}

export function liveStreak(g: Garden) {
  return g.lastBoth === dayKey() || g.lastBoth === yesterdayKey() ? g.streak : 0;
}

// Sular; ikisi de bugün suladıysa büyür. Sonuç: bugün zaten suladıysan null.
export async function waterGarden(coupleId: string, uid: string, partnerId: string) {
  const ref = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const g = gardenOf(snap.data() as Couple);
    const today = dayKey();
    if (g.water[uid] === today) return null;
    const both = g.water[partnerId] === today;
    const next: Garden = { ...g, water: { ...g.water, [uid]: today } };
    if (both) {
      next.growth = g.growth + 1;
      next.streak = g.lastBoth === yesterdayKey() ? g.streak + 1 : 1;
      next.best = Math.max(g.best, next.streak);
      next.lastBoth = today;
    }
    tx.update(ref, { garden: next });
    return { both, grew: both ? stageOf(next.growth).index > stageOf(g.growth).index : false, garden: next };
  });
}
