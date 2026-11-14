import * as Notifications from 'expo-notifications';
import { collection, doc, increment, onSnapshot, runTransaction } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';
import { dayKey } from './date';
import { BONUS_ITEMS, BONUS_MAX, bonusText, type FarmBonus } from './farmBonus';
import type { Couple } from './session';

// Bizim Çiftlik: çiftin ortak çiftliği (2.5D). Amaç: birlikte emek vermek ve emeğin meyvesini birlikte görmek.
// Tarla ekilir, ürün gerçek zamanla büyür; hasat depoya gider, depo satılınca altın olur.
// Ortaklık: birinin ektiğini diğeri sularsa kalan süre yarıya iner ve o hasat "ortak hasat" sayılır.
// Büyük ürünlerin (gül, ayçiçeği, bal kabağı) hasadı iki kişilik sahnedir: Hasat günü.
// Hafta sonu pazar: tezgâhı ikiniz kurarsanız depo bir buçuk katına gider.
// Mevsim gerçek takvimi izler: kışın ürün yavaş büyür.
// Arazi 10x10; kapalı parseller parayla değil ortak hasat sayısıyla açılır (her 10 ortak hasatta bir parsel).

export const N = 14; // arazi 14x14; ortadaki 10x10 başlangıç çiftliği, çevresindeki iki sıra parayla alınan arazi
export const INNER = 10;
export const OFF = (N - INNER) / 2;
export const MIN = 60_000;
export const TILL = 10;
export const HARVESTS_PER_PARCEL = 10;
export const MARKET_BONUS = 1.5;

export type CropId = 'bugday' | 'havuc' | 'domates' | 'misir' | 'gul' | 'cilek' | 'aycicegi' | 'kabak';
export type AnimalId = 'tavuk' | 'koyun' | 'inek' | 'ari';
export type TreeId = 'elma' | 'kiraz' | 'armut';
export type BuildingId = 'kumes' | 'agil' | 'kovan';
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

// Hayvanlar çayıra (çimene) konur, tarlaya değil. Her hayvan gerçekte verdiği ürünleri verir:
// koyun yün ve süt, inek süt, tavuk yumurta, arı bal. products[0] rozet ve ana üründür.
export const PRODUCTS: Record<string, { name: string; sell: number; art: string }> = {
  egg: { name: 'Yumurta', sell: 15, art: 'egg' },
  wool: { name: 'Yün', sell: 35, art: 'wool' },
  milk: { name: 'Süt', sell: 45, art: 'milk' },
  honey: { name: 'Bal', sell: 80, art: 'honey' },
};
export const ANIMALS: Record<
  AnimalId,
  { name: string; products: string[]; cost: number; mins: number; xp: number; lvl: number; w: number }
> = {
  tavuk: { name: 'Tavuk', products: ['egg'], cost: 60, mins: 240, xp: 3, lvl: 2, w: 0.6 },
  koyun: { name: 'Koyun', products: ['wool', 'milk'], cost: 150, mins: 360, xp: 5, lvl: 3, w: 0.78 },
  inek: { name: 'İnek', products: ['milk'], cost: 200, mins: 480, xp: 6, lvl: 4, w: 0.95 },
  ari: { name: 'Arı kovanı', products: ['honey'], cost: 300, mins: 720, xp: 8, lvl: 5, w: 0.72 },
};
export const productNames = (a: AnimalId) => ANIMALS[a].products.map((k) => PRODUCTS[k].name.toLocaleLowerCase('tr-TR')).join(' ve ');
export const productValue = (a: AnimalId) => ANIMALS[a].products.reduce((s, k) => s + PRODUCTS[k].sell, 0);

// ---------- Mutfak: tarifler ----------
// Depodaki ürünlerden yapılır, anında hazır olur. Ham hâlinden yaklaşık bir buçuk kat değerlidir;
// hediye sepetleri de bunlardan hazırlanır.
export type RecipeId = 'ekmek' | 'omlet' | 'peynir' | 'kek' | 'recel' | 'ballisut';
export const RECIPES: Record<
  RecipeId,
  { name: string; emoji: string; needs: Record<string, number>; sell: number; xp: number; lvl: number }
> = {
  ekmek: { name: 'Ekmek', emoji: '🍞', needs: { bugday: 3 }, sell: 30, xp: 4, lvl: 1 },
  omlet: { name: 'Omlet', emoji: '🍳', needs: { egg: 2, domates: 1 }, sell: 90, xp: 8, lvl: 2 },
  peynir: { name: 'Peynir', emoji: '🧀', needs: { milk: 2 }, sell: 135, xp: 10, lvl: 3 },
  kek: { name: 'Kek', emoji: '🍰', needs: { egg: 2, milk: 1, bugday: 2 }, sell: 140, xp: 14, lvl: 4 },
  recel: { name: 'Çilek reçeli', emoji: '🍓', needs: { cilek: 3 }, sell: 290, xp: 16, lvl: 4 },
  ballisut: { name: 'Ballı süt', emoji: '🥛', needs: { honey: 1, milk: 1 }, sell: 190, xp: 18, lvl: 5 },
};
export const STOCK_EMOJI: Record<string, string> = Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.emoji]));

