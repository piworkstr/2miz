import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { db } from './firebase';
import { levelOf,
  xpOf, newFarm, type Farm } from './farm';

// Çiftlik ziyareti: her çiftliğin herkese açık, salt okunur bir kopyası farmPublic/{çift} belgesinde durur.
// Kopyada yalnızca görünen şeyler vardır (kareler, çiftlik adı, köpeğin adı, seviye); altın, depo, siparişler,
// günlük ve Not Ağacı'ndaki notlar YOKTUR. Çift "ziyarete açık" ayarını kapatırsa kopya silinir.
export type PublicFarm = {
  id: string;
  name: string;
  lvl: number;
  dog?: string;
  at: number;
  tiles: Farm['tiles'];
  giftSpot?: number;
  noteAt?: number;
};
export type Visit = { id: string; name: string; at: number };

const pubRef = (coupleId: string) => doc(db, 'farmPublic', coupleId);
const MIN_GAP = 10 * 60_000; // en çok 10 dakikada bir yazılır (yazma kotası)

// Görünümün parmak izi: görünen bir şey değişmediyse yeniden yazılmaz (ekinlerin büyümesi sayılmaz).
const sig = (f: Farm) => {
  let h = 7;
  const add = (x: string) => {
    for (let i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) | 0;
  };
  add(`${f.name}|${f.dog}|${levelOf(xpOf(f)).level}|${f.giftSpot}|${f.noteAt}`);
  f.tiles.forEach((t) => add(t.k === 'crop' ? `c${t.crop}` : `${t.k}${'item' in t ? String(t.item) : ''}`));
  return String(h);
};

// Çiftlik açıkken görünüm değiştikçe kopyayı günceller; ekrandan çıkarken son hâlini yazar.
export function usePublishFarm(coupleId: string | undefined, farm: Farm | null) {
  const last = useRef({ at: 0, sig: '' });
  const latest = useRef(farm);
  latest.current = farm;
  const write = async (force: boolean) => {
    const f = latest.current;
    if (!coupleId || !f) return;
    if (f.closed || !f.name) {
      if (last.current.sig !== 'closed') {
        last.current = { at: Date.now(), sig: 'closed' };
        await deleteDoc(pubRef(coupleId)).catch(() => {});
      }
      return;
    }
    const s = sig(f);
    if (s === last.current.sig) return;
    if (!force && Date.now() - last.current.at < MIN_GAP) return;
    last.current = { at: Date.now(), sig: s };
    await setDoc(pubRef(coupleId), {
      name: f.name,
      lvl: levelOf(xpOf(f)).level,
      ...(f.dog ? { dog: f.dog } : {}),
      at: Date.now(),
      tiles: f.tiles,
      ...(f.giftSpot !== undefined ? { giftSpot: f.giftSpot } : {}),
      ...(f.noteAt !== undefined ? { noteAt: f.noteAt } : {}),
    }).catch(() => {});
  };
  const key = farm ? `${farm.closed}|${farm.name}` : '';
  useEffect(() => {
    const id = setTimeout(() => void write(false), 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm]);
  // Ad ya da açık/kapalı ayarı değişince beklemeden yaz.
  useEffect(() => {
    if (key) void write(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      void write(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}

// Komşu çiftlikler: en son güncellenen 24 çiftlik (kendi çiftliğin hariç). Tek seferlik okuma.
export function useNeighbors(myCoupleId: string | undefined, on: boolean) {
  const [list, setList] = useState<Omit<PublicFarm, 'tiles'>[] | null>(null);
  useEffect(() => {
    if (!on || !myCoupleId) return;
    let alive = true;
    getDocs(query(collection(db, 'farmPublic'), orderBy('at', 'desc'), limit(25)))
      .then((s) => {
        if (!alive) return;
        setList(
          s.docs
            .filter((d) => d.id !== myCoupleId)
            .map((d) => {
              const x = d.data() as PublicFarm;
              return { id: d.id, name: x.name, lvl: x.lvl, dog: x.dog, at: x.at };
            }),
        );
      })
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [on, myCoupleId]);
  return list;
}

// Ziyaret edilen çiftlik: görünümü çizmek için boş bir çiftliğin üstüne açık kopya bindirilir.
export async function loadPublicFarm(id: string): Promise<{ farm: Farm; name: string; lvl: number } | null> {
  const s = await getDoc(pubRef(id));
  if (!s.exists()) return null;
  const x = s.data() as PublicFarm;
  const base = newFarm();
  if (!Array.isArray(x.tiles) || x.tiles.length !== base.tiles.length) return null; // eski boyutta kopya
  return {
    name: x.name,
    lvl: x.lvl,
    farm: { ...base, tiles: x.tiles, name: x.name, dog: x.dog, giftSpot: x.giftSpot, noteAt: x.noteAt },
  };
}

// Ziyaret izi: ziyaret eden çiftin çiftlik adı ve zamanı (çift başına tek kayıt). Sahibi "kimler uğradı"yı görür.
export async function leaveVisit(hostId: string, myCoupleId: string, myFarmName: string) {
  if (hostId === myCoupleId) return;
  await setDoc(doc(db, 'farmPublic', hostId, 'visits', myCoupleId), { name: myFarmName.slice(0, 22), at: Date.now() }).catch(() => {});
}
export function useVisitors(coupleId: string | undefined, on: boolean) {
  const [list, setList] = useState<Visit[] | null>(null);
  useEffect(() => {
    if (!on || !coupleId) return;
    let alive = true;
    getDocs(query(collection(db, 'farmPublic', coupleId, 'visits'), orderBy('at', 'desc'), limit(10)))
      .then((s) => alive && setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Visit, 'id'>) }))))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [on, coupleId]);
  return list;
}
