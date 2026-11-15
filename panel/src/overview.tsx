import { collection, doc, getCountFromServer, onSnapshot, query, setDoc, Timestamp, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey } from '../../src/lib/date';
import { STATUS, tl, type Order } from '../../src/lib/orders';
import { loadStats, type Partner } from '../../src/lib/perks';
import { db } from './firebase';
import type { Feedback, Report } from './manage';

type Nums = { couples: number; week: number; today: number; plus: number; venue: number; venues: number };

// Genel bakış: sayılar ve yöneticiyi bekleyen işler.
export function Overview(props: {
  orders: Order[] | null;
  partners: Partner[] | null;
  feedback: Feedback[] | null;
  reports: Report[] | null;
  go: (tab: string) => void;
}) {
  const { orders, partners, feedback, reports, go } = props;
  const [n, setN] = useState<Partial<Nums>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const couples = collection(db, 'couples');
    const count = (q: Parameters<typeof getCountFromServer>[0]) => getCountFromServer(q).then((s) => s.data().count);
    const weekAgo = Timestamp.fromMillis(Date.now() - 7 * 86400_000);
    Promise.all([
      count(couples),
      count(query(couples, where('createdAt', '>=', weekAgo))),
      count(query(couples, where('lastCompleteDay', '==', dayKey()))),
      count(query(couples, where('plus.until', '>', Date.now()))),
    ])
      .then(([c, w, t, p]) => setN((x) => ({ ...x, couples: c, week: w, today: t, plus: p })))
      .catch(() => setFailed(true));
  }, []);

  const ids = (partners ?? []).map((p) => p.id).join(',');
  useEffect(() => {
    if (partners === null) return;
    Promise.all(partners.map((p) => loadStats(p.id).catch(() => ({ couples: 0, fresh: 0, uses: 0 })))).then((all) =>
      setN((x) => ({ ...x, venue: all.reduce((s, a) => s + a.couples, 0), venues: partners.filter((p) => p.active).length })),
    );
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const num = (v: number | undefined) => (v === undefined ? '…' : String(v));
  const pct = n.couples ? Math.round(((n.today ?? 0) / n.couples) * 100) : 0;
  const by = (s: string) => (orders ?? []).filter((o) => o.status === s).length;
  const todo: { text: string; tab: string }[] = [];
  if (by('odeme')) todo.push({ text: `${by('odeme')} sipariş ödeme bekliyor`, tab: 'siparis' });
  if (by('odendi')) todo.push({ text: `${by('odendi')} sipariş baskıya verilecek`, tab: 'siparis' });
  if (by('baski')) todo.push({ text: `${by('baski')} sipariş baskıda, kargoya verilecek`, tab: 'siparis' });
  const fb = (feedback ?? []).filter((f) => f.status !== 'yapildi' && f.kind !== 'olay').length;
  if (fb) todo.push({ text: `${fb} yeni hata ve öneri`, tab: 'bildirim' });
  const rp = (reports ?? []).filter((r) => r.status !== 'incelendi').length;
  if (rp) todo.push({ text: `${rp} incelenmemiş şikayet`, tab: 'sikayet' });

  return (
    <>
      <div>
        <h1>Genel bakış</h1>
        <p className="muted">Sayılar sayfa açıldığında alınır; yenilemek için sayfayı yenile.</p>
      </div>
      {failed && <p className="error">Çift sayıları okunamadı. Firestore kuralları güncel mi?</p>}
      <div className="grid">
        <div className="card stat">
          <p className="muted small">Eşleşmiş çift</p>
          <p className="n">{num(n.couples)}</p>
          <p className="small ok">son 7 günde +{num(n.week)}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Bugün görevi tamamlayan çift</p>
          <p className="n">{num(n.today)}</p>
          <p className="small muted">%{pct}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Plus çift</p>
          <p className="n">{num(n.plus)}</p>
          <p className="small muted">satın alan ve hediye</p>
        </div>
        <div className="card stat">
          <p className="muted small">Mekanlardan gelen çift</p>
          <p className="n">{num(n.venue)}</p>
          <p className="small muted">{num(n.venues)} açık mekan</p>
        </div>
      </div>

      <div className="card">
        <h2>Sizi bekleyen işler</h2>
        {todo.length ? (
          <div className="stack">
            {todo.map((t) => (
              <div key={t.text} className="spread">
                <span>{t.text}</span>
                <button onClick={() => go(t.tab)}>Aç</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Bekleyen iş yok.</p>
        )}
      </div>

      <div className="card">
        <div className="spread">
          <h2>Son siparişler</h2>
          <button className="ghost" onClick={() => go('siparis')}>
            Tümü
          </button>
        </div>
        {(orders ?? []).length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Çift</th>
                  <th>Albüm</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).slice(0, 5).map((o) => (
                  <tr key={`${o.coupleId}/${o.id}`}>
                    <td>{o.names || 'Çift'}</td>
                    <td>{`${o.size === '21x21' ? '21×21' : o.size} · ${o.pageCount} s.`}</td>
                    <td>{o.price ? tl(o.price.total) : '—'}</td>
                    <td>
                      <Badge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Henüz sipariş yok.</p>
        )}
      </div>
    </>
  );
}

export function Badge({ status }: { status: Order['status'] }) {
  const s = STATUS[status] ?? { label: String(status), color: '#7A6A3A', soft: '#F6F0DC' };
  return (
    <span className="badge" style={{ background: s.soft, color: s.color }}>
      {s.label}
    </span>
  );
}

// Bakım modu: açıkken uygulamayı açan herkes bakım ekranını görür (kurucu çift hariç). config/app belgesinde durur.
export function MaintenanceCard() {
  const [cfg, setCfg] = useState<{ maintenance?: boolean; message?: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'app'),
        (s) => {
          const d = (s.data() as { maintenance?: boolean; message?: string } | undefined) ?? {};
          setCfg(d);
          setMsg(d.message ?? '');
        },
        () => setCfg({}),
      ),
    [],
  );
  const on = !!cfg?.maintenance;
  async function save(next: boolean) {
    setBusy(true);
    setErr('');
    try {
      await setDoc(doc(db, 'config', 'app'), { maintenance: next, message: msg.trim().slice(0, 200) }, { merge: true });
    } catch {
      setErr('Kaydedilemedi.');
    }
    setBusy(false);
  }
  return (
    <div className="card stack" style={on ? { borderColor: '#d9534f' } : undefined}>
      <div className="spread">
        <div>
          <h2>Bakım modu: {cfg === null ? '…' : on ? 'AÇIK' : 'kapalı'}</h2>
          <p className="muted">
            Açıkken uygulamaya giren herkes bakım ekranını görür ve hiçbir yere geçemez; kurucu çift (siz) hariç. Kapatınca ekran
            kendiliğinden kalkar. Yalnızca bu özelliği içeren güncellemeyi almış telefonlarda çalışır.
          </p>
        </div>
        <button className={on ? '' : 'primary'} disabled={busy || cfg === null} onClick={() => save(!on)}>
          {on ? 'Bakım modunu kapat' : 'Bakım modunu aç'}
        </button>
      </div>
      <div className="form">
        <label>
          Ekranda görünecek not (boşsa hazır metin)
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={200} placeholder="Yarın 10:00'da yeniden açılıyoruz." />
        </label>
      </div>
      {on && (
        <div className="row">
          <button disabled={busy} onClick={() => save(true)}>
            Notu güncelle
          </button>
        </div>
      )}
      {!!err && <p className="error">{err}</p>}
    </div>
  );
}