// ---------- Hediye sepeti ----------
// Depodan hazırlanır, partnere gönderilir; partner açınca çiftlik altın ve tecrübe, çift puan kazanır, ortak hasat sayılır.
// Kişi başı günde bir sepet; partner açmadan yenisi gönderilmez.
export type BasketId = 'kahvalti' | 'piknik' | 'tatli';
export const BASKETS: Record<
  BasketId,
  { name: string; emoji: string; art: string; needs: Record<string, number>; coins: number; xp: number; points: number }
> = {
  kahvalti: {
    name: 'Kahvaltı sepeti',
    emoji: '🧺',
    art: 'sepet_dolu',
    needs: { ekmek: 1, egg: 2, domates: 1 },
    coins: 150,
    xp: 20,
    points: 10,
  },
  piknik: {
    name: 'Piknik sepeti',
    emoji: '🥪',
    art: 'sepet_dolu',
    needs: { ekmek: 1, peynir: 1, havuc: 2 },
    coins: 320,
    xp: 30,
    points: 15,
  },
  tatli: { name: 'Tatlı sepeti', emoji: '🎁', art: 'sepet_tatli', needs: { kek: 1, recel: 1 }, coins: 700, xp: 45, points: 25 },
};
export type Gift = { id: string; from: string; kind: BasketId; at: number };
export const hasAll = (f: Farm, needs: Record<string, number>) => Object.entries(needs).every(([k, n]) => (f.stock[k] ?? 0) >= n);
export const needsText = (needs: Record<string, number>) =>
  Object.entries(needs)
    .map(([k, n]) => `${n} ${(PRODUCT_NAME[k] ?? k).toLocaleLowerCase('tr-TR')}`)
    .join(', ');
const DAY = 24 * 60 * MIN;
export const giftWait = (f: Farm, uid: string, now: number) => {
  const pending = (f.gifts ?? []).some((g) => g.from === uid);
  const last = f.giftAt?.[uid] ?? 0;
  return pending ? 'pending' : now - last < DAY ? 'day' : null;
};

// Hayvan binaları: hayvanlar çimene bırakılmaz, binada yaşar. Her binaya 3 hayvan sığar.
// Tavuk/koyun/inek yemlenince üretime başlar (yem: depodan 1 buğday, yoksa 5 altın); arılar yemsiz kendi döngüsünde.
export const BUILDINGS: Record<BuildingId, { name: string; cost: number; lvl: number; w: number; animals: AnimalId[]; cap: number }> = {
  kumes: { name: 'Kümes', cost: 120, lvl: 2, w: 1.45, animals: ['tavuk'], cap: 3 },
  agil: { name: 'Ağıl', cost: 260, lvl: 3, w: 1.7, animals: ['koyun', 'inek'], cap: 3 },
  kovan: { name: 'Kovanlar', cost: 220, lvl: 5, w: 1.3, animals: ['ari'], cap: 3 },
};
export const FEED_COINS = 5;
export const FEED_CROP = 'bugday';
export const needsFeed = (a: AnimalId) => a !== 'ari';
export type Resident = { id: AnimalId; fed: number | null; last: number }; // fed: yemleme zamanı (üretim başlangıcı); null: aç
// Bir hayvanın ürünü hazır mı? Arı: son toplamadan beri süre doldu. Diğerleri: yemlendi ve süre doldu.
export const residentReady = (r: Resident, now: number) =>
  needsFeed(r.id) ? r.fed !== null && now >= r.fed + ANIMALS[r.id].mins * MIN : now >= r.last + ANIMALS[r.id].mins * MIN;
export const residentReadyAt = (r: Resident) => (needsFeed(r.id) ? (r.fed ?? 0) : r.last) + ANIMALS[r.id].mins * MIN;
export const buildingFor = (a: AnimalId) => (Object.keys(BUILDINGS) as BuildingId[]).find((b) => BUILDINGS[b].animals.includes(a))!;

// Meyve ağaçları: bir kez dikilir, ilk hasattan sonra sürekli meyve verir. Çayıra dikilir.
export const TREES: Record<
  TreeId,
  {
    name: string;
    fruit: string;
    cost: number;
    first: number;
    mins: number;
    yieldN: number;
    sell: number;
    xp: number;
    lvl: number;
    w: number;
  }
