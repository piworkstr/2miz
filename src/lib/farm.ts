import * as Notifications from 'expo-notifications';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import type { Couple } from './session';

// Bizim Çiftlik: çiftin ortak çiftliği (2.5D). Amaç: birlikte emek vermek ve emeğin meyvesini birlikte görmek.
// Tarla ekilir, ürün gerçek zamanla büyür; hasat depoya gider, depo satılınca altın olur.
// Ortaklık: birinin ektiğini diğeri sularsa kalan süre yarıya iner ve o hasat "ortak hasat" sayılır.
// Büyük ürünlerin (gül, ayçiçeği, bal kabağı) hasadı iki kişilik sahnedir: Hasat günü.
// Hafta sonu pazar: tezgâhı ikiniz kurarsanız depo bir buçuk katına gider.
// Mevsim gerçek takvimi izler: kışın ürün yavaş büyür.
// Arazi 10x10; kapalı parseller parayla değil ortak hasat sayısıyla açılır (her 10 ortak hasatta bir parsel).

export const N = 10;
export const MIN = 60_000;
export const TILL = 10;
export const HARVESTS_PER_PARCEL = 10;
export const MARKET_BONUS = 1.5;

export type CropId = 'bugday' | 'havuc' | 'domates' | 'misir' | 'gul' | 'cilek' | 'aycicegi' | 'kabak';
export type AnimalId = 'tavuk' | 'koyun' | 'inek' | 'ari';
export type DecorId = 'cicek' | 'cit' | 'saman' | 'agac' | 'bank' | 'kuyu' | 'cesme';

export const CROPS: Record<CropId, { name: string; cost: number; mins: number; sell: number; xp: number; lvl: number; big?: true }> = {
  bugday: { name: 'Buğday', cost: 2, mins: 30, sell: 6, xp: 2, lvl: 1 },
  havuc: { name: 'Havuç', cost: 5, mins: 120, sell: 15, xp: 4, lvl: 1 },
  domates: { name: 'Domates', cost: 8, mins: 240, sell: 25, xp: 7, lvl: 2 },
  misir: { name: 'Mısır', cost: 12, mins: 480, sell: 40, xp: 10, lvl: 3 },
  gul: { name: 'Aşk gülü', cost: 30, mins: 1440, sell: 110, xp: 30, lvl: 3, big: true },
  cilek: { name: 'Çilek', cost: 20, mins: 720, sell: 65, xp: 14, lvl: 4 },
  aycicegi: { name: 'Ayçiçeği', cost: 25, mins: 1440, sell: 90, xp: 20, lvl: 5, big: true },
  kabak: { name: 'Bal kabağı', cost: 40, mins: 1440, sell: 140, xp: 26, lvl: 6, big: true },
};

export const ANIMALS: Record<
  AnimalId,
  { name: string; product: string; pname: string; cost: number; mins: number; sell: number; xp: number; lvl: number; w: number }
> = {
  tavuk: { name: 'Tavuk', product: 'egg', pname: 'yumurta', cost: 60, mins: 240, sell: 15, xp: 3, lvl: 2, w: 0.6 },
  koyun: { name: 'Koyun', product: 'wool', pname: 'yün', cost: 150, mins: 360, sell: 35, xp: 5, lvl: 3, w: 0.78 },
  inek: { name: 'İnek', product: 'milk', pname: 'süt', cost: 200, mins: 480, sell: 45, xp: 6, lvl: 4, w: 0.95 },
  ari: { name: 'Arı kovanı', product: 'honey', pname: 'bal', cost: 300, mins: 720, sell: 80, xp: 8, lvl: 5, w: 0.72 },
};

export const DECOR: Record<DecorId, { name: string; sp: string; cost: number; xp: number; lvl: number; w: number }> = {
  cicek: { name: 'Çiçeklik', sp: 'planter', cost: 15, xp: 1, lvl: 1, w: 0.92 },
  cit: { name: 'Çit', sp: 'fence', cost: 20, xp: 1, lvl: 1, w: 0.92 },
  saman: { name: 'Saman', sp: 'hay', cost: 30, xp: 1, lvl: 1, w: 0.85 },
  agac: { name: 'Ağaç', sp: 'tree', cost: 40, xp: 2, lvl: 1, w: 1.25 },
  bank: { name: 'Bank', sp: 'bench', cost: 60, xp: 3, lvl: 2, w: 0.85 },
  kuyu: { name: 'Kuyu', sp: 'well', cost: 120, xp: 5, lvl: 3, w: 0.78 },
  cesme: { name: 'Çeşme', sp: 'fountain', cost: 250, xp: 10, lvl: 5, w: 1.05 },
};

