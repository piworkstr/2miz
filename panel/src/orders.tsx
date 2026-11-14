import { doc, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import { loadAlbumInput } from '../../src/lib/albumData';
import { albumPreviewHtml } from '../../src/lib/albumHtml';
import { buildAlbum, type AlbumPerson } from '../../src/lib/albumLayout';
import { artAvatarHtml } from '../../src/lib/avatarArt';
import { NEXT, setOrderStatus, tl, type Order } from '../../src/lib/orders';
import { db } from './firebase';
import { Badge } from './overview';

const date = (ms: number) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
const size = (s: string) => (s === '21x21' ? '21×21 cm' : s);

// Baskıya gidecek albümün önizlemesi: uygulamadaki önizlemeyle aynı sayfalar.
// Kural gereği yalnızca açık siparişi olan çiftin albüm fotoğrafları okunabilir.
async function albumHtml(o: Order): Promise<string> {
  if (!o.range) throw new Error('eski');
  const couple = (await getDoc(doc(db, 'couples', o.coupleId))).data() as
    { members: string[]; names?: Record<string, string>; startDate?: string } | undefined;
  if (!couple) throw new Error('yok');
  const partner = couple.members.find((m) => m !== o.by) ?? '';
  const base =
    o.people?.length === 2 ? o.people : [o.by, partner].map((uid) => ({ uid, name: couple.names?.[uid] ?? '', avatar: undefined }));
  const people = base.map((p) => ({
    ...p,
    avatarHtml: p.avatar?.kind === 'art' ? artAvatarHtml(p.avatar.opts, (f) => `${location.origin}/avatar/${f}`) : undefined,
  })) as [AlbumPerson, AlbumPerson];
  const from = o.range.kind === 'period' ? o.range.from : '0000';
  const to = o.range.kind === 'period' ? o.range.to : '9999';
  const input = await loadAlbumInput(o.coupleId, people, couple.startDate, from, to, o.range.kind === 'trip' ? o.range.tripId : undefined);
  const plan = buildAlbum(input, { size: o.size, theme: o.theme ?? 'polaroid', range: o.range, exclude: o.exclude ?? [] });
  // Uygulamada sayfalar tek tek kaydırılır; panelde hepsi yan yana, büyük ekranda bir bakışta görülür.
  const grid =
    '<style>body{overflow:auto}.strip{flex-wrap:wrap;height:auto;overflow:visible;gap:18px;padding:18px;justify-content:center;align-items:flex-start}' +
    '.slot{flex:0 0 auto;padding:0}.slot .page{width:340px}</style>';
  return albumPreviewHtml(plan, input, o.size).replace('</head>', `${grid}</head>`);
}

export function Orders({ orders }: { orders: Order[] | null }) {
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'acik' | 'hepsi'>('acik');
  if (orders === null) return <p className="muted">Siparişler yükleniyor…</p>;
  const key = (o: Order) => `${o.coupleId}/${o.id}`;
  const list = filter === 'acik' ? orders.filter((o) => !['teslim', 'iptal', 'talep'].includes(o.status)) : orders;
  const current = orders.find((o) => key(o) === sel) ?? null;

  return (
    <>
      <div className="spread">
        <div>
          <h1>Siparişler</h1>
          <p className="muted">Bir siparişe tıklayınca teslimat bilgisi, işlemler ve baskıya gidecek albüm açılır.</p>
        </div>
        <div className="chips">
          <button className={`chip${filter === 'acik' ? ' on' : ''}`} onClick={() => setFilter('acik')}>
            Açık siparişler
          </button>
          <button className={`chip${filter === 'hepsi' ? ' on' : ''}`} onClick={() => setFilter('hepsi')}>
            Hepsi ({orders.length})
          </button>
        </div>
      </div>
      <div className="card scroll">
        {list.length ? (
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Çift</th>
                <th>Albüm</th>
                <th>Tutar</th>
                <th>Teslimat</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={key(o)} className={`click${sel === key(o) ? ' sel' : ''}`} onClick={() => setSel(sel === key(o) ? null : key(o))}>
                  <td>{date(o.createdAtMs)}</td>
                  <td>{o.names || 'Çift'}</td>
                  <td>{`${size(o.size)} · ${o.pageCount} sayfa`}</td>
                  <td>{o.price ? tl(o.price.total) : '—'}</td>
                  <td>{o.ship ? o.ship.city : '—'}</td>
                  <td>
                    <Badge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">{filter === 'acik' ? 'Açık sipariş yok.' : 'Henüz sipariş yok.'}</p>
        )}
      </div>
      {current && <Detail key={key(current)} o={current} />}
    </>
  );
}

function Detail({ o }: { o: Order }) {
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(o.tracking ?? '');
  const [sure, setSure] = useState(false);
  const [album, setAlbum] = useState<string | null>(null);
  const [albumMsg, setAlbumMsg] = useState('');
  const next = NEXT[o.status];
  const needsTracking = next?.to === 'kargo';
  const closed = o.status === 'teslim' || o.status === 'iptal';

  async function go(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch {
      alert('İşlem yapılamadı. Bağlantıyı kontrol edip tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }
  async function showAlbum() {
    setAlbumMsg('Albüm hazırlanıyor…');
    try {
      setAlbum(await albumHtml(o));
      setAlbumMsg('');
    } catch (e) {
      setAlbumMsg(
        (e as Error).message === 'eski' || closed
          ? 'Bu siparişin albümü panelde açılamıyor (sipariş kapanmış ya da eski sürümle verilmiş). Baskı dosyası Baskı Merkezi’nde üretilebilir.'
          : 'Albüm açılamadı. Çift, siparişi uygulamanın eski sürümüyle vermiş olabilir; baskı dosyası Baskı Merkezi’nde üretilebilir.',
      );
    }
  }

  return (
    <div className="card stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>{`${o.names || 'Çift'} · ${size(o.size)} · ${o.pageCount} sayfa`}</h2>
        <Badge status={o.status} />
      </div>
      <div className="grid">
        <div>
          <p className="muted small">Teslimat</p>
          {o.ship ? (
            <p className="pre">{`${o.ship.name}\n${o.ship.phone}\n${o.ship.address}\n${o.ship.city}`}</p>
          ) : (
            <p className="muted">Adres yok (baskı talebi).</p>
          )}
        </div>
        <div>
          <p className="muted small">Tutar</p>
          {o.price ? (
            <p className="pre">
              {`Albüm ${tl(o.price.album)}${o.price.discount ? `\nPlus indirimi −${tl(o.price.discount)}` : ''}\nKargo ${tl(o.price.shipping)}\nToplam ${tl(o.price.total)}`}
            </p>
          ) : (
            <p className="muted">Fiyat yok.</p>
          )}
        </div>
        <div>
          <p className="muted small">Kayıt</p>
          <p className="pre">{`Sipariş: ${date(o.createdAtMs)}${o.statusAtMs ? `\nSon işlem: ${date(o.statusAtMs)}` : ''}${o.tracking ? `\nTakip no: ${o.tracking}` : ''}`}</p>
        </div>
      </div>

      {!closed && (
        <div className="row">
          {needsTracking && (
            <input
              style={{ maxWidth: 260 }}
              placeholder="Kargo takip no (isteğe bağlı)"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              maxLength={40}
            />
          )}
          {next && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => go(() => setOrderStatus(o, next.to, needsTracking ? tracking.trim() : undefined))}
            >
              {next.label}
            </button>
          )}
          {o.status !== 'talep' && (
            <button disabled={busy} onClick={() => (sure ? go(() => setOrderStatus(o, 'iptal')) : setSure(true))}>
              {sure ? 'Emin misin? İptal et' : 'Siparişi iptal et'}
            </button>
          )}
        </div>
      )}

      <div className="stack">
        <div className="row">
          <button onClick={showAlbum}>{album ? 'Albümü yenile' : 'Baskıya gidecek albümü göster'}</button>
          {album && (
            <button className="ghost" onClick={() => setAlbum(null)}>
              Kapat
            </button>
          )}
        </div>
        {albumMsg && <p className="muted">{albumMsg}</p>}
        {album && <iframe className="album" title="Albüm önizlemesi" sandbox="allow-scripts" srcDoc={album} />}
        <p className="muted small">
          Baskı dosyası (PDF) yalnızca Baskı Merkezi’nde üretilir: <code>{`npm run siparis -- ${o.coupleId} ${o.id}`}</code>
        </p>
      </div>
    </div>
  );
}
