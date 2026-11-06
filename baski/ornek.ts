import path from 'node:path';
import { buildAlbum, type AlbumInput, type AlbumPhoto, type AlbumSize } from '../src/lib/albumLayout';
import { DEFAULT_OPTS } from '../src/lib/avatarArt';
import { renderAlbum } from './pdf';

// Örnek albüm: gerçek veri olmadan, matbaaya göstermek için renkli yer tutucu fotoğraflarla.
// Çalıştırma: cd baski && npm run ornek
const colors = ['#F4A6A0', '#9CC9E8', '#B7D7A8', '#F6D186', '#C3B1E1', '#F7B2D9', '#A0D2DB', '#E8C39E'];
const img = (i: number, label: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[i % 8]}"/><stop offset="1" stop-color="${colors[(i + 3) % 8]}"/></linearGradient></defs><rect width="1200" height="1200" fill="url(#g)"/><text x="600" y="630" font-size="96" text-anchor="middle" fill="white" font-family="sans-serif">${label}</text></svg>`,
  );

const A = 'a';
const B = 'b';
const days = ['2026-09-02', '2026-09-05', '2026-09-11', '2026-09-20', '2026-10-01', '2026-10-08', '2026-10-15', '2026-10-28', '2026-11-03', '2026-11-06'];
const tasks = ['t11', 't19', 't01', 't05', 't21', 't24', 't35', 't07', 't28', 't03'];
const notes = ['İlk defa beraber gün batımı', 'Çok güldük', 'Kahve soğudu ama değdi', 'Yağmurda yürüdük', 'Sen hep kazanıyorsun', 'Yeni sokak, yeni kafe', 'Gelecek ay Kapadokya!', '', 'Yine sarıldık', 'Yürürken düştüm, çok komikti'];
const photos: AlbumPhoto[] = [];
days.forEach((d, i) => {
  photos.push({ id: `${d}_a`, kind: 'task', day: d, uid: A, taskId: tasks[i], note: notes[i], src: img(i, 'Taner') });
  if (i % 4 !== 2) photos.push({ id: `${d}_b`, kind: 'task', day: d, uid: B, taskId: tasks[i], note: notes[(i + 3) % 10], src: img(i + 1, 'Aleyna') });
});
photos.push({ id: 'd1', kind: 'date', day: '2026-09-27', uid: A, taskId: null, note: 'İlk date günümüz, sahilde', src: img(5, 'Date') });
photos.push({ id: 'm1', kind: 'moment', day: '2026-10-20', uid: B, from: B, taskId: null, note: 'O akşamki gün batımı', src: img(6, 'Anı') });

const input: AlbumInput = {
  people: [
    { uid: A, name: 'Taner', avatar: { kind: 'drawn', opts: { ...DEFAULT_OPTS, top: 'shortFlat', facialHair: 'beardMedium' } } },
    { uid: B, name: 'Aleyna', avatar: { kind: 'drawn', opts: { ...DEFAULT_OPTS, top: 'straight01', clothesColor: '262e33' } } },
  ],
  startDate: '2022-04-01',
  photos,
  trips: [
    {
      id: 'kas',
      name: 'Kaş tatili',
      place: 'Kaş, Antalya',
      start: '2026-10-10',
      end: '2026-10-14',
      photos: ['Kaputaş', 'Teknede', 'Antik tiyatro', '', 'Akşam yemeği', 'Son gün'].map((n, i) => ({ id: `k${i}`, uid: i % 2 ? B : A, note: n, src: img(i + 2, 'Kaş') })),
    },
  ],
};

(async () => {
  for (const size of ['21x21', 'A4'] as AlbumSize[]) {
    const plan = buildAlbum(input, { size, theme: 'polaroid', range: { kind: 'period', from: '2026-09-01', to: '2026-11-30' }, exclude: [] });
    const out = path.join(__dirname, 'cikti', `ornek-${size}`);
    await renderAlbum(plan, input, size, out);
    console.log(`Hazır: ${out} (${plan.pages.length} sayfa)`);
  }
})();
