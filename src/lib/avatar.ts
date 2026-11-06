import { doc, updateDoc } from 'firebase/firestore';
import { MOODS, type AvatarData, type MoodKey } from './avatarArt';
import { logActivity } from './bond';
import { db } from './firebase';
import { notifyPartner } from './push';

export * from './avatarArt';

export async function saveAvatar(uid: string, avatar: AvatarData) {
  await updateDoc(doc(db, 'users', uid), { avatar });
}

export async function setMood(
  coupleId: string | undefined,
  uid: string,
  key: MoodKey | null,
  notify?: { to: string | null; fromName: string },
) {
  await updateDoc(doc(db, 'users', uid), { mood: key ? { key, atMs: Date.now() } : null });
  if (key && coupleId) logActivity(coupleId, uid, 'message');
  if (key && notify?.to) {
    notifyPartner(notify.to, notify.fromName, `Ruh hali: ${MOODS[key].emoji} ${MOODS[key].label}`, { type: 'mood', url: '/' });
  }
}