export type Tile =
  | { k: 'locked' }
  | { k: 'grass' }
  | { k: 'path' }
  | { k: 'soil' }
  | { k: 'fixed'; item: 'house' | 'barn' }
  | { k: 'crop'; crop: CropId; by: string; at: number; ready: number; watered?: string }
  | { k: 'animal'; item: AnimalId; last: number }
  | { k: 'decor'; item: DecorId };

export type FarmLog = { by: string; text: string; at: number };
// pos: herkesin en son çalıştığı kare; partnerin avatarı orada durur.
// stock: depo (ürün adı → adet); harvests: ortak hasat sayısı (arazi bununla açılır).
export type Farm = {
  v: 2;
  coins: number;
  xp: number;
  bought: number;
  tiles: Tile[];
  log: FarmLog[];
  pos: Record<string, number>;
  stock: Record<string, number>;
  harvests: number;
};

// H ev, B ahır (2x2), p yol, g çimen, s tarla, T ağaç, d çiçeklik, F çeşme, L satılık arazi
const MAP = [
  'HHgTBBgLLL',
  'HHgpBBgLLL',
  'ppppppgLLL',
  'sssPggdLLL',
  'sssPgggLLL',
  'sssPgFgLLL',
  'LLLpLLLLLL',
  'LLLpLLLLLL',
  'LLLpLLLLLL',
  'LLLpLLLLLL',
];
export const FIXED_ANCHOR = { house: [1, 1], barn: [1, 5] } as const;

export function newFarm(): Farm {
  const tiles: Tile[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const ch = MAP[r][c];
      let t: Tile = { k: 'grass' };
      if (ch === 'H') t = { k: 'fixed', item: 'house' };
      if (ch === 'B') t = { k: 'fixed', item: 'barn' };
      if (ch === 'p' || ch === 'P') t = { k: 'path' };
      if (ch === 's') t = { k: 'soil' };
      if (ch === 'L') t = { k: 'locked' };
      if (ch === 'T') t = { k: 'decor', item: 'agac' };
      if (ch === 'd') t = { k: 'decor', item: 'cicek' };
      if (ch === 'F') t = { k: 'decor', item: 'cesme' };
      tiles.push(t);
    }
  return { v: 2, coins: 100, xp: 0, bought: 0, tiles, log: [], pos: {}, stock: {}, harvests: 0 };
}

// Eski (5x5) bahçe kaydı varsa yeni çiftlikle başlanır.
export function farmOf(couple: Couple | null | undefined): Farm {
  const f = couple?.farm as Farm | undefined;
  return f && f.v === 2 ? { ...f, pos: f.pos ?? {}, stock: f.stock ?? {}, harvests: f.harvests ?? 0 } : newFarm();
}

export const levelStart = (l: number) => 15 * l * (l - 1);
export function levelOf(xp: number) {
  let l = 1;
  while (xp >= levelStart(l + 1)) l++;
  return { level: l, from: levelStart(l), to: levelStart(l + 1) };
}

export const rc = (i: number) => [Math.floor(i / N), i % N] as const;
export const parcelOf = (i: number) => `${Math.floor(Math.floor(i / N) / 2)}-${Math.floor((i % N) / 2)}`;
export const parcelTiles = (f: Farm, i: number) =>
  f.tiles.map((t, j) => (t.k === 'locked' && parcelOf(j) === parcelOf(i) ? j : -1)).filter((j) => j >= 0);
// Bir sonraki parsel için gereken ortak hasat sayısı.
export const parcelNeed = (f: Farm) => HARVESTS_PER_PARCEL * ((f.bought || 0) + 1);

