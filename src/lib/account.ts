import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';

// Bir koleksiyondaki tüm belgeleri 400'lük gruplar halinde siler.
async function wipe(path: string[]) {
  const snap = await getDocs(collection(db, path[0], ...path.slice(1)));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

const COUPLE_PARTS = ['photos', 'days', 'dates', 'coupons', 'games', 'messages', 'messagePhotos', 'trips', 'tripPhotos'];

// Çiftin tüm ortak verilerini ve çift belgesini siler. Kimse yeniden davet kodu olmadan
// eşleşemez; bu yüzden eşleşmeyi bitirmek aynı zamanda engellemek demektir.
async function wipeCouple(coupleId: string) {
  for (const sub of COUPLE_PARTS) await wipe(['couples', coupleId, sub]);
  await deleteDoc(doc(db, 'couples', coupleId));
}

// Eşleşmeyi bitir: iki hesap da açık kalır, ikisi de eşleşme ekranına döner.
export async function endCouple(password: string, coupleId: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Oturum bulunamadı.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  await wipeCouple(coupleId);
}

// Hesabı ve kişisel verileri kalıcı olarak siler (App Store kuralı 5.1.1(v)).
// Çiftin ortak verileri (görev günleri, date'ler, albüm fotoğrafları ve kuponlar) da silinir;
// partnerin hesabı açık kalır ve yeniden eşleşme ekranına döner.
export async function deleteAccount(password: string, coupleId: string | null) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Oturum bulunamadı.');

  // Firebase, hesap silmeden önce yakın zamanda giriş yapılmasını ister.
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

  if (coupleId) await wipeCouple(coupleId);
  await deleteDoc(doc(db, 'users', user.uid));
  await deleteUser(user);
}
