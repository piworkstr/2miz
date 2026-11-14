import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { saveAlbumConfig, tl, type AlbumConfig } from '../../src/lib/orders';
import { db } from './firebase';
import { saveCosts, useCosts } from './stats';

const day = (ms: number | undefined) =>
  ms ? new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const ts = (t: Timestamp | null | undefined) => day(t?.toMillis?.());

// ---------- Çiftler ve Plus ----------
type CoupleRow = {
  id: string;
  members: string[];
  names?: Record<string, string>;
  createdAt?: Timestamp;
  streak?: number;
  points?: number;
  lastCompleteDay?: string | null;
  plus?: { until: number; by: string; product?: string };
};

export function Couples() {
  const [list, setList] = useState<CoupleRow[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const load = () =>
    getDocs(query(collection(db, 'couples'), limit(1000)))
      .then((s) =>
        setList(
          s.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<CoupleRow, 'id'>) }))
            .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)),
        ),
      )
      .catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);

  const name = (c: CoupleRow) => c.members.map((m) => c.names?.[m] ?? '?').join(' ve ');
  const now = Date.now();
  async function give(c: CoupleRow, months: number) {
    setBusy(c.id);
    try {
      // Süresi dolmamış hediye varsa onun üstüne eklenir.
      const start = c.plus && c.plus.by === 'hediye' && c.plus.until > now ? c.plus.until : now;
      const until = new Date(start);
      until.setMonth(until.getMonth() + months);
      await updateDoc(doc(db, 'couples', c.id), { plus: { until: until.getTime(), by: 'hediye' } });
      await load();
    } catch {
      alert('Plus verilemedi. Firestore kuralları güncel mi?');
    } finally {
      setBusy('');
    }
  }
  async function take(c: CoupleRow) {
    setBusy(c.id);
    try {
      await updateDoc(doc(db, 'couples', c.id), { plus: deleteField() });
      await load();
    } finally {
      setBusy('');
    }
  }

  if (list === null) return <p className="muted">Çiftler yükleniyor…</p>;
  const shown = list.filter((c) => name(c).toLocaleLowerCase('tr').includes(q.trim().toLocaleLowerCase('tr')));
  return (
    <>
      <div>
        <h1>Çiftler ve Plus</h1>
        <p className="muted">
          {list.length} çift. Buradan seçtiğiniz çifte ücretsiz Plus verirsiniz; çift uygulamada “2miz ikinize hediye etti” olarak görür.
          Mesajlar ve fotoğraflar panelde görünmez.
        </p>
      </div>
      <input placeholder="Ada göre ara" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Çift</th>
              <th>Eşleşme</th>
              <th>Seri</th>
              <th>Son tam gün</th>
              <th>Plus</th>
              <th>Plus ver</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 200).map((c) => {
              const active = !!c.plus && c.plus.until > now;
              const bought = active && c.plus!.by !== 'hediye';
              return (
                <tr key={c.id}>
                  <td>{name(c)}</td>
                  <td>{ts(c.createdAt)}</td>
                  <td>{c.streak ?? 0}</td>
                  <td>{c.lastCompleteDay ?? '—'}</td>
                  <td>
                    {active ? (
                      <span className="badge" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
                        {`${bought ? 'Satın aldı' : 'Hediye'} · ${day(c.plus!.until)}`}
                      </span>
                    ) : (
                      <span className="muted">Yok</span>
                    )}
                  </td>
                  <td>
                    {bought ? (
                      <span className="muted small">Mağaza aboneliği var</span>
                    ) : (
                      <div className="row">
                        {[1, 3, 12].map((m) => (
                          <button key={m} disabled={busy === c.id} onClick={() => give(c, m)}>
                            {m === 12 ? '+1 yıl' : `+${m} ay`}
                          </button>
                        ))}
                        {active && (
                          <button className="ghost" disabled={busy === c.id} onClick={() => take(c)}>
                            Kaldır
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length > 200 && <p className="muted small">İlk 200 sonuç gösteriliyor; aramayı daraltın.</p>}
      </div>
    </>
  );
}

// ---------- Geri bildirim ----------
export type Feedback = {
  id: string;
  name?: string;
  kind: 'hata' | 'eksik' | 'oneri' | 'olay';
  text: string;
  device?: string;
  version?: string;
  status?: 'yeni' | 'yapildi';
  createdAt?: Timestamp | null;
};
const KIND: Record<string, string> = { hata: 'Hata', eksik: 'Eksik', oneri: 'Öneri' };

export function FeedbackList({ list }: { list: Feedback[] | null }) {
  const [all, setAll] = useState(false);
  if (list === null) return <p className="muted">Yükleniyor…</p>;
  const real = list.filter((f) => f.kind !== 'olay');
  const shown = all ? real : real.filter((f) => f.status !== 'yapildi');
  const set = (f: Feedback, status: 'yeni' | 'yapildi') =>
    updateDoc(doc(db, 'feedback', f.id), { status }).catch(() => alert('Kaydedilemedi.'));
  return (
    <>
      <div className="spread">
        <div>
          <h1>Geri bildirim</h1>
          <p className="muted">Kullanıcıların uygulamadan gönderdiği hata, eksik ve öneriler.</p>
        </div>
        <div className="chips">
          <button className={`chip${!all ? ' on' : ''}`} onClick={() => setAll(false)}>
            Bekleyenler
          </button>
          <button className={`chip${all ? ' on' : ''}`} onClick={() => setAll(true)}>
            Hepsi ({real.length})
          </button>
        </div>
      </div>
      <div className="stack">
        {shown.length ? (
          shown.map((f) => (
            <div key={f.id} className="card stack">
              <div className="spread">
                <span>
                  <b>{KIND[f.kind] ?? f.kind}</b> · {f.name || 'Adsız'} · <span className="muted">{ts(f.createdAt)}</span>
                </span>
                {f.status === 'yapildi' ? (
                  <button className="ghost" onClick={() => set(f, 'yeni')}>
                    Geri al
                  </button>
                ) : (
                  <button onClick={() => set(f, 'yapildi')}>Yapıldı</button>
                )}
              </div>
              <p className="pre">{f.text}</p>
              <p className="muted small">{[f.device, f.version && `sürüm ${f.version}`].filter(Boolean).join(' · ')}</p>
            </div>
          ))
        ) : (
          <p className="muted">Bekleyen bildirim yok.</p>
        )}
      </div>
    </>
  );
}

// ---------- Şikayetler ----------
export type Report = {
  id: string;
  coupleId?: string;
  reason?: string;
  text?: string;
  hasPhoto?: boolean;
  status?: 'incelendi';
  createdAt?: Timestamp | null;
};

export function Reports({ list }: { list: Report[] | null }) {
  if (list === null) return <p className="muted">Yükleniyor…</p>;
  const done = (r: Report) => updateDoc(doc(db, 'reports', r.id), { status: 'incelendi' }).catch(() => alert('Kaydedilemedi.'));
  return (
    <>
      <div>
        <h1>Şikayetler</h1>
        <p className="muted">
          Bir kullanıcının partnerinden gelen mesajı şikayet ettiği kayıtlar. Yalnızca şikayet edilen mesajın metni görünür; sohbetin geri
          kalanı görünmez.
        </p>
      </div>
      <div className="stack">
        {list.length ? (
          list.map((r) => (
            <div key={r.id} className="card stack" style={{ opacity: r.status === 'incelendi' ? 0.6 : 1 }}>
              <div className="spread">
                <span>
                  <b>{r.reason || 'Sebep belirtilmedi'}</b> · <span className="muted">{ts(r.createdAt)}</span>
                </span>
                {r.status === 'incelendi' ? (
                  <span className="muted small">İncelendi</span>
                ) : (
                  <button onClick={() => done(r)}>İncelendi</button>
                )}
              </div>
              <p className="pre">{r.text || (r.hasPhoto ? '(fotoğraflı mesaj; metin yok)' : '(metin yok)')}</p>
              <p className="muted small">Çift: {r.coupleId}</p>
            </div>
          ))
        ) : (
          <p className="muted">Şikayet yok.</p>
        )}
      </div>
    </>
  );
}

// ---------- Fiyatlar ----------
export function Prices({ cfg }: { cfg: AlbumConfig | null | undefined }) {
  const [p21, setP21] = useState('');
  const [pA4, setPA4] = useState('');
  const [ship, setShip] = useState('');
  const [pct, setPct] = useState('15');
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const costs = useCosts();
  const [c21, setC21] = useState('');
  const [cA4, setCA4] = useState('');
  const [cShip, setCShip] = useState('');
  useEffect(() => {
    if (!costs) return;
    setC21(String(costs['21x21'] ?? ''));
    setCA4(String(costs.A4 ?? ''));
    setCShip(String(costs.shipping ?? ''));
  }, [costs]);
  useEffect(() => {
    if (cfg === undefined) return;
    setP21(cfg?.prices?.['21x21'] ? String(cfg.prices['21x21']) : '');
    setPA4(cfg?.prices?.A4 ? String(cfg.prices.A4) : '');
    setShip(cfg ? String(cfg.shipping ?? 0) : '');
    setPct(String(cfg?.plusPct ?? 15));
    setOpen(cfg?.open ?? false);
  }, [cfg]);
  if (cfg === undefined) return <p className="muted">Yükleniyor…</p>;

  const num = (s: string) => Math.round(Number(s.replace(',', '.')));
  async function save() {
    const a = num(p21);
    const b = num(pA4);
    const k = num(ship || '0');
    const d = num(pct || '0');
    if (!(a > 0) || !(b > 0)) return setMsg('İki boyut için de fiyat girin.');
    if (!(k >= 0) || !(d >= 0 && d <= 90)) return setMsg('Kargo 0 ya da üstü, indirim %0–90 arasında olmalı.');
    setBusy(true);
    try {
      await saveAlbumConfig({ prices: { '21x21': a, A4: b }, shipping: k, plusPct: d, open });
      if (c21 || cA4 || cShip) await saveCosts({ '21x21': num(c21 || '0'), A4: num(cA4 || '0'), shipping: num(cShip || '0') });
      setMsg('Kaydedildi.');
    } catch {
      setMsg('Kaydedilemedi. Firestore kuralları güncel mi?');
    } finally {
      setBusy(false);
    }
  }
  const example = num(p21) > 0 ? num(p21) - Math.round((num(p21) * num(pct || '0')) / 100) + num(ship || '0') : 0;
  return (
    <>
      <div>
        <h1>Fiyatlar</h1>
        <p className="muted">Baskı albüm fiyatları. Değişiklik yeni siparişlerde geçerli olur; verilmiş siparişlerin tutarı değişmez.</p>
      </div>
      <div className="card stack" style={{ maxWidth: 560 }}>
        <div className="form">
          <label>
            21×21 cm albüm (TL)
            <input inputMode="numeric" value={p21} onChange={(e) => setP21(e.target.value)} />
          </label>
          <label>
            A4 albüm (TL)
            <input inputMode="numeric" value={pA4} onChange={(e) => setPA4(e.target.value)} />
          </label>
          <label>
            Kargo (TL)
            <input inputMode="numeric" value={ship} onChange={(e) => setShip(e.target.value)} />
          </label>
          <label>
            Plus indirimi (%)
            <input inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} />
          </label>
        </div>
        <p className="muted small">
          Bize maliyeti (isteğe bağlı): yalnızca Gelir bölümündeki kâr hesabında kullanılır, kullanıcılar göremez.
        </p>
        <div className="form">
          <label>
            21×21 baskı maliyeti (TL)
            <input inputMode="numeric" value={c21} onChange={(e) => setC21(e.target.value)} />
          </label>
          <label>
            A4 baskı maliyeti (TL)
            <input inputMode="numeric" value={cA4} onChange={(e) => setCA4(e.target.value)} />
          </label>
          <label>
            Kargo maliyeti (TL)
            <input inputMode="numeric" value={cShip} onChange={(e) => setCShip(e.target.value)} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          Sipariş alınsın (kapalıyken çiftler yalnızca baskı talebi bırakabilir)
        </label>
        {example > 0 && <p className="muted small">Örnek: Plus’lı çift 21×21 albüme kargo dahil {tl(example)} öder.</p>}
        {msg && <p className={msg === 'Kaydedildi.' ? 'ok' : 'error'}>{msg}</p>}
        <div>
          <button className="primary" disabled={busy} onClick={save}>
            Fiyatları kaydet
          </button>
        </div>
      </div>
    </>
  );
}

// ---------- Yöneticiler ----------
export function Admins({ me }: { me: string }) {
  const [list, setList] = useState<{ email: string; addedBy?: string; atMs?: number }[] | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'admins'),
        // '_' ile başlayan belgeler yönetici değil, yönetim ayarıdır (ör. maliyetler)
        (s) =>
          setList(
            s.docs.filter((d) => !d.id.startsWith('_')).map((d) => ({ email: d.id, ...(d.data() as { addedBy?: string; atMs?: number }) })),
          ),
        () => setList([]),
      ),
    [],
  );
  async function add() {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setMsg('Geçerli bir e-posta yaz.');
    try {
      await setDoc(doc(db, 'admins', e), { addedBy: me, atMs: Date.now() });
      setEmail('');
      setMsg('');
    } catch {
      setMsg('Eklenemedi. Firestore kuralları güncel mi?');
    }
  }
  if (list === null) return <p className="muted">Yükleniyor…</p>;
  return (
    <>
      <div>
        <h1>Yöneticiler</h1>
        <p className="muted">
          Bu panele girebilen hesaplar. Eklenen kişi uygulamadaki hesabının e-postası ve şifresiyle girer; ilk girişte e-postasını
          doğrulaması istenir. Kurucu çiftin iki hesabı her zaman yöneticidir ve bu listeden çıkarılamaz.
        </p>
      </div>
      <div className="card stack" style={{ maxWidth: 560 }}>
        <div className="row">
          <input
            style={{ flex: 1, minWidth: 220 }}
            type="email"
            placeholder="yonetici@ornek.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="primary" onClick={add}>
            Yönetici ekle
          </button>
        </div>
        {msg && <p className="error">{msg}</p>}
        {list.length ? (
          list.map((a) => (
            <div key={a.email} className="spread">
              <span>
                {a.email} <span className="muted small">{a.atMs ? `· ${day(a.atMs)}` : ''}</span>
              </span>
              <button className="ghost" onClick={() => deleteDoc(doc(db, 'admins', a.email)).catch(() => alert('Çıkarılamadı.'))}>
                Çıkar
              </button>
            </div>
          ))
        ) : (
          <p className="muted">Eklenmiş yönetici yok; şu an yalnızca kurucu çift girebilir.</p>
        )}
      </div>
    </>
  );
}