// ---------- Mevsim ----------
export type Season = 'kis' | 'bahar' | 'yaz' | 'guz';
export function seasonOf(now = Date.now()): Season {
  const m = new Date(now).getMonth();
  return m === 11 || m < 2 ? 'kis' : m < 5 ? 'bahar' : m < 8 ? 'yaz' : 'guz';
}
export const SEASON_NAME: Record<Season, string> = { kis: 'Kış', bahar: 'Bahar', yaz: 'Yaz', guz: 'Güz' };
// Kışın ürün yavaş büyür, baharda biraz hızlı.
export const growFactor = (s: Season) => (s === 'kis' ? 1.5 : s === 'bahar' ? 0.85 : 1);
export const isWeekend = (now = Date.now()) => [0, 6].includes(new Date(now).getDay());

// ---------- Depo ----------
const PRICE: Record<string, number> = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, v]) => [k, v.sell])),
  ...Object.fromEntries(Object.values(ANIMALS).map((a) => [a.product, a.sell])),
};
export const PRODUCT_NAME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, v]) => [k, v.name])),
  ...Object.fromEntries(Object.values(ANIMALS).map((a) => [a.product, a.pname[0].toLocaleUpperCase('tr-TR') + a.pname.slice(1)])),
};
export const stockCount = (f: Farm) => Object.values(f.stock).reduce((a, b) => a + b, 0);
export const stockValue = (f: Farm, bonus = 1) =>
  Math.round(Object.entries(f.stock).reduce((a, [k, n]) => a + (PRICE[k] ?? 0) * n, 0) * bonus);
export const bigReady = (f: Farm, now: number) =>
  f.tiles.map((t, i) => (t.k === 'crop' && CROPS[t.crop].big && cropReady(t, now) ? i : -1)).filter((i) => i >= 0);

export const cropReady = (t: Extract<Tile, { k: 'crop' }>, now: number) => now >= t.ready;
export const animalReady = (t: Extract<Tile, { k: 'animal' }>, now: number) => now >= t.last + ANIMALS[t.item].mins * MIN;

export function timeLeft(ms: number) {
  const m = Math.max(0, Math.ceil(ms / MIN));
  if (m >= 60) return `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}`;
  return `${m} dk`;
}

export function readyTiles(f: Farm, now: number) {
  return f.tiles
    .map((t, i) => ((t.k === 'crop' && cropReady(t, now)) || (t.k === 'animal' && animalReady(t, now)) ? i : -1))
    .filter((i) => i >= 0);
}

export function farmSummary(f: Farm, uid: string, now = Date.now()) {
  let canWater = 0;
  for (const t of f.tiles) if (t.k === 'crop' && !cropReady(t, now) && t.by !== uid && !t.watered) canWater++;
  return {
    ready: readyTiles(f, now).length,
    canWater,
    fields: f.tiles.filter((t) => t.k === 'soil' || t.k === 'crop').length,
    big: bigReady(f, now).length,
    stock: stockCount(f),
  };
}

// ---------- Hamleler ----------

export type Action =
  | { a: 'plant'; i: number; crop: CropId }
  | { a: 'water'; i: number }
  | { a: 'harvest'; i: number }
  | { a: 'collect'; i: number }
  | { a: 'till'; i: number }
  | { a: 'animal'; i: number; item: AnimalId }
  | { a: 'decor'; i: number; item: DecorId }
  | { a: 'unlock'; i: number }
  | { a: 'remove'; i: number }
  // Hasat günü: iki kişilik sahne canlıyken bütün hazır büyük ürünler toplanır.
  | { a: 'harvestDay'; i: number; scene: string }
  // Depoyu sat; pazar sahnesi canlıysa (hafta sonu, ikiniz) bir buçuk kat.
  | { a: 'sell'; i: number; scene?: string };

export type Result = { farm: Farm; text: string; gained: number; ready?: number };

const emptyOk = (t: Tile) => t.k === 'grass' || t.k === 'soil';

