import * as Notifications from 'expo-notifications';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import type { Couple } from './session';

// Bizim Bahçe: çiftin ortak çiftliği (FarmVille tarzı).
// Tarla ekilir, ürün gerçek zamanla büyür, hasat altın ve tecrübe getirir.
// Ortaklık kuralı: birinin ektiğini diğeri sularsa kalan süre yarıya iner.

export const COLS = 5;
export const TILES = COLS * COLS;

export type CropId = 'bugday' | 'havuc' | 'domates' | 'misir' | 'cilek' | 'gul' | 'aycicegi' | 'kabak';
export type AnimalId = 'tavuk' | 'koyun' | 'inek' | 'ari';
export type DecorId = 'cicek' | 'agac' | 'bank' | 'cesme' | 'ev' | 'kalp';

export const CROPS: Record<CropId, { name: string; art: string; cost: number; mins: number; sell: number; xp: number; lvl: number }> = {
  bugday: { name: 'Buğday', art: '🌾', cost: 2, mins: 30, sell: 6, xp: 2, lvl: 1 },
  havuc: { name: 'Havuç', art: '🥕', cost: 5, mins: 120, sell: 15, xp: 4, lvl: 1 },
  domates: { name: 'Domates', art: '🍅', cost: 8, mins: 240, sell: 25, xp: 7, lvl: 2 },
  misir: { name: 'Mısır', art: '🌽', cost: 12, mins: 480, sell: 40, xp: 10, lvl: 3 },
  cilek: { name: 'Çilek', art: '🍓', cost: 20, mins: 720, sell: 65, xp: 14, lvl: 4 },
  gul: { name: 'Aşk gülü', art: '🌹', cost: 30, mins: 1440, sell: 110, xp: 30, lvl: 3 },
  aycicegi: { name: 'Ayçiçeği', art: '🌻', cost: 25, mins: 1440, sell: 90, xp: 20, lvl: 5 },
  kabak: { name: 'Bal kabağı', art: '🎃', cost: 40, mins: 1440, sell: 140, xp: 26, lvl: 6 },
};

export const ANIMALS: Record<
  AnimalId,
  { name: string; art: string; product: string; cost: number; mins: number; sell: number; xp: number; lvl: number }
> = {
  tavuk: { name: 'Tavuk', art: '🐔', product: '🥚', cost: 60, mins: 240, sell: 15, xp: 3, lvl: 2 },
  koyun: { name: 'Koyun', art: '🐑', product: '🧶', cost: 150, mins: 360, sell: 35, xp: 5, lvl: 3 },
  inek: { name: 'İnek', art: '🐄', product: '🥛', cost: 200, mins: 480, sell: 45, xp: 6, lvl: 4 },
  ari: { name: 'Arı kovanı', art: '🐝', product: '🍯', cost: 300, mins: 720, sell: 80, xp: 8, lvl: 5 },
};

export const DECOR: Record<DecorId, { name: string; art: string; cost: number; xp: number; lvl: number }> = {
  cicek: { name: 'Çiçeklik', art: '🌷', cost: 15, xp: 1, lvl: 1 },
  agac: { name: 'Ağaç', art: '🌳', cost: 40, xp: 2, lvl: 1 },
  bank: { name: 'Bank', art: '🪑', cost: 60, xp: 3, lvl: 2 },
  kalp: { name: 'Kalp çiçek', art: '💐', cost: 80, xp: 4, lvl: 3 },
  cesme: { name: 'Çeşme', art: '⛲', cost: 250, xp: 10, lvl: 5 },
  ev: { name: 'Ev', art: '🏡', cost: 500, xp: 20, lvl: 6 },
};

export type Tile =
  | { k: 'locked' }
  | { k: 'soil' }
  | { k: 'crop'; crop: CropId; by: string; at: number; ready: number; watered?: string }
  | { k: 'animal'; item: AnimalId; last: number }
  | { k: 'decor'; item: DecorId };

export type FarmLog = { by: string; text: string; at: number };
export type Farm = { coins: number; xp: number; tiles: Tile[]; log: FarmLog[] };

// Başlangıç: ortada 6 tarla, köşede ev ve ağaç, gerisi açılmayı bekleyen arazi.
export function newFarm(): Farm {
  const tiles: Tile[] = Array.from({ length: TILES }, () => ({ k: 'locked' as const }));
  for (const i of [6, 7, 8, 11, 12, 13]) tiles[i] = { k: 'soil' };
  tiles[0] = { k: 'decor', item: 'ev' };
  tiles[4] = { k: 'decor', item: 'agac' };
  return { coins: 50, xp: 0, tiles, log: [] };
}

