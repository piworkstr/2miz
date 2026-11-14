import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { db } from './firebase';
import type { Couple } from './session';

// Platform ve sürüm (yönetim panelindeki İstatistik için): çift belgesine os.<uid> = { p: 'ios' | 'android', v: sürüm }.
// Yalnızca değiştiğinde yazılır.
export function useDeviceStamp(couple: Couple | null, uid: string | undefined) {
  const p = Platform.OS;
  const v = Constants.expoConfig?.version ?? '?';
  const cur = uid ? couple?.os?.[uid] : undefined;
  const same = cur?.p === p && cur?.v === v;
  const coupleId = couple?.id;
  useEffect(() => {
    if (!coupleId || !uid || same) return;
    updateDoc(doc(db, 'couples', coupleId), { [`os.${uid}`]: { p, v } }).catch(() => {});
  }, [coupleId, uid, same, p, v]);
}
