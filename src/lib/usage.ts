import { doc, increment, updateDoc } from 'firebase/firestore';
import { dayKey } from './date';
import { db } from './firebase';

// Bölüm kullanım sayaçları (yönetim panelindeki İstatistik için).
// Çift belgesine yalnızca "bu bölüm kaç kez ve en son hangi gün kullanıldı" yazılır: use.<bölüm>.n ve use.<bölüm>.d
// İçerik (mesaj, fotoğraf, hamle) bu sayaçlara girmez.
export const FEATURES = {
  gorev: 'Günlük görev',
  sohbet: 'Sohbet',
  ruhhali: 'Ruh hali',
  oyun: 'Oyunlar (hepsi)',
  oyun_tavla: 'Oyun: Tavla',
  oyun_memory: 'Oyun: Hafıza',
  oyun_blocks: 'Oyun: Bloklar',
  oyun_knowme: 'Oyun: Beni tanı',
  oyun_thisthat: 'Oyun: Bu mu o mu',
  cark: 'Bonus çarkı',
  ciftlik: 'Çiftlik',
  album: 'Albüm',
  seyahat: 'Seyahat albümü',
  kupon: 'Kuponlar',
  takvim: 'Ortak takvim',
  date: 'Date',
  avantaj: 'Avantajlar (mekanlar)',
} as const;
export type Feature = keyof typeof FEATURES;
export type Usage = Partial<Record<Feature, { n?: number; d?: string }>>;

// Başka bir çift belgesi güncellemesine eklenecek alanlar (ek yazma maliyeti olmasın diye).
export function usageFields(features: Feature[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const today = dayKey();
  for (const f of features) {
    out[`use.${f}.n`] = increment(1);
    out[`use.${f}.d`] = today;
  }
  return out;
}

// Kalbi etkilemeyen bölümler için tek başına sayaç (takvim, date, avantajlar).
export async function logUse(coupleId: string, feature: Feature) {
  await updateDoc(doc(db, 'couples', coupleId), usageFields([feature])).catch(() => {});
}
