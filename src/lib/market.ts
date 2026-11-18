import { collection, doc, getDocs, limit, orderBy, query, runTransaction, where } from 'firebase/firestore';
import { db } from './firebase';
import { applyAction, farmOf, farmWrite, levelOf, PRICE, unlockLvl, type Action, type Farm } from './farm';
import { srvNow } from './serverClock';
import type { Couple } from './session';

// Çiftçi pazarı: çiftler depolarındaki ürünü ilana koyar, başka çiftler oyun altınıyla satın alır.
// - İlan açılınca ürün satıcının deposundan çıkar (emanet). Satılınca alıcı altını öder ve ürünü alır; ilan "sold" olur.
// - Satıcı çiftliğini açınca satılan ilanların bedeli altınına eklenir ve ilan silinir; süresi dolan ilan depoya döner.
// - İlanda çiftin gerçek adı yoktur, yalnızca çiftlik adı ve seviyesi görünür. Çiftler arası mesajlaşma yoktur.
// - Gerçek para yok; yalnızca oyun altını.
export type Listing = {
  id: string;
  seller: string; // çift kimliği
  farm: string; // çiftlik adı
  lvl: number;
  key: string; // ürün
  n: number;
  price: number; // toplam bedel
  status: 'open' | 'sold';
  buyer?: string;
  createdAtMs: number;
  expMs: number;
  soldAtMs?: number;
};

export const MARKET_MAX = 6; // çift başına açık ilan
export const MARKET_HOURS = 48;
export const MARKET_MAX_QTY = 50;
// Fiyat sınırı: sistem fiyatının yarısı ile iki katı arası (ekonomi bozulmasın, altın aktarma aracı olmasın).
export const unitRange = (key: string): [number, number] => [Math.max(1, Math.ceil((PRICE[key] ?? 1) / 2)), (PRICE[key] ?? 1) * 2];

const col = () => collection(db, 'market');
const apply = (f: Farm, act: Action, uid: string, name: string, partnerName: string) =>
  applyAction(f, act, uid, (by) => (by === uid ? 'kendi' : `${partnerName}’in`), name, srvNow(), null);

// Başka çiftliklerin açık ilanları. Canlı dinleme yok; pazar açılınca tek okuma (en çok 60 belge).
export async function loadMarket(coupleId: string): Promise<Listing[]> {
  const s = await getDocs(query(col(), orderBy('createdAtMs', 'desc'), limit(60)));
  const now = Date.now();
  return s.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) }))
    .filter((l) => l.status === 'open' && l.expMs > now && l.seller !== coupleId)
    .slice(0, 30);
}

export async function loadMine(coupleId: string): Promise<Listing[]> {
  const s = await getDocs(query(col(), where('seller', '==', coupleId)));
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Listing, 'id'>) })).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

type Who = { coupleId: string; uid: string; name: string; partnerName: string };

export async function createListing(w: Who, key: string, n: number, unit: number): Promise<string | null> {
  const [lo, hi] = unitRange(key);
  if (!PRICE[key] || n < 1 || n > MARKET_MAX_QTY || unit < lo || unit > hi) return 'Fiyat ya da adet geçersiz.';
  const cRef = doc(db, 'couples', w.coupleId);
  const lRef = doc(col());
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(cRef);
    if (!snap.exists()) return 'Çift bulunamadı.';
    const farm = farmOf(snap.data() as Couple);
    if (!farm.name) return 'Önce çiftliğinize bir ad verin.';
    const r = apply(farm, { a: 'mkOut', i: 0, key, n }, w.uid, w.name, w.partnerName);
    if (typeof r === 'string') return r;
    const now = Date.now();
    tx.update(cRef, farmWrite(r.farm));
    tx.set(lRef, {
      seller: w.coupleId,
      farm: farm.name,
      lvl: levelOf(farm.xp).level,
      key,
      n,
      price: unit * n,
      status: 'open',
      createdAtMs: now,
      expMs: now + MARKET_HOURS * 3600 * 1000,
    });
    return null;
  });
}

