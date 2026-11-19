import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
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

const COUPLE_PARTS = [
  'photos',
  'days',
  'dates',
  'coupons',
  'games',
  'messages',
  'messagePhotos',
  'messageAudio',
  'presence',
  'events',
  'busy',
  'albumOrders',
  'trips',
  'tripPhotos',
  'bonuses',
];

// Çiftin tüm ortak verilerini ve çift belgesini siler. Kimse yeniden davet kodu olmadan
// eşleşemez; bu yüzden eşleşmeyi bitirmek aynı zamanda engellemek demektir.
async function wipeCouple(coupleId: string) {
  // Bir alt koleksiyon silinemese de (ör. kural izin vermiyorsa) hesap silme yarıda kalmasın.
  for (const sub of COUPLE_PARTS) await wipe(['couples', coupleId, sub]).catch(() => {});
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

// ---- E-posta doğrulama, e-posta ve şifre değiştirme ----
const me = () => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('no-session');
  return user;
};
const reauth = (password: string) => {
  const user = me();
  return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password));
};
// Firebase'in gönderdiği e-postalar uygulama dilinde gitsin.
export const setAuthLang = (lang: 'tr' | 'en') => {
  auth.languageCode = lang;
};
export async function sendVerify() {
  await sendEmailVerification(me());
}
// Kullanıcı bağlantıya tıkladıktan sonra durumu yeniler; doğrulandıysa true.
export async function refreshVerified(): Promise<boolean> {
  const user = me();
  await user.reload();
  return !!auth.currentUser?.emailVerified;
}
// Yeni adrese doğrulama bağlantısı gider; tıklanınca e-posta değişir (yanlış yazılan adres hesabı kilitlemez).
export async function changeEmail(password: string, newEmail: string) {
  await reauth(password);
  await verifyBeforeUpdateEmail(me(), newEmail.trim());
}
export async function changePassword(password: string, next: string) {
  await reauth(password);
  await updatePassword(me(), next);
}
// Firebase hata kodlarını okunur cümleye çevirir.
export function authError(e: unknown, lang: 'tr' | 'en' = 'tr'): string {
  const code = (e as { code?: string })?.code ?? '';
  const tr = lang === 'tr';
  if (code.includes('wrong-password') || code.includes('invalid-credential'))
    return tr ? 'Mevcut şifren yanlış.' : 'Your current password is wrong.';
  if (code.includes('email-already-in-use'))
    return tr ? 'Bu e-posta başka bir hesapta kullanılıyor.' : 'This email is already used by another account.';
  if (code.includes('invalid-email')) return tr ? 'E-posta adresi geçerli görünmüyor.' : 'That email address looks invalid.';
  if (code.includes('weak-password')) return tr ? 'Yeni şifre en az 6 karakter olmalı.' : 'The new password must be at least 6 characters.';
  if (code.includes('too-many-requests'))
    return tr ? 'Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.' : 'Too many attempts. Wait a bit and try again.';
  if (code.includes('network')) return tr ? 'Bağlantı yok. İnternetini kontrol et.' : 'No connection. Check your internet.';
  return tr ? 'İşlem yapılamadı. Yeniden dene.' : 'That didn’t work. Try again.';
}
