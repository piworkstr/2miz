import { collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, setDoc, writeBatch, type Timestamp } from 'firebase/firestore';
import type Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps } from 'react';
import { DEMO_COUPLE } from './demoPersona';
import { db } from './firebase';
import type { Couple } from './session';

// Avantajlar: anlaşmalı mekanlarda çiftlere özel damga kartı ve indirim kodu.
// Amaç önce kullanıcı getirmek: mekandaki kart çifti uygulamaya çeker, kart ancak iki kişi eşleşince açılır.
// Sunucu yok; damganın gerçekten mekanda alındığını Firestore kuralı doğrular (kasa kodu = sha256(gizli anahtar + gün)).

type IconName = ComponentProps<typeof Ionicons>['name'];

export type PartnerCat = 'kafe' | 'restoran' | 'tatli' | 'kuafor' | 'sinema' | 'eglence' | 'diger';
export const CATS: Record<PartnerCat, { label: string; icon: IconName; color: string; soft: string }> = {
  kafe: { label: 'Kafe', icon: 'cafe', color: '#A4572E', soft: '#FAECE7' },
  restoran: { label: 'Restoran', icon: 'restaurant', color: '#B8433A', soft: '#FBE9E7' },
  tatli: { label: 'Tatlı', icon: 'ice-cream', color: '#C2477A', soft: '#FBEAF0' },
  kuafor: { label: 'Kuaför ve bakım', icon: 'cut', color: '#5B4BB5', soft: '#EEEDFE' },
  sinema: { label: 'Sinema', icon: 'film', color: '#1F7A62', soft: '#E1F5EE' },
  eglence: { label: 'Eğlence', icon: 'game-controller', color: '#2F6FA8', soft: '#E6F0FA' },
  diger: { label: 'Diğer', icon: 'storefront', color: '#7A6A3A', soft: '#F6F0DC' },
};

export type Period = 'day' | 'week' | 'month' | 'none';
export const PERIODS: Record<Period, string> = { day: 'Günde bir', week: 'Haftada bir', month: 'Ayda bir', none: 'Sınırsız' };

export type Partner = {
  id: string;
  name: string;
  cat: PartnerCat;
  city: string;
  area?: string; // semt
  type: 'stamp' | 'code';
  offer: string; // "5 kahve al, 6. hediye" / "İki bilete %25 indirim"
  goal?: number; // damga kartı: kaç damgada ödül
  welcome?: boolean; // ilk damga çift sayılır ("ilk damgan bizden")
  period?: Period; // indirim kodu: ne sıklıkla alınır
  ttlMin?: number; // indirim kodu kaç dakika geçerli
  note?: string; // koşullar (ör. hafta içi geçerli)
  active: boolean;
  createdAtMs: number;
};

// Çiftin avantaj hareketleri: damga, ödül kullanımı, indirim kodu. Yalnızca oluşturulur; silinmez, değişmez.
export type Perk = {
  id: string;
  t: 'stamp' | 'redeem' | 'code';
  pid: string;
  by: string;
  atMs: number;
  day?: string;
  code?: string;
};

export const isFounder = (couple: Couple | null | undefined) => couple?.id === DEMO_COUPLE;

