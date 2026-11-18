// Çiftlikte canlı eşleşme: iki partner de çiftlikteyken biri iş yaptığında öbürü bunu anında görür.
// İşler Firestore'a topluca (10'ar) kaydedildiği için tek başına kayıt gecikmeli gelir; aradaki boşluğu bu küçük
// belge kapatır: kişi başı tek belge (nerede, elinde ne var, henüz kaydedilmemiş işleri). Partner bunu dinler ve
// işleri kendi ekranında aynı kuralla uygular. Yazma yalnızca partner de çiftlikteyken yapılır (kota için).
// Belge "games" altında durur: üyelerin serbestçe yazabildiği tek koleksiyon; oyun sorguları "status" alanına
// baktığı için bu belgeler oyun listelerine karışmaz.
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { applyAction, type Action, type Farm } from './farm';
import { db } from './firebase';
import { srvNow } from './serverClock';

export type FarmLive = { tile: number; tool: string | null; acts: Action[]; atMs: number };
const FRESH_MS = 100_000; // kalp atışı 45 sn'de bir; iki atış kaçarsa partner çiftlikte sayılmaz

const liveDoc = (coupleId: string, uid: string) => doc(db, 'couples', coupleId, 'games', `_farm_${uid}`);

export function publishLive(coupleId: string, uid: string, live: Omit<FarmLive, 'atMs'> & { atMs?: number }) {
  // Firestore tanımsız alan kabul etmez: işler düz JSON'a çevrilir.
  const data = JSON.parse(JSON.stringify({ ...live, atMs: live.atMs ?? Date.now() }));
  setDoc(liveDoc(coupleId, uid), data).catch(() => {});
}

export const liveFresh = (l: FarmLive | null, now = Date.now()) => !!l && now - l.atMs < FRESH_MS;

export function usePartnerLive(coupleId: string | undefined, partnerId: string | null): FarmLive | null {
  const [live, setLive] = useState<FarmLive | null>(null);
  useEffect(() => {
    if (!coupleId || !partnerId) return;
    return onSnapshot(
      liveDoc(coupleId, partnerId),
      (s) => setLive((s.data() as FarmLive | undefined) ?? null),
      () => setLive(null),
    );
  }, [coupleId, partnerId]);
  return live;
}

// Henüz kaydedilmemiş işleri çiftliğin üstüne uygular (yalnız görüntü için). Kuralın reddettiği iş atlanır:
// kayıt bu arada geldiyse aynı iş ikinci kez uygulanmaz. Günlük kayıttan gelir, burada değişmez.
export function overlayFarm(base: Farm, acts: Action[], by: string): Farm {
  if (!acts.length || !by) return base;
  let f = base;
  const now = srvNow();
  for (const act of acts) {
    const r = applyAction(f, act, by, () => '', '', now, null);
    if (typeof r !== 'string') f = r.farm;
  }
  if (f === base) return base;
  // Deneme sırasında rastgele üretilen yeni siparişler gösterilmez (kayıttaki gerçek sipariş farklı çıkar, liste titrer).
  const known = new Set(base.orders.map((o) => o.id));
  return { ...f, log: base.log, orders: f.orders.filter((o) => known.has(o.id)) };
}