> = {
  elma: { name: 'Elma ağacı', fruit: 'Elma', cost: 200, first: 240, mins: 120, yieldN: 3, sell: 30, xp: 6, lvl: 3, w: 1.15 },
  kiraz: { name: 'Kiraz ağacı', fruit: 'Kiraz', cost: 320, first: 300, mins: 180, yieldN: 3, sell: 45, xp: 9, lvl: 4, w: 1.15 },
  armut: { name: 'Armut ağacı', fruit: 'Armut', cost: 450, first: 360, mins: 240, yieldN: 3, sell: 60, xp: 12, lvl: 5, w: 1.15 },
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
  | { k: 'tree'; item: TreeId; at: number; last: number } // at: dikim; last: son hasat (ilk hasat at + first)
  | { k: 'building'; item: BuildingId; res: Resident[] }
  | { k: 'decor'; item: DecorId };

export type FarmLog = { by: string; text: string; at: number };
// Kasaba siparişi: 1–3 ürün; depodan teslim edilir, ikisi de katkı yaparsa ortak hasat sayılır.
export type Order = {
  id: string;
  items: Record<string, number>; // ürün → istenen
  given: Record<string, number>; // ürün → teslim edilen
  by: string[]; // katkı yapanlar
  coins: number;
  xp: number;
  openAt: number; // bu zamandan önce görünmez (tamamlanan siparişin yerine 20 dk sonra yenisi)
};
// Not Ağacı: evin yanındaki ağaç; ikiniz kısa notlar bırakırsınız.
export type FarmNote = { by: string; text: string; at: number };
export const NOTE_TREE = OFF * N + 3 + OFF; // (0,3) karesi (iç çiftlik)
export const NOTE_MAX = 300;
export const NOTES_PER_DAY = 10;
export const ORDER_SLOTS = 3;
export const ORDER_REFILL = 20 * MIN;
// pos: herkesin en son çalıştığı kare; partnerin avatarı orada durur.
// stock: depo (ürün adı → adet); harvests: ortak hasat sayısı (arazi bununla açılır).
export type Farm = {
  v: 2 | 3;
  coins: number;
  xp: number;
  bought: number; // ortak hasatla açılan iç parseller
  outer?: number; // parayla alınan dış parseller
  tiles: Tile[];
  log: FarmLog[];
  pos: Record<string, number>;
  stock: Record<string, number>;
  harvests: number;
  orders: Order[];
  notes: FarmNote[];
  gifts?: Gift[]; // açılmayı bekleyen hediye sepetleri
  giftAt?: Record<string, number>; // kişi başı son sepet gönderme zamanı
  kiss?: { by: string; at: number }; // son öpücük (iki ekranda kalp efekti için)
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
export const FIXED_ANCHOR = { house: [1 + OFF, 1 + OFF], barn: [1 + OFF, 5 + OFF] } as const;

export function newFarm(): Farm {
  const tiles: Tile[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const ch = MAP[r - OFF]?.[c - OFF] ?? 'L'; // dış halka: satılık arazi
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
  return { v: 3, coins: 100, xp: 0, bought: 0, outer: 0, tiles, log: [], pos: {}, stock: {}, harvests: 0, orders: [], notes: [] };
}

// Eski (5x5) bahçe kaydı varsa yeni çiftlikle başlanır.
export function farmOf(couple: Couple | null | undefined): Farm {
  let f = couple?.farm as Farm | undefined;
  // Güvenlik ağı: eski sürümdeki bir telefon v3 çiftliği tanımayıp üstüne boş v2 çiftlik yazarsa, yeni kodun her
  // kayıtta tuttuğu v3 yedeği (farmKeep) geçerli sayılır. Eski sürümün o aradaki birkaç işlemi kaybolur, çiftlik kalır.
  const keep = couple?.farmKeep as Farm | undefined;
  if (keep?.v === 3 && (!f || f.v !== 3)) f = keep;
  if (!f || (f.v !== 2 && f.v !== 3)) return newFarm();
  const g: Farm = { ...f, pos: f.pos ?? {}, stock: f.stock ?? {}, harvests: f.harvests ?? 0, orders: f.orders ?? [], notes: f.notes ?? [] };
  return g.v === 3 ? g : migrate10to14(g);
}

// Çiftlik yazarken yedeğiyle birlikte yazılır (bkz. farmOf).
export const farmWrite = (farm: Farm) => {
  const c = clean(farm);
  return { farm: c, farmKeep: c };
};

// v2 (10x10) kayıt → v3 (14x14): eski kareler ortaya taşınır, dış halka satılık olur. İlk işlemde kaydedilir.
function migrate10to14(f: Farm): Farm {
  const old = INNER;
  const tiles: Tile[] = Array.from({ length: N * N }, () => ({ k: 'locked' }) as Tile);
  const map = (i: number) => (Math.floor(i / old) + OFF) * N + (i % old) + OFF;
  f.tiles.forEach((t, i) => {
    if (i < old * old) tiles[map(i)] = t;
  });
  const pos: Record<string, number> = {};
  for (const [k, v] of Object.entries(f.pos)) pos[k] = v < old * old ? map(v) : v;
  return { ...f, v: 3, outer: f.outer ?? 0, tiles, pos };
}

export const isOuter = (i: number) => {
  const [r, c] = rc(i);
  return r < OFF || c < OFF || r >= OFF + INNER || c >= OFF + INNER;
};
// Dış arazi fiyatı: her parselde artar.
export const outerPrice = (f: Farm) => 250 + 150 * (f.outer ?? 0);

export const levelStart = (l: number) => 15 * l * (l - 1);
export function levelOf(xp: number) {
  let l = 1;
  while (xp >= levelStart(l + 1)) l++;
  return { level: l, from: levelStart(l), to: levelStart(l + 1) };
}

export const rc = (i: number) => [Math.floor(i / N), i % N] as const;
// İş bitince karakter tarlanın içinde kalmaz: en yakın yol (yoksa çim) karesine çekilir.
export function restNear(f: Farm, i: number): number {
  const ok = (j: number) => f.tiles[j]?.k === 'path' || f.tiles[j]?.k === 'grass';
  if (ok(i)) return i;
  const [r0, c0] = rc(i);
  let best = i;
  let bestD = Infinity;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const j = r * N + c;
      if (!ok(j)) continue;
      const d = Math.abs(r - r0) + Math.abs(c - c0) + (f.tiles[j].k === 'path' ? 0 : 0.5);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
  return best;
}
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
  ...Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, v.sell])),
  ...Object.fromEntries(Object.entries(TREES).map(([k, v]) => [k, v.sell])),
  ...Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.sell])),
};
export const PRODUCT_NAME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CROPS).map(([k, v]) => [k, v.name])),
  ...Object.fromEntries(Object.entries(PRODUCTS).map(([k, v]) => [k, v.name])),
  ...Object.fromEntries(Object.entries(TREES).map(([k, v]) => [k, v.fruit])),
  ...Object.fromEntries(Object.entries(RECIPES).map(([k, v]) => [k, v.name])),
};
export const stockCount = (f: Farm) => Object.values(f.stock).reduce((a, b) => a + b, 0);
export const stockValue = (f: Farm, bonus = 1) =>
  Math.round(Object.entries(f.stock).reduce((a, [k, n]) => a + (PRICE[k] ?? 0) * n, 0) * bonus);
