import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { useAlbumConfig, useAllOrders } from '../../src/lib/orders';
import { usePartners } from '../../src/lib/perks';
import { auth, db } from './firebase';
import { Admins, Couples, FeedbackList, Prices, Reports, type Feedback, type Report } from './manage';
import { Orders } from './orders';
import { Overview } from './overview';
import { Partners } from './partners';

type Tab = 'genel' | 'siparis' | 'mekan' | 'cift' | 'bildirim' | 'sikayet' | 'fiyat' | 'yonetici';
const TABS: { id: Tab; label: string }[] = [
  { id: 'genel', label: 'Genel bakış' },
  { id: 'siparis', label: 'Siparişler' },
  { id: 'mekan', label: 'Mekanlar' },
  { id: 'cift', label: 'Çiftler ve Plus' },
  { id: 'bildirim', label: 'Geri bildirim' },
  { id: 'sikayet', label: 'Şikayetler' },
  { id: 'fiyat', label: 'Fiyatlar' },
  { id: 'yonetici', label: 'Yöneticiler' },
];

function useList<T>(name: string, enabled: boolean): T[] | null {
  const [list, setList] = useState<T[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, name), orderBy('createdAt', 'desc'), limit(300)),
      (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }) as T)),
      () => setList([]),
    );
  }, [name, enabled]);
  return list;
}

function Root() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    setAdmin(null);
    if (!user) return;
    // Yöneticiler listesini yalnızca yöneticiler okuyabilir; okuma geçerse yetki vardır.
    getDoc(doc(db, 'admins', user.email ?? '-'))
      .then(() => setAdmin(true))
      .catch(() => setAdmin(false));
  }, [user]);

  if (user === undefined) return <p className="boot">Yükleniyor…</p>;
  if (!user) return <Login />;
  if (admin === null) return <p className="boot">Yetki kontrol ediliyor…</p>;
  if (!admin) return <NoAccess user={user} />;
  return <Panel user={user} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setMsg('Giriş yapılamadı. E-posta ya da şifre hatalı.');
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!email.trim()) return setMsg('Önce e-posta adresini yaz.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg('Şifre yenileme bağlantısı e-postana gönderildi.');
    } catch {
      setMsg('Bağlantı gönderilemedi; adresi kontrol et.');
    }
  }
  return (
    <form className="login card" onSubmit={submit}>
      <div className="brand">2miz Yönetim</div>
      <p className="muted small">Uygulamadaki yönetici hesabının e-postası ve şifresiyle gir.</p>
      <label>
        E-posta
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Şifre
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {msg && <p className="error">{msg}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Giriliyor…' : 'Giriş yap'}
      </button>
      <button type="button" className="ghost" onClick={reset}>
        Şifremi unuttum
      </button>
    </form>
  );
}

function NoAccess({ user }: { user: User }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="login card">
      <div className="brand">2miz Yönetim</div>
      <p>
        <b>{user.email}</b> hesabının yönetim yetkisi yok.
      </p>
      {!user.emailVerified && (
        <>
          <p className="muted small">
            Yönetici olarak eklendiysen önce e-postanı doğrulaman gerekiyor. Doğruladıktan sonra çıkış yapıp yeniden gir.
          </p>
          <button
            disabled={sent}
            onClick={() =>
              sendEmailVerification(user)
                .then(() => setSent(true))
                .catch(() => {})
            }
          >
            {sent ? 'Doğrulama e-postası gönderildi' : 'Doğrulama e-postası gönder'}
          </button>
        </>
      )}
      <button onClick={() => signOut(auth)}>Çıkış yap</button>
    </div>
  );
}

function Panel({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>('genel');
  const orders = useAllOrders(true);
  const partners = usePartners();
  const cfg = useAlbumConfig();
  const feedback = useList<Feedback>('feedback', true);
  const reports = useList<Report>('reports', true);

  const openOrders = (orders ?? []).filter((o) => o.status === 'odeme' || o.status === 'odendi' || o.status === 'baski').length;
  const newFeedback = (feedback ?? []).filter((f) => f.status !== 'yapildi' && f.kind !== 'olay').length;
  const newReports = (reports ?? []).filter((r) => r.status !== 'incelendi').length;
  const counts: Partial<Record<Tab, number>> = { siparis: openOrders, bildirim: newFeedback, sikayet: newReports };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">2miz Yönetim</div>
        {TABS.map((t) => (
          <button key={t.id} className={`nav${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {!!counts[t.id] && <span className="count">{counts[t.id]}</span>}
          </button>
        ))}
        <div className="foot">
          {user.email}
          <br />
          <button className="ghost" style={{ paddingLeft: 0 }} onClick={() => signOut(auth)}>
            Çıkış yap
          </button>
        </div>
      </aside>
      <main className="main">
        {tab === 'genel' && (
          <Overview orders={orders} partners={partners} feedback={feedback} reports={reports} go={(t) => setTab(t as Tab)} />
        )}
        {tab === 'siparis' && <Orders orders={orders} />}
        {tab === 'mekan' && <Partners partners={partners} />}
        {tab === 'cift' && <Couples />}
        {tab === 'bildirim' && <FeedbackList list={feedback} />}
        {tab === 'sikayet' && <Reports list={reports} />}
        {tab === 'fiyat' && <Prices cfg={cfg} />}
        {tab === 'yonetici' && <Admins me={user.email ?? ''} />}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
