import { useEffect, useState } from 'react';
import {
  CITIES,
  EVENT_CATS,
  istToday,
  loadIndex,
  loadManual,
  newEventId,
  saveManual,
  type CityEvent,
  type EventCat,
  type EventIndex,
} from '../../src/lib/events';

const blank = (): CityEvent => ({ id: newEventId(), title: '', day: istToday(), cat: 'konser' });

// Şehir etkinlikleri: il seçilir, o ilin elle eklenen etkinlikleri düzenlenir.
// Otomatik çekilenler (bilet sağlayıcısı) burada görünmez; uygulamada elle eklenenlerin altında listelenir.
export function Events() {
  const [city, setCity] = useState('Antalya');
  const [items, setItems] = useState<CityEvent[] | null>(null);
  const [index, setIndex] = useState<EventIndex>({});
  const [edit, setEdit] = useState<CityEvent | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItems(null);
    setEdit(null);
    loadManual(city)
      .then(setItems)
      .catch(() => setItems([]));
  }, [city]);
  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch(() => {});
  }, []);

  async function save(next: CityEvent[]) {
    setBusy(true);
    setMsg('');
    try {
      setItems(await saveManual(city, next));
      setEdit(null);
      loadIndex()
        .then(setIndex)
        .catch(() => {});
    } catch {
      setMsg('Kaydedilemedi.');
    }
    setBusy(false);
  }

  const today = istToday();
  const withData = Object.values(index.cities ?? {})
    .filter((c) => (c.n ?? 0) + (c.auto ?? 0) > 0)
    .map((c) => `${c.name} (${c.n ?? 0} elle${c.auto ? `, ${c.auto} otomatik` : ''})`);

  return (
    <>
      <div className="spread">
        <div>
          <h1>Şehir etkinlikleri</h1>
          <p className="muted">
            Uygulamada "Şehrinizde bu ay" bölümünde, o ili seçen çiftlere görünür. Geçmiş etkinlikler listeden kendiliğinden düşer.
          </p>
        </div>
        <button className="primary" onClick={() => setEdit(blank())} disabled={!!edit}>
          Etkinlik ekle
        </button>
      </div>

      <div className="card stack">
        <div className="form">
          <label>
            İl
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">{withData.length ? `Etkinliği olan iller: ${withData.join(' · ')}` : 'Henüz hiçbir ilde etkinlik yok.'}</p>
      </div>

      {edit && (
        <Form
          value={edit}
          busy={busy}
          onCancel={() => setEdit(null)}
          onSave={(e) => save([...(items ?? []).filter((x) => x.id !== e.id), e])}
        />
      )}
      {!!msg && <p className="error">{msg}</p>}

      <div className="card scroll">
        {items === null ? (
          <p className="muted">Yükleniyor…</p>
        ) : items.length ? (
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Etkinlik</th>
                <th>Tür</th>
                <th>Mekan</th>
                <th>bir iz'e özel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} style={e.day < today ? { opacity: 0.45 } : undefined}>
                  <td>
                    {e.day}
                    {e.time ? ` ${e.time}` : ''}
                  </td>
                  <td>
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noreferrer">
                        {e.title}
                      </a>
                    ) : (
                      e.title
                    )}
                    {e.price ? <div className="muted">{e.price}</div> : null}
                  </td>
                  <td>{EVENT_CATS[e.cat]?.label ?? e.cat}</td>
                  <td>{e.venue ?? '—'}</td>
                  <td>{e.deal ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="ghost" onClick={() => setEdit(e)}>
                      Düzenle
                    </button>
                    <button className="ghost" disabled={busy} onClick={() => save(items.filter((x) => x.id !== e.id))}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">{city} için elle eklenmiş etkinlik yok.</p>
        )}
      </div>
    </>
  );
}

function Form({
  value,
  busy,
  onSave,
  onCancel,
}: {
  value: CityEvent;
  busy: boolean;
  onSave: (e: CityEvent) => void;
  onCancel: () => void;
}) {
  const [e, setE] = useState<CityEvent>(value);
  useEffect(() => setE(value), [value]);
  const set = (patch: Partial<CityEvent>) => setE((x) => ({ ...x, ...patch }));
  const urlOk = !e.url || /^https:\/\//i.test(e.url.trim());
  const ok = e.title.trim().length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(e.day) && urlOk;
  return (
    <div className="card stack">
      <div className="form">
        <label>
          Etkinlik adı
          <input value={e.title} onChange={(x) => set({ title: x.target.value })} maxLength={90} />
        </label>
        <label>
          Tür
          <select value={e.cat} onChange={(x) => set({ cat: x.target.value as EventCat })}>
            {(Object.keys(EVENT_CATS) as EventCat[]).map((c) => (
              <option key={c} value={c}>
                {EVENT_CATS[c].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tarih
          <input type="date" value={e.day} onChange={(x) => set({ day: x.target.value })} />
        </label>
        <label>
          Saat (isteğe bağlı)
          <input type="time" value={e.time ?? ''} onChange={(x) => set({ time: x.target.value || undefined })} />
        </label>
        <label>
          Mekan
          <input value={e.venue ?? ''} onChange={(x) => set({ venue: x.target.value })} maxLength={80} />
        </label>
        <label>
          Fiyat notu
          <input value={e.price ?? ''} onChange={(x) => set({ price: x.target.value })} maxLength={40} placeholder="450 TL'den başlar" />
        </label>
        <label>
          Bilet / ayrıntı bağlantısı (https://)
          <input value={e.url ?? ''} onChange={(x) => set({ url: x.target.value })} placeholder="https://" />
        </label>
        <label>
          bir iz çiftlerine özel (anlaşma varsa)
          <input
            value={e.deal ?? ''}
            onChange={(x) => set({ deal: x.target.value })}
            maxLength={80}
            placeholder="İkinci bilet %50 · Kod: BIRIZ"
          />
        </label>
      </div>
      {!urlOk && <p className="error">Bağlantı https:// ile başlamalı.</p>}
      <div className="row">
        <button className="primary" disabled={!ok || busy} onClick={() => onSave(e)}>
          {busy ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button onClick={onCancel}>Vazgeç</button>
      </div>
    </div>
  );
}