export function farmOf(couple: Couple | null | undefined): Farm {
  return couple?.farm ?? newFarm();
}

// Seviye: 2 için 30, 3 için 90, 4 için 180 tecrübe… (15·n·(n-1))
export const levelStart = (l: number) => 15 * l * (l - 1);
export function levelOf(xp: number) {
  let l = 1;
  while (xp >= levelStart(l + 1)) l++;
  return { level: l, from: levelStart(l), to: levelStart(l + 1) };
}

// İlk arazi 40 altın, her yeni arazi 20 altın daha pahalı.
export const unlockCost = (f: Farm) => 40 + 20 * Math.max(0, f.tiles.filter((t) => t.k !== 'locked').length - 8);

export function timeLeft(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m >= 60) return `${Math.floor(m / 60)} sa ${m % 60 ? `${m % 60} dk` : ''}`.trim();
  return `${m} dk`;
}

export function farmSummary(f: Farm, uid: string, now = Date.now()) {
  let ready = 0;
  let canWater = 0;
  for (const t of f.tiles) {
    if (t.k === 'crop') {
      if (now >= t.ready) ready++;
      else if (t.by !== uid && !t.watered) canWater++;
    }
    if (t.k === 'animal' && now >= t.last + ANIMALS[t.item].mins * 60000) ready++;
  }
  return { ready, canWater };
}

// ---------- Hamleler ----------

export type Action =
  | { a: 'plant'; i: number; crop: CropId }
  | { a: 'water'; i: number }
  | { a: 'harvest'; i: number }
  | { a: 'collect'; i: number }
  | { a: 'animal'; i: number; item: AnimalId }
  | { a: 'decor'; i: number; item: DecorId }
  | { a: 'unlock'; i: number }
  | { a: 'remove'; i: number }
  | { a: 'all'; i: -1 };

export type Result = { farm: Farm; text: string; gained?: number; ready?: number };