// Saf kural fonksiyonu: hata mesajı ya da yeni çiftlik döner.
export function applyAction(
  f0: Farm,
  act: Action,
  uid: string,
  partnerName: (by: string) => string,
  name: string,
  now: number,
  live?: { kind: string } | null, // doğrulanmış canlı sahne (hasat günü / pazar)
): Result | string {
  const f: Farm = { ...f0, tiles: [...f0.tiles], log: [...f0.log], pos: { ...f0.pos }, stock: { ...f0.stock } };
  const put = (k: string, n = 1) => (f.stock[k] = (f.stock[k] ?? 0) + n);
  const t = f.tiles[act.i];
  if (!t) return 'Böyle bir yer yok.';
  const lv = levelOf(f.xp).level;
  let text = '';
  let gained = 0;
  let ready: number | undefined;

  switch (act.a) {
    case 'plant': {
      const c = CROPS[act.crop];
      if (t.k !== 'soil') return 'Burası ekime hazır değil.';
      if (lv < c.lvl) return `${c.name} ${c.lvl}. seviyede açılır.`;
      if (f.coins < c.cost) return 'Yeterli altının yok.';
      f.coins -= c.cost;
      const season = seasonOf(now);
      ready = now + Math.round(c.mins * MIN * growFactor(season));
      f.tiles[act.i] = { k: 'crop', crop: act.crop, by: uid, at: now, ready };
      text = `${name} ${c.name.toLowerCase()} ekti${season === 'kis' ? ' (kışın yavaş büyür)' : ''}`;
      break;
    }
    case 'water': {
      if (t.k !== 'crop') return 'Burada sulanacak bir şey yok.';
      if (t.by === uid) return 'Kendi ektiğini partnerin sular.';
      if (t.watered) return 'Zaten sulandı.';
      if (cropReady(t, now)) return 'Bu ürün hasada hazır.';
      ready = now + Math.round((t.ready - now) / 2);
      f.tiles[act.i] = { ...t, watered: uid, ready };
      text = `${name}, ${partnerName(t.by)} ${CROPS[t.crop].name.toLowerCase()} ürününü suladı 💧`;
      break;
    }
    case 'harvest': {
      if (t.k !== 'crop') return 'Hasat edilecek ürün yok.';
      if (!cropReady(t, now)) return 'Henüz olmadı.';
      const c = CROPS[t.crop];
      if (c.big) return `${c.name} hasat günüyle toplanır: partnerini çağır.`;
      f.xp += c.xp;
      put(t.crop);
      if (t.watered) f.harvests += 1; // biri ekti, diğeri suladı: ortak hasat
      f.tiles[act.i] = { k: 'soil' };
      text = `${name} ${c.name.toLowerCase()} topladı${t.watered ? ' · ortak hasat' : ''}`;
      break;
    }
    case 'collect': {
      if (t.k !== 'animal') return 'Burada hayvan yok.';
      if (!animalReady(t, now)) return 'Henüz hazır değil.';
      const an = ANIMALS[t.item];
      f.xp += an.xp;
      put(an.product);
      f.tiles[act.i] = { ...t, last: now };
      text = `${name} ${an.pname} topladı`;
      break;
    }
    case 'till': {
      if (t.k !== 'grass') return 'Burası çimen değil.';
      if (f.coins < TILL) return 'Yeterli altının yok.';
      f.coins -= TILL;
      f.xp += 1;
      f.tiles[act.i] = { k: 'soil' };
      text = `${name} yeni tarla sürdü`;
      break;
    }
    case 'animal': {
      const an = ANIMALS[act.item];
      if (!emptyOk(t)) return 'Önce boş bir yer seç.';
      if (lv < an.lvl) return `${an.name} ${an.lvl}. seviyede açılır.`;
      if (f.coins < an.cost) return 'Yeterli altının yok.';
      f.coins -= an.cost;
      f.tiles[act.i] = { k: 'animal', item: act.item, last: now };
      text = `${name} çiftliğe ${an.name.toLowerCase()} aldı`;
      break;
    }
    case 'decor': {
      const d = DECOR[act.item];
      if (!emptyOk(t)) return 'Önce boş bir yer seç.';
      if (lv < d.lvl) return `${d.name} ${d.lvl}. seviyede açılır.`;
      if (f.coins < d.cost) return 'Yeterli altının yok.';
      f.coins -= d.cost;
      f.xp += d.xp;
      f.tiles[act.i] = { k: 'decor', item: act.item };
      text = `${name} bahçeye ${d.name.toLowerCase()} koydu`;
      break;
    }
    case 'unlock': {
      if (t.k !== 'locked') return 'Bu arazi zaten açık.';
      const need = parcelNeed(f);
      if (f.harvests < need) return `Bu arazi ${need}. ortak hasatta açılır (${f.harvests}/${need}).`;
      f.bought = (f.bought || 0) + 1;
      const ids = parcelTiles(f0, act.i);
      ids.forEach((j) => (f.tiles[j] = { k: 'soil' }));
      f.xp += 5;
      text = `${name} yeni araziyi açtı: ${ids.length} tarla daha 🌱`;
      break;
    }
    case 'remove': {
      if (t.k !== 'animal' && t.k !== 'decor') return 'Kaldırılacak bir şey yok.';
      const cost = t.k === 'animal' ? ANIMALS[t.item].cost : DECOR[t.item].cost;
      gained = Math.floor(cost / 2);
      f.coins += gained;
      f.tiles[act.i] = { k: 'grass' };
      text = `${name} bir yeri boşalttı`;
      break;
    }
    case 'harvestDay': {
      if (live?.kind !== 'harvest') return 'Hasat günü için önce ikiniz tarlada olmalısınız.';
      const ids = bigReady(f0, now);
      if (!ids.length) return 'Toplanacak büyük ürün yok.';
      const names = new Set<string>();
      for (const j of ids) {
        const tj = f0.tiles[j];
        if (tj.k !== 'crop') continue;
        put(tj.crop);
        f.xp += CROPS[tj.crop].xp;
        names.add(CROPS[tj.crop].name.toLowerCase());
        f.tiles[j] = { k: 'soil' };
      }
      f.harvests += ids.length;
      gained = ids.length;
      text = `Hasat günü: ikiniz ${ids.length} ${[...names].join(', ')} topladınız 🌾`;
      break;
    }
    case 'sell': {
      const n = stockCount(f);
      if (!n) return 'Depo boş.';
      const market = live?.kind === 'market';
      gained = stockValue(f, market ? MARKET_BONUS : 1);
      f.coins += gained;
      f.stock = {};
      text = market ? `Pazar günü: ${n} ürün tezgâhta ${gained} altına gitti 🧺` : `${name} ${n} ürünü ${gained} altına sattı`;
      break;
    }
  }
  f.pos[uid] = act.i;
  f.log = [{ by: uid, text, at: now }, ...f.log].slice(0, 14);
  return { farm: f, text, gained, ready };
}