// Türkiye saati (UTC+3, yaz saati yok) ile gün anahtarı. Firestore kuralı aynı biçimi üretir: sıfır dolgusuz "2026-11-14".
export function istDay(ms: number = Date.now()): string {
  const d = new Date(ms + 3 * 3600_000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
function periodKey(p: Period, ms: number): string {
  const d = new Date(ms + 3 * 3600_000);
  if (p === 'none') return `t${ms}`;
  if (p === 'day') return istDay(ms);
  if (p === 'month') return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
  // hafta: pazartesiden başlar
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400_000);
  return `h${monday.getUTCFullYear()}-${monday.getUTCMonth() + 1}-${monday.getUTCDate()}`;
}
// Bir sonraki hakkın açılacağı an (gösterim için).
export function nextPeriodStart(p: Period, ms: number): number | null {
  if (p === 'none') return null;
  const d = new Date(ms + 3 * 3600_000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const utc =
    p === 'day' ? Date.UTC(y, m, day + 1) : p === 'month' ? Date.UTC(y, m + 1, 1) : Date.UTC(y, m, day + (7 - ((d.getUTCDay() + 6) % 7)));
  return utc - 3 * 3600_000;
}

// --- SHA-256 (saf JS; yeni sürüm gerektirmesin diye yerel modül kullanılmıyor). Yalnızca ASCII girdi. ---
const K = new Uint32Array(64);
{
  let n = 0;
  for (let c = 2; n < 64; c++) {
    let prime = true;
    for (let i = 2; i * i <= c; i++) if (c % i === 0) prime = false;
    if (prime) K[n++] = (Math.pow(c, 1 / 3) * 0x100000000) | 0;
  }
}
export function sha256hex(s: string): string {
  const len = s.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const b = new Uint8Array(total);
  for (let i = 0; i < len; i++) b[i] = s.charCodeAt(i) & 0xff;
  b[len] = 0x80;
  const bits = len * 8;
  b[total - 4] = bits >>> 24;
  b[total - 3] = (bits >>> 16) & 0xff;
  b[total - 2] = (bits >>> 8) & 0xff;
  b[total - 1] = bits & 0xff;
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += bb;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

// Kasa kodu: basılı kartta sabit, kasa ekranında her gün değişir. Kural da aynısını hesaplar.
export const stampCode = (key: string, fixed: boolean, day: string = istDay()) => sha256hex(`${key}:${fixed ? 'sabit' : day}`).slice(0, 6);
export const stampLink = (pid: string, code: string) => `usdaily://perks/${pid}?c=${code}`;
// Okutulan QR'dan (ya da bağlantıdan) mekan ve kodu çıkarır.
export function parseStampLink(data: string): { pid: string; code: string } | null {
  const m = /perks\/([A-Za-z0-9_-]{4,40})\?c=([0-9a-fA-F]{6})/.exec(data);
  return m ? { pid: m[1], code: m[2].toLowerCase() } : null;
}

// --- okuma ---
export function usePartners(): Partner[] | null {
  const [list, setList] = useState<Partner[] | null>(null);
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'partners'),
        (snap) =>
          setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Partner, 'id'>) })).sort((a, b) => a.createdAtMs - b.createdAtMs)),
        () => setList([]),
      ),
    [],
  );
  return list;
}

export function usePerks(coupleId: string | undefined): Perk[] | null {
  const [list, setList] = useState<Perk[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      collection(db, 'couples', coupleId, 'perks'),
      (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Perk, 'id'>) }))),
      () => setList([]),
    );
  }, [coupleId]);
  return list;
}

// Damga kartının durumu: dolu damga, kullanılmayı bekleyen ödül, bugün damga alındı mı.
export function cardOf(p: Partner, perks: Perk[], now: number = Date.now()) {
  const mine = perks.filter((x) => x.pid === p.id);
  const stamps = mine.filter((x) => x.t === 'stamp');
  const redeems = mine.filter((x) => x.t === 'redeem').length;
  const goal = Math.max(2, p.goal ?? 5);
  const total = stamps.length + (p.welcome && stamps.length ? 1 : 0);
  const left = total - redeems * goal;
  const last = stamps.sort((a, b) => b.atMs - a.atMs)[0] ?? null;
  return {
    goal,
    filled: Math.min(goal, Math.max(0, left)),
    reward: left >= goal, // ödül hazır
    redeems,
    today: stamps.some((x) => x.day === istDay(now)),
    last,
    used: mine.length > 0,
  };
}

// İndirim kodunun durumu: geçerli kod (süresi dolmadıysa) ve bir sonraki hak.
export function codeOf(p: Partner, perks: Perk[], now: number = Date.now()) {
  const period = p.period ?? 'month';
  const ttl = (p.ttlMin ?? 15) * 60_000;
  const uses = perks.filter((x) => x.pid === p.id && x.t === 'code').sort((a, b) => b.atMs - a.atMs);
  const last = uses[0] ?? null;
  const live = last && now - last.atMs < ttl ? last : null;
  const usedThisPeriod = period !== 'none' && !!last && periodKey(period, last.atMs) === periodKey(period, now);
  return {
    period,
    live,
    expiresAt: live ? live.atMs + ttl : 0,
    canGet: !live && !usedThisPeriod,
    nextAt: usedThisPeriod ? nextPeriodStart(period, now) : null,
    count: uses.length,
  };
}