// Saf kural fonksiyonu: hata mesajı ya da yeni çiftlik döner.
export function applyAction(f0: Farm, act: Action, uid: string, name: string, now: number): Result | string {
  const f: Farm = { ...f0, tiles: [...f0.tiles], log: [...f0.log] };
  if (act.a === 'all') {
    let sum = 0;
    let xp = 0;
    f.tiles = f.tiles.map((t) => {
      if (t.k === 'crop' && now >= t.ready) {
        sum += CROPS[t.crop].sell;
        xp += CROPS[t.crop].xp;
        return { k: 'soil' };
      }
      if (t.k === 'animal' && now >= t.last + ANIMALS[t.item].mins * 60000) {
        sum += ANIMALS[t.item].sell;
        xp += ANIMALS[t.item].xp;
        return { ...t, last: now };
      }
      return t;
    });
    if (!sum) return 'Toplanacak bir şey yok.';
    f.coins += sum;
    f.xp += xp;
    const text = `${name} bütün ürünleri topladı (+${sum} altın)`;
    f.log = [{ by: uid, text, at: now }, ...f.log].slice(0, 12);
    return { farm: f, text, gained: sum };
  }
  const t = f.tiles[act.i];
  if (!t) return 'Böyle bir yer yok.';
  const { level } = levelOf(f.xp);
  let text = '';
  let gained: number | undefined;
  let ready: number | undefined;

  switch (act.a) {
    case 'plant': {
      const c = CROPS[act.crop];
      if (t.k !== 'soil') return 'Burası ekime hazır değil.';
      if (level < c.lvl) return `${c.name} ${c.lvl}. seviyede açılır.`;
      if (f.coins < c.cost) return 'Yeterli altının yok.';
      f.coins -= c.cost;
      ready = now + c.mins * 60000;
      f.tiles[act.i] = { k: 'crop', crop: act.crop, by: uid, at: now, ready };
      text = `${name} ${c.art} ${c.name.toLowerCase()} ekti`;
      break;
    }
    case 'water': {
      if (t.k !== 'crop') return 'Burada sulanacak bir şey yok.';
      if (t.by === uid) return 'Kendi ektiğini partnerin sular.';
      if (t.watered) return 'Zaten sulandı.';
      if (now >= t.ready) return 'Bu ürün hasada hazır.';
      ready = now + Math.round((t.ready - now) / 2);
      f.tiles[act.i] = { ...t, watered: uid, ready };
      text = `${name} ${CROPS[t.crop].art} suladı, iki kat hızlı büyüyor`;
      break;
    }
    case 'harvest': {
      if (t.k !== 'crop') return 'Hasat edilecek ürün yok.';
      if (now < t.ready) return 'Henüz olmadı.';
      const c = CROPS[t.crop];
      gained = c.sell;
      f.coins += c.sell;
      f.xp += c.xp;
      f.tiles[act.i] = { k: 'soil' };
      text = `${name} ${c.art} hasat etti (+${c.sell} altın)`;
      break;
    }
    case 'collect': {
      if (t.k !== 'animal') return 'Burada hayvan yok.';
      const an = ANIMALS[t.item];
      if (now < t.last + an.mins * 60000) return 'Henüz hazır değil.';
      gained = an.sell;
      f.coins += an.sell;
      f.xp += an.xp;
      f.tiles[act.i] = { ...t, last: now };
      text = `${name} ${an.product} topladı (+${an.sell} altın)`;
      break;
    }
    case 'animal': {
      const an = ANIMALS[act.item];
      if (t.k !== 'soil') return 'Önce boş bir yer seç.';
      if (level < an.lvl) return `${an.name} ${an.lvl}. seviyede açılır.`;
      if (f.coins < an.cost) return 'Yeterli altının yok.';
      f.coins -= an.cost;
      f.tiles[act.i] = { k: 'animal', item: act.item, last: now };
      text = `${name} çiftliğe ${an.art} ${an.name.toLowerCase()} aldı`;
      break;
    }
    case 'decor': {
      const d = DECOR[act.item];
      if (t.k !== 'soil') return 'Önce boş bir yer seç.';
      if (level < d.lvl) return `${d.name} ${d.lvl}. seviyede açılır.`;
      if (f.coins < d.cost) return 'Yeterli altının yok.';
      f.coins -= d.cost;
      f.xp += d.xp;
      f.tiles[act.i] = { k: 'decor', item: act.item };
      text = `${name} bahçeye ${d.art} koydu`;
      break;
    }
    case 'unlock': {
      if (t.k !== 'locked') return 'Bu arazi zaten açık.';
      const cost = unlockCost(f);
      if (f.coins < cost) return `Arazi açmak için ${cost} altın gerek.`;
      f.coins -= cost;
      f.tiles[act.i] = { k: 'soil' };
      text = `${name} yeni arazi açtı`;
      break;
    }
    case 'remove': {
      if (t.k !== 'animal' && t.k !== 'decor') return 'Kaldırılacak bir şey yok.';
      const cost = t.k === 'animal' ? ANIMALS[t.item].cost : DECOR[t.item].cost;
      gained = Math.floor(cost / 2);
      f.coins += gained;
      f.tiles[act.i] = { k: 'soil' };
      text = `${name} bir yeri boşalttı`;
      break;
    }
  }
  f.log = [{ by: uid, text, at: now }, ...f.log].slice(0, 12);
  return { farm: f, text, gained, ready };
}

// Firestore tanımsız alan kabul etmez.
const clean = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export async function farmAction(coupleId: string, uid: string, name: string, act: Action) {
  const ref = doc(db, 'couples', coupleId);
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 'Çift bulunamadı.';
    const r = applyAction(farmOf(snap.data() as Couple), act, uid, name, Date.now());
    if (typeof r !== 'string') tx.update(ref, { farm: clean(r.farm) });
    return r;
  });
  // Ektiğim ürün olunca kendi telefonuma hatırlatma.
  if (typeof res !== 'string' && res.ready && (act.a === 'plant' || act.a === 'water')) {
    const t = res.farm.tiles[act.i];
    if (t.k === 'crop' && t.by === uid) scheduleReady(coupleId, act.i, t.crop, res.ready).catch(() => {});
  }
  return res;
}

async function scheduleReady(coupleId: string, i: number, crop: CropId, at: number) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' || at <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `farm-${coupleId}-${i}`,
    content: {
      title: `${CROPS[crop].art} ${CROPS[crop].name} hasada hazır`,
      body: 'Bizim Bahçe seni bekliyor.',
      data: { type: 'mood', url: '/garden' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
}
