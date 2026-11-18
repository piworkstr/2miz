import { doc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Çiftlik süreleri telefonun saatine değil sunucu saatine göre işler: telefon saati ileri alınarak ürün hazır edilemez.
// Çiftlik açılınca (ve uygulama öne gelince) küçük bir belgeye sunucu zamanı yazılıp okunur; aradaki fark saklanır.
// Fark alınamazsa (bağlantı yok) telefon saati kullanılır.
let offset = 0;
let syncing = false;

export const srvNow = () => Date.now() + offset;

export async function syncClock(coupleId: string, uid: string): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const ref = doc(db, 'couples', coupleId, 'games', `_clock_${uid}`);
    const t0 = Date.now();
    await setDoc(ref, { t: serverTimestamp() });
    const snap = await getDocFromServer(ref);
    const t1 = Date.now();
    const srv = (snap.data()?.t as { toMillis?: () => number } | undefined)?.toMillis?.();
    // Gidiş dönüş süresinin yarısı kadar pay bırakılır; 5 sn'den küçük farklar yok sayılır (titreme olmasın).
    if (srv) {
      const d = srv - (t0 + t1) / 2;
      offset = Math.abs(d) < 5000 ? 0 : Math.round(d);
    }
  } catch {
    // bağlantı yok: eski fark kalır
  } finally {
    syncing = false;
  }
}
