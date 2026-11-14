import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { AUDIENCE_OPTIONS } from '../../src/lib/gender';
import {
  CATS,
  loadSecret,
  loadStats,
  PERIODS,
  removePartner,
  savePartner,
  stampCode,
  stampLink,
  type Partner,
  type PartnerCat,
  type Period,
  type Stats,
} from '../../src/lib/perks';

// Mekanlar: ekleme, düzenleme, kapatma; kasa kartı ve mekan başına gelen çift sayıları.
export function Partners({ partners }: { partners: Partner[] | null }) {
  const [edit, setEdit] = useState<Partner | 'new' | null>(null);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const ids = (partners ?? []).map((p) => p.id).join(',');
  useEffect(() => {
    if (!ids) return;
    ids.split(',').forEach((id) =>
      loadStats(id)
        .then((s) => setStats((m) => ({ ...m, [id]: s })))
        .catch(() => {}),
    );
  }, [ids]);

  if (partners === null) return <p className="muted">Mekanlar yükleniyor…</p>;
  if (edit) return <Form partner={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />;
  return (
    <>
      <div className="spread">
        <div>
          <h1>Mekanlar</h1>
          <p className="muted">Açık mekanlar uygulamadaki Avantajlar listesinde bütün çiftlere görünür.</p>
        </div>
        <button className="primary" onClick={() => setEdit('new')}>
          Mekan ekle
        </button>
      </div>
      <div className="card scroll">
        {partners.length ? (
          <table>
            <thead>
              <tr>
                <th>Mekan</th>
                <th>Tür</th>
                <th>Teklif</th>
                <th>Gelen çift</th>
                <th>Yeni çift</th>
                <th>Kullanım</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => {
                const s = stats[p.id];
                return (
                  <tr key={p.id} className="click" onClick={() => setEdit(p)}>
                    <td>
                      <b>{p.name}</b>
                      <br />
                      <span className="muted small">{[p.area, p.city].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>{`${(CATS[p.cat] ?? CATS.diger).label} · ${p.type === 'stamp' ? 'Damga' : 'Kod'}`}</td>
                    <td>{p.offer}</td>
                    <td>{s ? s.couples : '…'}</td>
                    <td>{s ? s.fresh : '…'}</td>
                    <td>{s ? s.uses : '…'}</td>
                    <td>{p.active ? <span className="ok">Açık</span> : <span className="muted">Kapalı</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Henüz mekan yok. İlk mekanı “Mekan ekle” ile ekleyin.</p>
        )}
      </div>
      <p className="muted small">
        Gelen çift: mekanda en az bir damga ya da kod alan çift. Yeni çift: bunlardan, ilk kullanımda eşleşmesi 30 günden yeni olanlar.
      </p>
    </>
  );
}

function Form({ partner, onClose }: { partner: Partner | null; onClose: () => void }) {
  const [name, setName] = useState(partner?.name ?? '');
  const [cat, setCat] = useState<PartnerCat>(partner?.cat ?? 'kafe');
  const [city, setCity] = useState(partner?.city ?? 'Antalya');
  const [area, setArea] = useState(partner?.area ?? '');
  const [type, setType] = useState<'stamp' | 'code'>(partner?.type ?? 'stamp');
  const [offer, setOffer] = useState(partner?.offer ?? '');
  const [goal, setGoal] = useState(String(partner?.goal ?? 5));
  const [welcome, setWelcome] = useState(partner?.welcome ?? true);
  const [period, setPeriod] = useState<Period>(partner?.period ?? 'month');
  const [ttl, setTtl] = useState(String(partner?.ttlMin ?? 15));
  const [note, setNote] = useState(partner?.note ?? '');
  const [audience, setAudience] = useState<'f' | 'm' | ''>(partner?.audience ?? '');
  const [active, setActive] = useState(partner?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [sure, setSure] = useState(false);

  useEffect(() => {
    if (partner?.type === 'stamp')
      loadSecret(partner.id)
        .then((s) => setKey(s?.key ?? null))
        .catch(() => {});
  }, [partner]);

  async function save() {
    if (busy) return;
    const g = Math.round(Number(goal));
    const m = Math.round(Number(ttl));
    if (!name.trim() || !offer.trim() || !city.trim()) return setError('Mekan adı, şehir ve teklif boş olamaz.');
    if (type === 'stamp' && !(g >= 2 && g <= 12)) return setError('Damga sayısı 2 ile 12 arasında olmalı.');
    if (type === 'code' && !(m >= 1 && m <= 120)) return setError('Kod süresi 1 ile 120 dakika arasında olmalı.');
    setBusy(true);
    setError('');
    try {
      await savePartner(
        partner?.id ?? null,
        {
          name: name.trim(),
          cat,
          city: city.trim(),
          area: area.trim(),
          type,
          offer: offer.trim(),
          ...(type === 'stamp' ? { goal: g, welcome } : { period, ttlMin: m }),
          note: note.trim(),
          audience,
          active,
        },
        true, // basılı kart: kasa kodu sabit
      );
      onClose();
    } catch {
      setError('Kaydedilemedi. Firestore kuralları güncel mi?');
      setBusy(false);
    }
  }
  async function remove() {
    if (!partner || busy) return;
    if (!sure) return setSure(true);
    setBusy(true);
    try {
      await removePartner(partner.id);
      onClose();
    } catch {
      setError('Silinemedi.');
      setBusy(false);
    }
  }

  const code = key ? stampCode(key, true) : null;
  const qr = useMemo(() => {
    if (!partner || !code) return '';
    const q = qrcode(0, 'M');
    q.addData(stampLink(partner.id, code));
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
  }, [partner, code]);

  return (
    <>
      <div className="spread">
        <h1>{partner ? 'Mekanı düzenle' : 'Yeni mekan'}</h1>
        <button onClick={onClose}>Listeye dön</button>
      </div>
      <div className="card stack">
        <div className="form">
          <label>
            Mekan adı
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <label>
            Tür
            <select value={cat} onChange={(e) => setCat(e.target.value as PartnerCat)}>
              {(Object.keys(CATS) as PartnerCat[]).map((c) => (
                <option key={c} value={c}>
                  {CATS[c].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Şehir
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={30} />
          </label>
          <label>
            Semt
            <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={30} placeholder="Konyaaltı" />
          </label>
        </div>

        <div>
          <p className="muted small">Avantaj türü</p>
          {partner ? (
            <p>
              {type === 'stamp' ? 'Damga kartı' : 'İndirim kodu'}{' '}
              <span className="muted small">(sonradan değişmez; kartlar karışmasın)</span>
            </p>
          ) : (
            <div className="chips">
              <button className={`chip${type === 'stamp' ? ' on' : ''}`} onClick={() => setType('stamp')}>
                Damga kartı
              </button>
              <button className={`chip${type === 'code' ? ' on' : ''}`} onClick={() => setType('code')}>
                İndirim kodu
              </button>
            </div>
          )}
        </div>

        <div className="form">
          <label>
            Teklif (listede görünen cümle)
            <input
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              maxLength={60}
              placeholder={type === 'stamp' ? '5 kahve al, 6. hediye' : 'İki bilete %25 indirim'}
            />
          </label>
          {type === 'stamp' ? (
            <label>
              Kaç damgada ödül
              <input inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={2} />
            </label>
          ) : (
            <>
              <label>
                Bir çift ne sıklıkla kod alabilir
                <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                  {(Object.keys(PERIODS) as Period[]).map((p) => (
                    <option key={p} value={p}>
                      {PERIODS[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kod kaç dakika geçerli
                <input inputMode="numeric" value={ttl} onChange={(e) => setTtl(e.target.value)} maxLength={3} />
              </label>
            </>
          )}
          <label>
            Kime uygun (herkese görünür; uygun kişide üstte çıkar)
            <select value={audience} onChange={(e) => setAudience(e.target.value as 'f' | 'm' | '')}>
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.id || 'all'} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Koşullar (isteğe bağlı)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Hafta içi geçerlidir" />
          </label>
        </div>

        {type === 'stamp' && (
          <label className="check">
            <input type="checkbox" checked={welcome} onChange={(e) => setWelcome(e.target.checked)} />
            İlk damga bizden (ilk okutmada iki damga işlenir)
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Listede görünsün (kapatınca çiftlerin damgaları silinmez)
        </label>

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="primary" disabled={busy} onClick={save}>
            Kaydet
          </button>
          {partner && (
            <button disabled={busy} onClick={remove}>
              {sure ? 'Emin misin? Mekanı kalıcı olarak sil' : 'Mekanı sil'}
            </button>
          )}
        </div>
      </div>

      {partner?.type === 'stamp' && (
        <div className="card">
          <h2>Kasa kartı</h2>
          {code ? (
            <div className="kasa">
              <div className="brand">2miz</div>
              <p>
                <b>{partner.name}</b> · {partner.offer}
              </p>
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="code">{code.toUpperCase()}</p>
              <p className="muted small">2miz uygulamasında Avantajlar → {partner.name} → “Kasadaki kodu okut”</p>
              <button className="noprint" onClick={() => window.print()}>
                Kartı yazdır
              </button>
            </div>
          ) : (
            <p className="muted">Kasa kodu yükleniyor…</p>
          )}
        </div>
      )}
    </>
  );
}
