import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Karışması kolay harfler (0/O, 1/I) çıkarıldı.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return code;
}

export async function createInvite(name: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Önce giriş yapmalısın.');
  const code = makeCode();
  await setDoc(doc(db, 'invites', code), { uid, name, createdAt: serverTimestamp() });
  return code;
}

export async function joinInvite(rawCode: string, myName: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Önce giriş yapmalısın.');
  const code = rawCode.trim().toUpperCase();
  const inviteRef = doc(db, 'invites', code);

  const first = await getDoc(inviteRef);
  if (!first.exists()) throw new Error('Bu kod bulunamadı. Partnerinden kodu tekrar kontrol etmesini iste.');
  const inviter = first.data() as { uid: string; name: string };
  if (inviter.uid === uid) throw new Error('Kendi kodunu giremezsin, partnerinin kodunu gir.');

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(inviteRef);
    if (!snap.exists()) throw new Error('Bu kod az önce kullanılmış.');
    const coupleRef = doc(db, 'couples', `${inviter.uid}_${uid}`);
    tx.set(coupleRef, {
      members: [inviter.uid, uid],
      names: { [inviter.uid]: inviter.name, [uid]: myName },
      points: 0,
      streak: 0,
      lastCompleteDay: null,
      createdAt: serverTimestamp(),
    });
    tx.delete(inviteRef);
  });
}