// Firestore tanımsız alan kabul etmez.
const clean = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export async function farmAction(coupleId: string, uid: string, name: string, partnerName: string, act: Action) {
  const ref = doc(db, 'couples', coupleId);
  const sceneId = act.a === 'harvestDay' || act.a === 'sell' ? act.scene : undefined;
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 'Çift bulunamadı.';
    // İki kişilik sahne gerçekten canlı mı? (hasat günü, pazar)
    let live: { kind: string } | null = null;
    if (sceneId) {
      const sc = await tx.get(doc(db, 'couples', coupleId, 'scenes', sceneId));
      const d = sc.data() as { kind?: string; status?: string } | undefined;
      if (sc.exists() && d?.status === 'live' && d.kind) live = { kind: d.kind };
    }
    const r = applyAction(
      farmOf(snap.data() as Couple),
      act,
      uid,
      (by) => (by === uid ? 'kendi' : `${partnerName}’in`),
      name,
      Date.now(),
      live,
    );
    if (typeof r !== 'string') tx.update(ref, { farm: clean(r.farm) });
    return r;
  });
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
    content: { title: `${CROPS[crop].name} hasada hazır`, body: 'Bizim Bahçe seni bekliyor.', data: { type: 'mood', url: '/garden' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
}

// Günlük görevden biriken altını çiftliğe aktarır.
export async function collectDreamBank(coupleId: string, uid: string, name: string) {
  const ref = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;
    const c = snap.data() as Couple;
    const bank = c.dreamBank ?? 0;
    if (bank <= 0) return 0;
    const f = farmOf(c);
    const farm: Farm = {
      ...f,
      coins: f.coins + bank,
      log: [{ by: uid, text: `${name} günlük görevden gelen ${bank} altını topladı`, at: Date.now() }, ...f.log].slice(0, 14),
    };
    tx.update(ref, { farm: clean(farm), dreamBank: 0 });
    return bank;
  });
}