export const bigReady = (f: Farm, now: number) =>
  f.tiles.map((t, i) => (t.k === 'crop' && CROPS[t.crop].big && cropReady(t, now) ? i : -1)).filter((i) => i >= 0);

// ---------- Siparişler ----------
// Çiftin şu an üretebildiği ürünlerden rastgele bir sipariş. Ödül: ham değerin 1,4 katı altın; her kalem 5 + her adet 3 tecrübe.
export function makeOrder(f: Farm, now: number, openAt = now): Order {
  const lv = levelOf(f.xp).level;
  const pool: string[] = (Object.keys(CROPS) as CropId[]).filter((c) => CROPS[c].lvl <= lv && !CROPS[c].big);
  for (const t of f.tiles) {
    if (t.k === 'animal') for (const k of ANIMALS[t.item].products) if (!pool.includes(k)) pool.push(k);
    if (t.k === 'building') for (const r of t.res) for (const k of ANIMALS[r.id].products) if (!pool.includes(k)) pool.push(k);
    if (t.k === 'tree' && !pool.includes(t.item)) pool.push(t.item);
  }
  // Malzemesinin hepsi üretilebilen tarifler de sipariş edilebilir (mutfağa iş çıkar).
  const raw = [...pool];
  for (const [k, r] of Object.entries(RECIPES)) if (r.lvl <= lv && Object.keys(r.needs).every((x) => raw.includes(x))) pool.push(k);
  const n = Math.min(pool.length, 1 + Math.floor(Math.random() * 3));
  const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  const items: Record<string, number> = {};
  let value = 0;
  let qty = 0;
  for (const k of picks) {
    const q = 1 + Math.floor(Math.random() * (PRICE[k] >= 40 ? 2 : 5));
    items[k] = q;
    value += PRICE[k] * q;
    qty += q;
  }
  return {
    id: `${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    items,
    given: {},
    by: [],
    coins: Math.round(value * 1.4),
    xp: 5 * picks.length + 3 * qty,
    openAt,
  };
}
export const orderDone = (o: Order) => Object.entries(o.items).every(([k, q]) => (o.given[k] ?? 0) >= q);
export const orderLeft = (o: Order) => Object.fromEntries(Object.entries(o.items).map(([k, q]) => [k, Math.max(0, q - (o.given[k] ?? 0))]));
// Depodan bu siparişe verilebilecek adet (kısmi teslim olur).
export const canGive = (f: Farm, o: Order) => Object.entries(orderLeft(o)).reduce((a, [k, q]) => a + Math.min(q, f.stock[k] ?? 0), 0);
// Pano hep ORDER_SLOTS sipariş tutar; eksikse üretilir.
export function fillOrders(f: Farm, now: number) {
  while (f.orders.length < ORDER_SLOTS) f.orders.push(makeOrder(f, now));
}
export const notesToday = (f: Farm, uid: string, now = Date.now()) =>
  f.notes.filter((n) => n.by === uid && dayKey(new Date(n.at)) === dayKey(new Date(now))).length;

export const cropReady = (t: Extract<Tile, { k: 'crop' }>, now: number) => now >= t.ready;
export const animalReady = (t: Extract<Tile, { k: 'animal' }>, now: number) => now >= t.last + ANIMALS[t.item].mins * MIN;
export const treeReadyAt = (t: Extract<Tile, { k: 'tree' }>) =>
  t.last === t.at ? t.at + TREES[t.item].first * MIN : t.last + TREES[t.item].mins * MIN;
export const treeReady = (t: Extract<Tile, { k: 'tree' }>, now: number) => now >= treeReadyAt(t);

export function timeLeft(ms: number) {
  const m = Math.max(0, Math.ceil(ms / MIN));
  if (m >= 60) return `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}`;
  return `${m} dk`;
}

export function readyTiles(f: Farm, now: number) {
  return f.tiles
    .map((t, i) =>
      (t.k === 'crop' && cropReady(t, now)) ||
      (t.k === 'animal' && animalReady(t, now)) ||
      (t.k === 'tree' && treeReady(t, now)) ||
      (t.k === 'building' && t.res.some((r) => residentReady(r, now)))
        ? i
        : -1,
    )
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
    hungry: f.tiles.reduce((n, t) => n + (t.k === 'building' ? t.res.filter((r) => needsFeed(r.id) && r.fed === null).length : 0), 0),
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
  | { a: 'tree'; i: number; item: TreeId }
  | { a: 'pick'; i: number } // meyve topla
  | { a: 'build'; i: number; item: BuildingId } // çimene bina kur
  | { a: 'adopt'; i: number; item: AnimalId } // binaya hayvan al (i: bina karesi)
  | { a: 'feed'; i: number } // binadaki aç hayvanları yemle
  | { a: 'gather'; i: number } // binadaki hazır ürünleri topla
  | { a: 'decor'; i: number; item: DecorId }
  | { a: 'unlock'; i: number }
  | { a: 'remove'; i: number }
  // Yerini değiştir: from karesindeki ağaç/bina/süs/hayvan/tarla i karesine (boş çimen) taşınır; süreler korunur.
  | { a: 'move'; i: number; from: number }
  // Hasat günü: iki kişilik sahne canlıyken bütün hazır büyük ürünler toplanır.
  | { a: 'harvestDay'; i: number; scene: string }
  // Depoyu sat; pazar sahnesi canlıysa (hafta sonu, ikiniz) bir buçuk kat.
  | { a: 'sell'; i: number; scene?: string }
  // Siparişe depodan teslim (kısmi olabilir); tamamlanınca ödül, ikisi de katkı yaptıysa ortak hasat.
  | { a: 'deliver'; i: number; order: string }
  // Mutfak: depodaki ürünlerden tarif yap.
  | { a: 'cook'; i: number; recipe: RecipeId }
  // Hediye sepeti hazırla ve partnere gönder / gelen sepeti aç.
  | { a: 'gift'; i: number; basket: BasketId }
  | { a: 'openGift'; i: number; gift: string }
  // Not Ağacı'na not.
  | { a: 'note'; i: number; text: string }
  // Öpücük: i, partnerin yanındaki kare; avatar oraya yürür ve iki ekranda da kalpler uçar.
  | { a: 'kiss'; i: number };

export type Result = { farm: Farm; text: string; gained: number; ready?: number; points?: number };

// Hayvan, ağaç ve süs yalnız çayıra (çimene) konur; tarla ekin içindir.
const emptyOk = (t: Tile) => t.k === 'grass';

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
  const f: Farm = {
    ...f0,
    tiles: [...f0.tiles],
    log: [...f0.log],
    pos: { ...f0.pos },
    stock: { ...f0.stock },
    orders: f0.orders.map((o) => ({ ...o, given: { ...o.given }, by: [...o.by] })),
    notes: [...f0.notes],
    gifts: [...(f0.gifts ?? [])],
    giftAt: { ...(f0.giftAt ?? {}) },
  };
  const take = (needs: Record<string, number>) => {
    for (const [k, n] of Object.entries(needs)) {
      f.stock[k] = (f.stock[k] ?? 0) - n;
      if (f.stock[k] <= 0) delete f.stock[k];
    }
  };
  let points: number | undefined;
  const put = (k: string, n = 1) => (f.stock[k] = (f.stock[k] ?? 0) + n);
  fillOrders(f, now);
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
      for (const k of an.products) put(k);
      f.tiles[act.i] = { ...t, last: now };
      text = `${name} ${productNames(t.item)} topladı`;
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
      // Eski yol: hayvan artık çimene değil binaya alınır.
      const an = ANIMALS[act.item];
      return `${an.name} ${BUILDINGS[buildingFor(act.item)].name.toLowerCase()}te yaşar; dükkândan önce bina kur.`;
    }
    case 'decor': {
      const d = DECOR[act.item];
      if (!emptyOk(t)) return 'Süsler çimene konur; boş bir çimen seç.';
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
      if (isOuter(act.i)) {
        // dış arazi: altınla satın alınır
        const price = outerPrice(f);
        if (f.coins < price) return `Bu arazi ${price} altın; ${price - f.coins} altın eksik.`;
        f.coins -= price;
        f.outer = (f.outer ?? 0) + 1;
        const ids = parcelTiles(f0, act.i);
        ids.forEach((j) => (f.tiles[j] = { k: 'grass' }));
        f.xp += 8;
        text = `${name} yeni arazi satın aldı: ${ids.length} kare 🌿`;
        break;
      }
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
      if (t.k !== 'animal' && t.k !== 'decor' && t.k !== 'tree' && t.k !== 'building') return 'Kaldırılacak bir şey yok.';
      if (act.i === NOTE_TREE) return 'Not Ağacı kalkmaz; notlarınız orada.';
      if (t.k === 'building' && t.res.length) return 'İçinde hayvan varken bina kaldırılmaz.';
      const cost =
        t.k === 'animal'
          ? ANIMALS[t.item].cost
          : t.k === 'tree'
            ? TREES[t.item].cost
            : t.k === 'building'
              ? BUILDINGS[t.item].cost
              : DECOR[t.item].cost;
      gained = Math.floor(cost / 2);
      f.coins += gained;
      f.tiles[act.i] = { k: 'grass' };
      text = `${name} bir yeri boşalttı`;
      break;
    }
    case 'move': {
      const src = f.tiles[act.from];
      const field = !!src && (src.k === 'soil' || src.k === 'crop'); // tarla (boş ya da ekili) da taşınır; ekinin süresi korunur
      if (!src || (!field && src.k !== 'animal' && src.k !== 'decor' && src.k !== 'tree' && src.k !== 'building'))
        return 'Taşınacak bir şey yok.';
      if (act.from === NOTE_TREE) return 'Not Ağacı yerinden oynamaz.';
      if (act.i === act.from) return 'Zaten orada.';
      if (!emptyOk(t)) return 'Boş bir çimene taşıyabilirsin.';
      f.tiles[act.i] = src;
      f.tiles[act.from] = { k: 'grass' };
      const what =
        src.k === 'soil' || src.k === 'crop'
          ? 'Tarlayı'
          : src.k === 'animal'
            ? ANIMALS[src.item].name
            : src.k === 'tree'
              ? TREES[src.item].name
              : src.k === 'building'
                ? BUILDINGS[src.item].name
                : DECOR[src.item].name;
      text = `${name} ${what.toLocaleLowerCase('tr-TR')} taşıdı`;
      break;
    }
    case 'tree': {
      const tr = TREES[act.item];
      if (!emptyOk(t)) return 'Ağaç çayıra dikilir; boş bir çimen seç.';
      if (lv < tr.lvl) return `${tr.name} ${tr.lvl}. seviyede açılır.`;
      if (f.coins < tr.cost) return 'Yeterli altının yok.';
      f.coins -= tr.cost;
      f.xp += 2;
      f.tiles[act.i] = { k: 'tree', item: act.item, at: now, last: now };
      ready = now + tr.first * MIN;
      text = `${name} ${tr.name.toLowerCase()} dikti 🌳`;
      break;
    }
    case 'pick': {
      if (t.k !== 'tree') return 'Burada ağaç yok.';
      if (!treeReady(t, now)) return 'Meyveler henüz olmadı.';
      const tr = TREES[t.item];
      put(t.item, tr.yieldN);
      f.xp += tr.xp;
      f.tiles[act.i] = { ...t, last: now };
      text = `${name} ${tr.yieldN} ${tr.fruit.toLowerCase()} topladı`;
      break;
    }
    case 'build': {
      const b = BUILDINGS[act.item];
      if (!emptyOk(t)) return `${b.name} çimene kurulur; boş bir çimen seç.`;
      if (lv < b.lvl) return `${b.name} ${b.lvl}. seviyede açılır.`;
      if (f.coins < b.cost) return 'Yeterli altının yok.';
      f.coins -= b.cost;
      f.xp += 5;
      // Çimende başıboş duran uygun hayvanlar binaya taşınır.
      const res: Resident[] = [];
      f.tiles.forEach((x, j) => {
        if (x.k === 'animal' && b.animals.includes(x.item) && res.length < b.cap) {
          res.push({ id: x.item, fed: null, last: x.last });
          f.tiles[j] = { k: 'grass' };
        }
      });
      f.tiles[act.i] = { k: 'building', item: act.item, res };
      text = `${name} ${b.name.toLowerCase()} kurdu${res.length ? `; ${res.length} hayvan içeri taşındı` : ''} 🏡`;
      break;
    }
    case 'adopt': {
      if (t.k !== 'building') return 'Önce bina kur.';
      const b = BUILDINGS[t.item];
      const an = ANIMALS[act.item];
      if (!b.animals.includes(act.item)) return `${an.name} burada yaşamaz.`;
      if (t.res.length >= b.cap) return `${b.name} dolu (${b.cap}).`;
      if (lv < an.lvl) return `${an.name} ${an.lvl}. seviyede açılır.`;
      if (f.coins < an.cost) return 'Yeterli altının yok.';
      f.coins -= an.cost;
      f.xp += 2;
      f.tiles[act.i] = { ...t, res: [...t.res, { id: act.item, fed: null, last: now }] };
      text = `${name} ${b.name.toLowerCase()}e ${an.name.toLowerCase()} aldı`;
      break;
    }
    case 'feed': {
      if (t.k !== 'building') return 'Burada hayvan yok.';
      const hungry = t.res.filter((r) => needsFeed(r.id) && r.fed === null);
      if (!hungry.length) return 'Hepsi tok.';
      let wheat = f.stock[FEED_CROP] ?? 0;
      let coins = 0;
      for (const r of hungry) {
        if (wheat > 0) wheat--;
        else if (f.coins - coins >= FEED_COINS) coins += FEED_COINS;
        else return `Yem için depoda buğday ya da ${FEED_COINS} altın gerek.`;
      }
      const used = (f.stock[FEED_CROP] ?? 0) - wheat;
      if (used > 0) f.stock[FEED_CROP] = wheat;
      if (f.stock[FEED_CROP] === 0) delete f.stock[FEED_CROP];
      f.coins -= coins;
      f.tiles[act.i] = { ...t, res: t.res.map((r) => (needsFeed(r.id) && r.fed === null ? { ...r, fed: now } : r)) };
      text = `${name} ${hungry.length} hayvanı yemledi${used ? ` (${used} buğday)` : ''}${coins ? ` (${coins} altın)` : ''}`;
      break;
    }
    case 'gather': {
      if (t.k !== 'building') return 'Burada hayvan yok.';
      const ready = t.res.filter((r) => residentReady(r, now));
      if (!ready.length) return 'Henüz hazır ürün yok.';
      const names = new Set<string>();
      for (const r of ready) {
        for (const k of ANIMALS[r.id].products) put(k);
        f.xp += ANIMALS[r.id].xp;
        names.add(productNames(r.id));
      }
      f.tiles[act.i] = { ...t, res: t.res.map((r) => (residentReady(r, now) ? { ...r, fed: null, last: now } : r)) };
      text = `${name} ${[...names].join(', ')} topladı`;
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
    case 'deliver': {
      const k = f.orders.findIndex((o) => o.id === act.order);
      if (k < 0) return 'Bu sipariş artık yok.';
      const o = f.orders[k];
      if (o.openAt > now) return 'Bu sipariş henüz açılmadı.';
      let moved = 0;
      for (const [key, left] of Object.entries(orderLeft(o))) {
        const n = Math.min(left, f.stock[key] ?? 0);
        if (n <= 0) continue;
        f.stock[key] = (f.stock[key] ?? 0) - n;
        if (f.stock[key] <= 0) delete f.stock[key];
        o.given[key] = (o.given[key] ?? 0) + n;
        moved += n;
      }
      if (!moved) return 'Depoda bu siparişe uygun ürün yok.';
      if (!o.by.includes(uid)) o.by.push(uid);
      if (orderDone(o)) {
        f.coins += o.coins;
        f.xp += o.xp;
        gained = o.coins;
        const both = o.by.length >= 2;
        if (both) f.harvests += 1;
        f.orders[k] = makeOrder(f, now, now + ORDER_REFILL);
        text = `${name} siparişi tamamladı: +${o.coins} altın${both ? ' · ikiniz katkı verdiniz, ortak hasat sayıldı 💛' : ''}`;
      } else {
        const left = Object.values(orderLeft(o)).reduce((a, b) => a + b, 0);
        text = `${name} siparişe ${moved} ürün verdi; ${left} ürün kaldı`;
      }
      break;
    }
    case 'cook': {
      const r = RECIPES[act.recipe];
      if (!r) return 'Böyle bir tarif yok.';
      if (lv < r.lvl) return `${r.name} ${r.lvl}. seviyede açılır.`;
      if (!hasAll(f, r.needs)) return `${r.name} için depoda ${needsText(r.needs)} gerek.`;
      take(r.needs);
      put(act.recipe);
      f.xp += r.xp;
      text = `${name} ${r.name.toLocaleLowerCase('tr-TR')} yaptı ${r.emoji}`;
      break;
    }
    case 'gift': {
      const b = BASKETS[act.basket];
      if (!b) return 'Böyle bir sepet yok.';
      const wait = giftWait(f, uid, now);
      if (wait === 'pending') return 'Gönderdiğin sepet henüz açılmadı.';
      if (wait === 'day') return 'Günde bir sepet gönderebilirsin.';
      if (!hasAll(f, b.needs)) return `${b.name} için depoda ${needsText(b.needs)} gerek.`;
      take(b.needs);
      f.gifts = [...(f.gifts ?? []), { id: `${now}-${uid.slice(0, 4)}`, from: uid, kind: act.basket, at: now }];
      f.giftAt = { ...(f.giftAt ?? {}), [uid]: now };
      text = `${name} ${b.name.toLocaleLowerCase('tr-TR')} hazırlayıp gönderdi ${b.emoji}`;
      break;
    }
    case 'openGift': {
      const g = (f.gifts ?? []).find((x) => x.id === act.gift);
      if (!g) return 'Bu sepet artık yok.';
      if (g.from === uid) return 'Kendi gönderdiğin sepeti partnerin açar.';
      const b = BASKETS[g.kind];
      f.gifts = (f.gifts ?? []).filter((x) => x.id !== g.id);
      f.coins += b.coins;
      f.xp += b.xp;
      f.harvests += 1;
      gained = b.coins;
      points = b.points;
      text = `${name} ${b.name.toLocaleLowerCase('tr-TR')}ni açtı: +${b.coins} altın, +${b.points} puan · ortak hasat 💛`;
      break;
    }
    case 'kiss': {
      f.kiss = { by: uid, at: now };
      text = `${name} bir öpücük kondurdu 💋`;
      break;
    }
    case 'note': {
      if (act.i !== NOTE_TREE) return 'Notlar yalnız Not Ağacı’na asılır.';
      const txt = act.text.trim().slice(0, NOTE_MAX);
      if (!txt) return 'Boş not olmaz.';
      if (notesToday(f0, uid, now) >= NOTES_PER_DAY) return 'Bugünlük notlar doldu.';
      f.notes = [{ by: uid, text: txt, at: now }, ...f.notes].slice(0, 40);
      text = `${name} Not Ağacı’na bir not astı 🍃`;
      break;
    }
  }
  f.pos[uid] = restNear(f, act.i);
  f.log = [{ by: uid, text, at: now }, ...f.log].slice(0, 14);
  return { farm: f, text, gained, ready, points };
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
    if (typeof r !== 'string') tx.update(ref, { ...farmWrite(r.farm), ...(r.points ? { points: increment(r.points) } : {}) });
    return r;
  });
  return res;
}

// Hasat hatırlatması yok (istenmedi). Eski sürümlerin telefonda kurduğu bekleyen hatırlatmalar da iptal edilir.
export async function clearFarmReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith('farm-'))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
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
    tx.update(ref, { ...farmWrite(farm), dreamBank: 0 });
    return bank;
  });
}

// ---------- Yönetimden gelen çiftlik bonusu ----------
// Açılmamış paketler (en eskisi önce).
export function useFarmBonuses(coupleId: string | undefined): FarmBonus[] {
  const [list, setList] = useState<FarmBonus[]>([]);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      collection(db, 'couples', coupleId, 'bonuses'),
      (snap) =>
        setList(
          snap.docs
            .map((d) => ({ ...(d.data() as Omit<FarmBonus, 'id'>), id: d.id }))
            .filter((b) => !b.opened)
            .sort((a, b) => a.atMs - b.atMs),
        ),
      () => setList([]),
    );
  }, [coupleId]);
  return list;
}

// Paketi açar: içindekiler çiftliğe eklenir ve paket "açıldı" işaretlenir. İki telefondan aynı anda basılsa da bir kez işler.
export async function openFarmBonus(coupleId: string, uid: string, bonusId: string): Promise<string | null> {
  const coupleRef = doc(db, 'couples', coupleId);
  const bonusRef = doc(db, 'couples', coupleId, 'bonuses', bonusId);
  return runTransaction(db, async (tx) => {
    const b = await tx.get(bonusRef);
    const c = await tx.get(coupleRef);
    if (!b.exists() || !c.exists()) return null;
    const bonus = b.data() as Omit<FarmBonus, 'id'>;
    if (bonus.opened) return null;
    const farm = farmOf(c.data() as Couple);
    const clamp = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));
    const coins = clamp(bonus.coins, BONUS_MAX.coins);
    const xp = clamp(bonus.xp, BONUS_MAX.xp);
    const stock = { ...farm.stock };
    const given: Record<string, number> = {};
    for (const [k, n] of Object.entries(bonus.stock ?? {})) {
      const add = BONUS_ITEMS[k] ? clamp(n, BONUS_MAX.item) : 0;
      if (!add) continue;
      stock[k] = (stock[k] ?? 0) + add;
      given[k] = add;
    }
    const text = bonusText({ coins, xp, stock: given });
    const next: Farm = {
      ...farm,
      coins: farm.coins + coins,
      xp: farm.xp + xp,
      stock,
      log: [{ by: uid, text: `2miz’den hediye: ${text}`, at: Date.now() }, ...farm.log].slice(0, 14),
    };
    tx.update(coupleRef, farmWrite(next));
    tx.update(bonusRef, { opened: { by: uid, atMs: Date.now() } });
    return text;
  });
}