export async function buyListing(w: Who, l: Listing): Promise<string | null> {
  if (l.seller === w.coupleId) return 'Kendi ilanınızı alamazsınız.';
  const cRef = doc(db, 'couples', w.coupleId);
  const lRef = doc(col(), l.id);
  return runTransaction(db, async (tx) => {
    const [ls, snap] = [await tx.get(lRef), await tx.get(cRef)];
    const cur = ls.data() as Omit<Listing, 'id'> | undefined;
    if (!ls.exists() || !cur || cur.status !== 'open' || cur.expMs < Date.now()) return 'Bu ilan artık yok; başkası almış olabilir.';
    if (!snap.exists()) return 'Çift bulunamadı.';
    const r = apply(
      farmOf(snap.data() as Couple),
      { a: 'mkIn', i: 0, key: cur.key, n: cur.n, cost: cur.price },
      w.uid,
      w.name,
      w.partnerName,
    );
    if (typeof r === 'string') return r;
    tx.update(cRef, farmWrite(r.farm));
    tx.update(lRef, { status: 'sold', buyer: w.coupleId, soldAtMs: Date.now() });
    return null;
  });
}

// İlanı geri çek ya da süresi dolanı depoya döndür.
export async function takeBack(w: Who, id: string): Promise<string | null> {
  const cRef = doc(db, 'couples', w.coupleId);
  const lRef = doc(col(), id);
  return runTransaction(db, async (tx) => {
    const [ls, snap] = [await tx.get(lRef), await tx.get(cRef)];
    const cur = ls.data() as Omit<Listing, 'id'> | undefined;
    if (!ls.exists() || !cur || cur.seller !== w.coupleId) return 'İlan bulunamadı.';
    if (cur.status !== 'open') return 'Bu ilan az önce satıldı.';
    if (!snap.exists()) return 'Çift bulunamadı.';
    const r = apply(farmOf(snap.data() as Couple), { a: 'mkBack', i: 0, key: cur.key, n: cur.n }, w.uid, w.name, w.partnerName);
    if (typeof r === 'string') return r;
    tx.update(cRef, farmWrite(r.farm));
    tx.delete(lRef);
    return null;
  });
}

// Çiftlik açılınca: satılan ilanların bedelini tahsil et, süresi dolanları depoya döndür. Geriye ne olduğunu söyler.
export async function settleMine(w: Who): Promise<{ sold: number; coins: number; back: number; open: Listing[] }> {
  const mine = await loadMine(w.coupleId);
  const out = { sold: 0, coins: 0, back: 0, open: [] as Listing[] };
  const now = Date.now();
  for (const l of mine) {
    if (l.status === 'sold') {
      const cRef = doc(db, 'couples', w.coupleId);
      const lRef = doc(col(), l.id);
      const ok = await runTransaction(db, async (tx) => {
        const [ls, snap] = [await tx.get(lRef), await tx.get(cRef)];
        if (!ls.exists() || (ls.data() as Listing).status !== 'sold' || !snap.exists()) return false;
        const r = apply(
          farmOf(snap.data() as Couple),
          { a: 'mkPaid', i: 0, key: l.key, n: l.n, coins: l.price },
          w.uid,
          w.name,
          w.partnerName,
        );
        if (typeof r === 'string') return false;
        tx.update(cRef, farmWrite(r.farm));
        tx.delete(lRef);
        return true;
      }).catch(() => false);
      if (ok) {
        out.sold++;
        out.coins += l.price;
      }
    } else if (l.expMs < now) {
      if ((await takeBack(w, l.id).catch(() => 'x')) === null) out.back++;
    } else out.open.push(l);
  }
  return out;
}

// ---------- Gezgin tüccar ----------
// Pazar boş kalmasın diye her gün değişen üç teklif (bütün çiftlere aynı). Sistem fiyatının biraz üstünde satar,
// her teklif günde bir kez alınabilir. Sunucu kaydı yoktur; günden türetilir.
export type Offer = { id: string; key: string; n: number; cost: number };
// level verilirse yalnızca o seviyede açılmış ürünler teklif edilir.
export function traderOffers(day: string, level = 99): Offer[] {
  const keys = Object.keys(PRICE)
    .filter((k) => unlockLvl(k) <= level)
    .sort();
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: Offer[] = [];
  const used = new Set<string>();
  for (let i = 0; out.length < 3 && i < 40; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const key = keys[h % keys.length];
    if (used.has(key)) continue;
    used.add(key);
    const n = 2 + ((h >>> 8) % 5);
    out.push({ id: `${day}_${key}`, key, n, cost: Math.round(PRICE[key] * n * 1.5) });
  }
  return out;
}
