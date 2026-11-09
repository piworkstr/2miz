import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { buildAlbum, type AlbumInput, type AlbumOptions, type AlbumPhoto } from '../src/lib/albumLayout';

import { artAvatarHtml, type AvatarData } from '../src/lib/avatarArt';
import { renderAlbum } from './pdf';
// Çizgi avatar (yeni stil): katman dosyaları assets/avatar'dan base64 gömülür.
function artHtml(a: AvatarData | undefined): string | undefined {
  if (a?.kind !== 'art') return undefined;
  return artAvatarHtml(a.opts, (f) => {
    const b = fs.readFileSync(path.join(__dirname, '..', 'assets', 'avatar', f));
    return `data:image/webp;base64,${b.toString('base64')}`;
  });
}

// Sipariş (baskı talebi) için baskı dosyalarını üretir.
// Çalıştırma: cd baski && npm run siparis -- <çift kimliği> [talep kimliği]
// Gerekli: Firebase yönetici anahtarı baski/serviceAccount.json (asla paylaşılmaz, git'e girmez).
const keyFile = path.join(__dirname, 'serviceAccount.json');
if (!fs.existsSync(keyFile)) {
  console.error('baski/serviceAccount.json bulunamadı. Firebase konsolu > Proje ayarları > Hizmet hesapları > Yeni özel anahtar oluştur.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyFile, 'utf8'))) });
const db = getFirestore();

(async () => {
  const [coupleId, orderArg] = process.argv.slice(2);
  if (!coupleId) {
    console.error('Kullanım: npm run siparis -- <çift kimliği> [talep kimliği]');
    process.exit(1);
  }
  const coupleRef = db.collection('couples').doc(coupleId);
  const couple = (await coupleRef.get()).data();
  if (!couple) throw new Error('Çift bulunamadı.');

  const orders = coupleRef.collection('albumOrders');
  const orderSnap = orderArg ? await orders.doc(orderArg).get() : (await orders.orderBy('createdAtMs', 'desc').limit(1).get()).docs[0];
  if (!orderSnap?.exists) throw new Error('Baskı talebi bulunamadı.');
  const order = orderSnap.data() as {
    by: string;
    size: AlbumOptions['size'];
    theme: AlbumOptions['theme'];
    range: AlbumOptions['range'];
    exclude: string[];
  };

  const partnerId = (couple.members as string[]).find((m) => m !== order.by)!;
  const profile = async (uid: string) => (await db.collection('users').doc(uid).get()).data() ?? {};
  const [me, partner] = await Promise.all([profile(order.by), profile(partnerId)]);
  const names = couple.names as Record<string, string>;

  const from = order.range.kind === 'period' ? order.range.from : '0000';
  const to = order.range.kind === 'period' ? order.range.to : '9999';
  // Not: fotoğraflar yüksek çözünürlüğe geçince src, Storage'daki orijinal dosya olacak.
  const src = (data: string) => `data:image/jpeg;base64,${data}`;
  const photos: AlbumPhoto[] =
    order.range.kind === 'trip'
      ? []
      : (await coupleRef.collection('photos').where('day', '>=', from).where('day', '<=', to).get()).docs.map((d) => {
          const p = d.data();
          return {
            id: d.id,
            kind: p.kind,
            day: p.day,
            uid: p.uid,
            from: p.from,
            taskId: p.taskId ?? null,
            note: p.note ?? '',
            src: src(p.data),
          };
        });
  const tripDocs = (await coupleRef.collection('trips').get()).docs
    .map((d) => ({ id: d.id, ...(d.data() as { name: string; place: string; start: string; end: string }) }))
    .filter((t) => (order.range.kind === 'trip' ? t.id === order.range.tripId : t.start >= from && t.start <= to));
  const trips = [];
  for (const t of tripDocs) {
    const list = (await coupleRef.collection('tripPhotos').where('tripId', '==', t.id).get()).docs
      .map((d) => ({ id: d.id, ...(d.data() as { uid: string; note?: string; data: string; createdAtMs: number }) }))
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((p) => ({ id: p.id, uid: p.uid, note: p.note ?? '', src: src(p.data) }));
    trips.push({ ...t, photos: list });
  }

  const input: AlbumInput = {
    people: [
      { uid: order.by, name: names[order.by] ?? me.name ?? '', avatar: me.avatar, avatarHtml: artHtml(me.avatar) },
      { uid: partnerId, name: names[partnerId] ?? partner.name ?? '', avatar: partner.avatar, avatarHtml: artHtml(partner.avatar) },
    ],
    startDate: couple.startDate,
    photos,
    trips,
  };
  const plan = buildAlbum(input, { size: order.size, theme: order.theme, range: order.range, exclude: order.exclude ?? [] });
  const out = path.join(__dirname, 'cikti', `${coupleId}-${orderSnap.id}`);
  await renderAlbum(plan, input, order.size, out);
  await orderSnap.ref.update({ status: 'hazirlandi', pages: plan.pages.length, preparedAtMs: Date.now() });
  console.log(`Hazır: ${out} (${plan.pages.length} sayfa)`);
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
