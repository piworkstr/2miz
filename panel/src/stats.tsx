import { collection, doc, getDocs, limit, onSnapshot, query, setDoc, type Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey } from '../../src/lib/date';
import { tl, type Order } from '../../src/lib/orders';
import { FEATURES, type Feature, type Usage } from '../../src/lib/usage';
import { db } from './firebase';

type CoupleRow = {
  id: string;
  members: string[];
  createdAt?: Timestamp;
  activity?: Record<string, Record<string, number>>;
  use?: Usage;
  os?: Record<string, { p: string; v: string }>;
  plus?: { until: number; by: string };
};

function useCouples(): CoupleRow[] | null {
  const [list, setList] = useState<CoupleRow[] | null>(null);
  useEffect(() => {
    getDocs(query(collection(db, 'couples'), limit(5000)))
      .then((s) => setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CoupleRow, 'id'>) }))))
      .catch(() => setList([]));
  }, []);
  return list;
}

const keyAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};
const pct = (a: number, b: number) => (b ? `%${Math.round((a / b) * 100)}` : '—');

// Basit çubuk grafik: kütüphane gerektirmez.
function Bars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
      {data.map((d, i) => (
        <div
          key={i}
          title={`${d.label}: ${d.value}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}
        >
          <div style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, background: color, borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

// ---------- İstatistik ----------
export function Stats() {
  const couples = useCouples();
  if (couples === null) return <p className="muted">İstatistikler hesaplanıyor…</p>;
  const total = couples.length;
  const d7 = keyAgo(6);
  const d30 = keyAgo(29);
  const activeOn = (c: CoupleRow, day: string) => Object.values(c.activity?.[day] ?? {}).some((v) => v > 0);
  const days = Array.from({ length: 30 }, (_, i) => keyAgo(29 - i));
  const active30 = couples.filter((c) => days.some((d) => activeOn(c, d))).length;
  const active7 = couples.filter((c) => days.slice(-7).some((d) => activeOn(c, d))).length;
  const measured = couples.filter((c) => c.use && Object.keys(c.use).length).length;

  const rows = (Object.keys(FEATURES) as Feature[])
    .map((f) => {
      const used = couples.filter((c) => c.use?.[f]?.d);
      return {
        f,
        c7: used.filter((c) => (c.use![f]!.d ?? '') >= d7).length,
        c30: used.filter((c) => (c.use![f]!.d ?? '') >= d30).length,
        all: used.length,
        n: used.reduce((s, c) => s + (c.use![f]!.n ?? 0), 0),
      };
    })
    .sort((a, b) => b.c30 - a.c30 || b.n - a.n);

  // platform ve sürüm (kişi başına)
  const os: Record<string, number> = {};
  const ver: Record<string, number> = {};
  let people = 0;
  for (const c of couples)
    for (const m of c.members ?? []) {
      const o = c.os?.[m];
      if (!o) continue;
      people++;
      os[o.p] = (os[o.p] ?? 0) + 1;
      ver[o.v] = (ver[o.v] ?? 0) + 1;
    }
  const osName: Record<string, string> = { ios: 'iPhone', android: 'Android', web: 'Web' };

  // büyüme ve tutma
  const created = (c: CoupleRow) => c.createdAt?.toMillis?.() ?? 0;
  const newPerDay = days.map((d) => ({ label: d, value: couples.filter((c) => created(c) && dayKey(new Date(created(c))) === d).length }));
  const activePerDay = days.map((d) => ({ label: d, value: couples.filter((c) => activeOn(c, d)).length }));
  const retained = (n: number) => {
    const old = couples.filter((c) => created(c) && Date.now() - created(c) >= n * 86400_000);
    const kept = old.filter((c) => {
      const from = dayKey(new Date(created(c) + n * 86400_000));
      return Object.keys(c.activity ?? {}).some((d) => d >= from && activeOn(c, d));
    });
    return { old: old.length, kept: kept.length };
  };
  const r7 = retained(7);
  const r30 = retained(30);

  return (
    <>
      <div>
        <h1>İstatistik</h1>
        <p className="muted">
          Bölüm kullanımı ve platform, bu ölçümü içeren uygulama sürümünden itibaren birikir ({measured} / {total} çift ölçülüyor). Sayılar
          sayfa açıldığında hesaplanır.
        </p>
      </div>
      <div className="grid">
        <div className="card stat">
          <p className="muted small">Eşleşmiş çift</p>
          <p className="n">{total}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Son 7 günde aktif çift</p>
          <p className="n">{active7}</p>
          <p className="small muted">{pct(active7, total)}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Son 30 günde aktif çift</p>
          <p className="n">{active30}</p>
          <p className="small muted">{pct(active30, total)}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Tutma (7. gün / 30. gün)</p>
          <p className="n">{`${pct(r7.kept, r7.old)} / ${pct(r30.kept, r30.old)}`}</p>
          <p className="small muted">{`${r7.old} ve ${r30.old} çift üzerinden`}</p>
        </div>
      </div>

      <div className="card scroll">
        <h2>Hangi bölüm ne kadar kullanılıyor</h2>
        <table>
          <thead>
            <tr>
              <th>Bölüm</th>
              <th>Son 7 gün (çift)</th>
              <th>Son 30 gün (çift)</th>
              <th>Çiftlerin oranı</th>
              <th>Hiç kullanan (çift)</th>
              <th>Toplam kullanım</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f}>
                <td>{FEATURES[r.f]}</td>
                <td>{r.c7}</td>
                <td>{r.c30}</td>
                <td>{pct(r.c30, total)}</td>
                <td>{r.all}</td>
                <td>{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 8 }}>
          Sıralama son 30 günde kullanan çift sayısına göre. Çiftlikte toplam kullanım, kişi başına günde birkaç işlemle sınırlı sayılır;
          çift sayısı tamdır.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card">
          <h2>Günlük aktif çift (son 30 gün)</h2>
          <Bars data={activePerDay} color="#E8516A" />
          <p className="muted small">{`${days[0]} → ${days[29]} · bugün ${activePerDay[29].value}`}</p>
        </div>
        <div className="card">
          <h2>Günlük yeni çift (son 30 gün)</h2>
          <Bars data={newPerDay} color="#2E8B6A" />
          <p className="muted small">{`toplam ${newPerDay.reduce((s, d) => s + d.value, 0)} yeni çift`}</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card">
          <h2>Platform</h2>
          {people ? (
            <table>
              <tbody>
                {Object.entries(os)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <tr key={k}>
                      <td>{osName[k] ?? k}</td>
                      <td>{`${v} kişi`}</td>
                      <td>{pct(v, people)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Henüz ölçülen cihaz yok; kullanıcılar uygulamayı güncelleyince dolar.</p>
          )}
        </div>
        <div className="card">
          <h2>Uygulama sürümü</h2>
          {people ? (
            <table>
              <tbody>
                {Object.entries(ver)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{`${v} kişi`}</td>
                      <td>{pct(v, people)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Henüz ölçülen cihaz yok.</p>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Gelir ----------
export type Costs = { '21x21': number; A4: number; shipping: number };
// Maliyetler yalnızca yöneticilerin okuyabildiği koleksiyonda durur (fiyat ayarı herkese açık, maliyet değil).
export const costsRef = () => doc(db, 'admins', '_albumCosts');
export function useCosts(): Costs | null | undefined {
  const [c, setC] = useState<Costs | null | undefined>(undefined);
  useEffect(
    () =>
      onSnapshot(
        costsRef(),
        (s) => setC(s.exists() ? (s.data() as Costs) : null),
        () => setC(null),
      ),
    [],
  );
  return c;
}
export const saveCosts = (c: Costs) => setDoc(costsRef(), c);

const PAID = ['odendi', 'baski', 'kargo', 'teslim'];
const monthKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthName = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

export function Revenue({ orders }: { orders: Order[] | null }) {
  const costs = useCosts();
  const couples = useCouples();
  if (orders === null || costs === undefined) return <p className="muted">Gelir hesaplanıyor…</p>;
  const paid = orders.filter((o) => PAID.includes(o.status) && o.price);
  const waiting = orders.filter((o) => o.status === 'odeme' && o.price);
  const sum = (list: Order[], f: (o: Order) => number) => list.reduce((s, o) => s + f(o), 0);
  const costOf = (o: Order) => (costs ? (costs[o.size] ?? 0) + (costs.shipping ?? 0) : 0);
  const thisMonth = monthKey(Date.now());
  const inMonth = (k: string) => paid.filter((o) => monthKey(o.createdAtMs) === k);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return monthKey(d.getTime());
  });
  const revenue = (list: Order[]) => sum(list, (o) => o.price!.total);
  const profit = (list: Order[]) => revenue(list) - sum(list, costOf);
  const now = Date.now();
  const plus = (couples ?? []).filter((c) => c.plus && c.plus.until > now);
  const bought = plus.filter((c) => c.plus!.by !== 'hediye').length;

  return (
    <>
      <div>
        <h1>Gelir</h1>
        <p className="muted">
          Albüm geliri, ödemesi alınmış siparişlerden hesaplanır (ay, siparişin verildiği aya göre). Tutarlar KDV dahildir; ödeme komisyonu
          ve vergi ayrıca düşülmez.
        </p>
      </div>
      <div className="grid">
        <div className="card stat">
          <p className="muted small">Bu ay albüm cirosu</p>
          <p className="n">{tl(revenue(inMonth(thisMonth)))}</p>
          <p className="small muted">{`${inMonth(thisMonth).length} sipariş`}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Bu ay kalan (maliyet sonrası)</p>
          <p className="n">{costs ? tl(profit(inMonth(thisMonth))) : '—'}</p>
          <p className="small muted">{costs ? 'baskı ve kargo maliyeti düşüldü' : 'Fiyatlar bölümünde maliyet girilmedi'}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Toplam albüm cirosu</p>
          <p className="n">{tl(revenue(paid))}</p>
          <p className="small muted">{`${paid.length} sipariş · ortalama ${paid.length ? tl(revenue(paid) / paid.length) : '—'}`}</p>
        </div>
        <div className="card stat">
          <p className="muted small">Ödeme bekleyen</p>
          <p className="n">{tl(revenue(waiting))}</p>
          <p className="small muted">{`${waiting.length} sipariş`}</p>
        </div>
      </div>

      <div className="card scroll">
        <h2>Aylara göre albüm</h2>
        <table>
          <thead>
            <tr>
              <th>Ay</th>
              <th>Sipariş</th>
              <th>Ciro</th>
              <th>Plus indirimi</th>
              <th>Maliyet</th>
              <th>Kalan</th>
            </tr>
          </thead>
          <tbody>
            {months
              .slice()
              .reverse()
              .map((k) => {
                const list = inMonth(k);
                return (
                  <tr key={k}>
                    <td>{monthName(k)}</td>
                    <td>{list.length}</td>
                    <td>{tl(revenue(list))}</td>
                    <td>{tl(sum(list, (o) => o.price!.discount))}</td>
                    <td>{costs ? tl(sum(list, costOf)) : '—'}</td>
                    <td>{costs ? tl(profit(list)) : '—'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Bölümlere göre gelir</h2>
        <table>
          <tbody>
            <tr>
              <td>Baskı albüm</td>
              <td>{tl(revenue(paid))}</td>
              <td className="muted">toplam, ödemesi alınmış</td>
            </tr>
            <tr>
              <td>Plus aboneliği</td>
              <td>—</td>
              <td className="muted">{`mağaza satışı açılınca dolacak · şu an ${bought} satın alan, ${plus.length - bought} hediye Plus çift`}</td>
            </tr>
            <tr>
              <td>Mekanlar (Avantajlar)</td>
              <td>—</td>
              <td className="muted">gelir hedeflenmiyor; kullanım İstatistik bölümünde</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