// --- yazma ---
function visitRef(pid: string, coupleId: string) {
  return doc(db, 'partners', pid, 'visits', coupleId);
}
// Mekana gelen çift sayacı: mekan kaç çift getirdi, kaçı yeni (son 30 günde eşleşmiş).
function visitData(couple: Couple, first: boolean, now: number) {
  const created = (couple as { createdAt?: Timestamp }).createdAt?.toMillis?.() ?? 0;
  return {
    n: increment(1),
    lastMs: now,
    ...(first ? { firstMs: now, fresh: !!created && now - created < 30 * 86400_000 } : {}),
  };
}

export type StampResult = 'ok' | 'today' | 'bad';
export async function addStamp(couple: Couple, uid: string, pid: string, code: string, perks: Perk[]): Promise<StampResult> {
  const now = Date.now();
  const day = istDay(now);
  if (perks.some((x) => x.pid === pid && x.t === 'stamp' && x.day === day)) return 'today';
  const batch = writeBatch(db);
  batch.set(doc(db, 'couples', couple.id, 'perks', `${pid}_s_${day}`), {
    t: 'stamp',
    pid,
    by: uid,
    atMs: now,
    day,
    code: code.toLowerCase(),
  });
  batch.set(visitRef(pid, couple.id), visitData(couple, !perks.some((x) => x.pid === pid), now), { merge: true });
  try {
    await batch.commit();
    return 'ok';
  } catch {
    return 'bad'; // kod yanlış, bugüne ait değil ya da mekan kapalı
  }
}

// Kart dolunca ödülü kullan: aynı ödül iki telefondan aynı anda basılsa da tek kayıt olur.
export async function redeemReward(couple: Couple, uid: string, p: Partner, perks: Perk[]) {
  const c = cardOf(p, perks);
  if (!c.reward) return;
  await setDoc(doc(db, 'couples', couple.id, 'perks', `${p.id}_r_${c.redeems + 1}`), { t: 'redeem', pid: p.id, by: uid, atMs: Date.now() });
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan harfler yok (0/O, 1/I)
const rnd = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

export async function getCode(couple: Couple, uid: string, p: Partner, perks: Perk[]) {
  const now = Date.now();
  if (!codeOf(p, perks, now).canGet) return;
  const batch = writeBatch(db);
  batch.set(doc(db, 'couples', couple.id, 'perks', `${p.id}_c_${periodKey(p.period ?? 'month', now)}`), {
    t: 'code',
    pid: p.id,
    by: uid,
    atMs: now,
    code: `2MZ-${rnd(4)}`,
  });
  batch.set(visitRef(p.id, couple.id), visitData(couple, !perks.some((x) => x.pid === p.id), now), { merge: true });
  await batch.commit();
}

// --- yönetim (yalnızca kurucu çift; kural da öyle) ---
export type PartnerInput = Omit<Partner, 'id' | 'createdAtMs'>;
export type Secret = { key: string; fixed: boolean };

export async function savePartner(id: string | null, data: PartnerInput, fixed: boolean): Promise<string> {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  if (id) {
    await setDoc(doc(db, 'partners', id), clean, { merge: true });
    await setDoc(doc(db, 'partnerSecrets', id), { fixed }, { merge: true });
    return id;
  }
  const ref = doc(collection(db, 'partners'));
  await setDoc(doc(db, 'partnerSecrets', ref.id), { key: rnd(24), fixed });
  await setDoc(ref, { ...clean, createdAtMs: Date.now() });
  return ref.id;
}
export async function removePartner(id: string) {
  await deleteDoc(doc(db, 'partners', id));
  await deleteDoc(doc(db, 'partnerSecrets', id));
}
export async function loadSecret(id: string): Promise<Secret | null> {
  const s = await getDoc(doc(db, 'partnerSecrets', id));
  return s.exists() ? (s.data() as Secret) : null;
}
export type Stats = { couples: number; fresh: number; uses: number };
export async function loadStats(id: string): Promise<Stats> {
  const snap = await getDocs(collection(db, 'partners', id, 'visits'));
  let fresh = 0;
  let uses = 0;
  snap.forEach((d) => {
    const v = d.data() as { n?: number; fresh?: boolean };
    uses += v.n ?? 0;
    if (v.fresh) fresh++;
  });
  return { couples: snap.size, fresh, uses };
}
