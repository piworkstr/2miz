import { addDoc, collection, collectionGroup, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import type { AlbumOptions, AlbumSize } from './albumLayout';
import { db } from './firebase';

// Baskı albüm siparişi. Fiyatları kurucu çift uygulamadan belirler (config/album); sipariş anındaki tutar siparişe yazılır.
// Ödeme şimdilik uygulama dışında alınır; kurucu çift "Ödeme alındı" işaretler. Baskı dosyası yalnızca Baskı Merkezi'nde üretilir.

export type AlbumConfig = {
  prices: Record<AlbumSize, number>; // TL
  shipping: number; // TL
  plusPct: number; // Plus indirimi (%)
  open: boolean; // sipariş alınıyor mu
};

export type OrderStatus = 'talep' | 'odeme' | 'odendi' | 'baski' | 'kargo' | 'teslim' | 'iptal';
export const STATUS: Record<OrderStatus, { label: string; color: string; soft: string }> = {
  talep: { label: 'Talep', color: '#7A6A3A', soft: '#F6F0DC' },
  odeme: { label: 'Ödeme bekliyor', color: '#8A5A00', soft: '#FAEEDA' },
  odendi: { label: 'Ödeme alındı', color: '#1F7A62', soft: '#E1F5EE' },
  baski: { label: 'Baskıda', color: '#C2477A', soft: '#FBEAF0' },
  kargo: { label: 'Kargoda', color: '#2F6FA8', soft: '#E6F0FA' },
  teslim: { label: 'Teslim edildi', color: '#2E8B6A', soft: '#E3F4EC' },
  iptal: { label: 'İptal', color: '#8A7479', soft: '#F0E9EA' },
};
// Çiftin gördüğü adımlar ve yöneticinin tek dokunuşla ilerlettiği sıra.
export const STEPS: { id: OrderStatus; label: string }[] = [
  { id: 'odeme', label: 'Sipariş alındı' },
  { id: 'odendi', label: 'Ödeme alındı' },
  { id: 'baski', label: 'Baskıda' },
  { id: 'kargo', label: 'Kargoya verildi' },
  { id: 'teslim', label: 'Teslim edildi' },
];
export const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  odeme: { to: 'odendi', label: 'Ödeme alındı' },
  odendi: { to: 'baski', label: 'Baskıya verildi' },
  baski: { to: 'kargo', label: 'Kargoya verildi' },
  kargo: { to: 'teslim', label: 'Teslim edildi' },
};

export type Price = { album: number; discount: number; shipping: number; total: number };
export type Ship = { name: string; phone: string; address: string; city: string };
export type Order = {
  id: string;
  coupleId: string;
  by: string;
  names?: string;
  size: AlbumSize;
  pageCount: number;
  status: OrderStatus;
  createdAtMs: number;
  statusAtMs?: number;
  price?: Price;
  ship?: Ship;
  tracking?: string;
};

export const tl = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} TL`;

export function priceOf(cfg: AlbumConfig, size: AlbumSize, plusPaid: boolean): Price {
  const album = cfg.prices[size] ?? 0;
  const discount = plusPaid ? Math.round((album * (cfg.plusPct ?? 0)) / 100) : 0;
  const shipping = cfg.shipping ?? 0;
  return { album, discount, shipping, total: album - discount + shipping };
}
// Fiyat girilmiş ve sipariş açık mı?
export const canOrder = (cfg: AlbumConfig | null | undefined, size: AlbumSize) => !!cfg?.open && (cfg.prices?.[size] ?? 0) > 0;

export function useAlbumConfig(): AlbumConfig | null | undefined {
  const [cfg, setCfg] = useState<AlbumConfig | null | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'album'),
        (s) => setCfg(s.exists() ? (s.data() as AlbumConfig) : null),
        () => setCfg(null),
      ),
    [],
  );
  return cfg;
}
export async function saveAlbumConfig(cfg: AlbumConfig) {
  await setDoc(doc(db, 'config', 'album'), cfg);
}

export async function createOrder(
  coupleId: string,
  uid: string,
  names: string,
  opts: AlbumOptions,
  pageCount: number,
  price: Price,
  ship: Ship,
) {
  await addDoc(collection(db, 'couples', coupleId, 'albumOrders'), {
    coupleId,
    by: uid,
    names,
    size: opts.size,
    theme: opts.theme,
    range: opts.range,
    exclude: opts.exclude,
    pageCount,
    price,
    ship,
    status: 'odeme',
    createdAtMs: Date.now(),
  });
}

const sorted = (list: Order[]) => list.sort((a, b) => b.createdAtMs - a.createdAtMs);

export function useMyOrders(coupleId: string | undefined): Order[] | null {
  const [list, setList] = useState<Order[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      collection(db, 'couples', coupleId, 'albumOrders'),
      (snap) => setList(sorted(snap.docs.map((d) => ({ coupleId, ...(d.data() as Omit<Order, 'id' | 'coupleId'>), id: d.id })))),
      () => setList([]),
    );
  }, [coupleId]);
  return list;
}

// Yönetim: bütün çiftlerin siparişleri (yalnızca kurucu çift okuyabilir).
export function useAllOrders(enabled: boolean): Order[] | null {
  const [list, setList] = useState<Order[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collectionGroup(db, 'albumOrders'),
      (snap) =>
        setList(
          sorted(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<Order, 'id'>),
              id: d.id,
              coupleId: d.ref.parent.parent?.id ?? '',
            })),
          ),
        ),
      () => setList([]),
    );
  }, [enabled]);
  return list;
}

export async function setOrderStatus(o: Order, status: OrderStatus, tracking?: string) {
  await updateDoc(doc(db, 'couples', o.coupleId, 'albumOrders', o.id), {
    status,
    statusAtMs: Date.now(),
    ...(tracking !== undefined ? { tracking } : {}),
  });
}
