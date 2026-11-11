import { deleteField, doc, FieldPath, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { notifyPartner } from './push';

// Ortak albümlerde silmek iki kişilik iş: biri ister, öteki onaylar; onaylanana kadar fotoğraf durur.
// İstekler çift belgesinde `delReq` haritasında tutulur (anahtar: tür_belgeId), böylece kural değişikliği gerekmez.
export type DelKind = 'moment' | 'tripPhoto' | 'trip';
export type DelReq = { kind: DelKind; id: string; by: string; at: number; label: string };

export const delKey = (kind: DelKind, id: string) => `${kind}_${id}`;

export async function requestDelete(coupleId: string, req: Omit<DelReq, 'at'>, partnerId: string | undefined, myName: string, url: string) {
  await updateDoc(doc(db, 'couples', coupleId), new FieldPath('delReq', delKey(req.kind, req.id)), { ...req, at: Date.now() });
  if (partnerId)
    notifyPartner(partnerId, `${myName} albümden bir şey silmek istiyor`, `${req.label} — sen onaylayınca silinecek.`, {
      type: 'trip',
      url,
    });
}

export async function cancelDelete(coupleId: string, kind: DelKind, id: string) {
  await updateDoc(doc(db, 'couples', coupleId), new FieldPath('delReq', delKey(kind, id)), deleteField()).catch(() => {});
}

// Onay: asıl silme işini çağıran yapar, ardından istek kaldırılır.
export async function approveDelete(coupleId: string, kind: DelKind, id: string, doIt: () => Promise<void>) {
  await doIt();
  await cancelDelete(coupleId, kind, id);
}
