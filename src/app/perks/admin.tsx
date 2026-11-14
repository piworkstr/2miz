import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { QR } from '../../components/QR';
import { Button, Card, ErrorText, Input, Loading, Muted, Screen, T, Title } from '../../components/ui';
import {
  CATS,
  isFounder,
  loadSecret,
  loadStats,
  PERIODS,
  removePartner,
  savePartner,
  stampCode,
  stampLink,
  usePartners,
  type Partner,
  type PartnerCat,
  type Period,
  type Stats,
} from '../../lib/perks';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

// Mekan yönetimi (yalnızca kurucu çift): mekan ekle, teklifi değiştir, kapat; kasa kartının karekodu ve mekanın getirdiği çift sayısı.
export default function PerksAdmin() {
  const t = useTheme();
  const { couple } = useSession();
  const partners = usePartners();
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

  if (!couple || partners === null) return <Loading />;
  if (!isFounder(couple))
    return (
      <Screen>
        <Muted>Bu ekran yalnızca yöneticiler içindir.</Muted>
      </Screen>
    );

  if (edit) return <Form partner={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Avantajlar')}
        </Text>
      </Pressable>
      <Title>Mekanlar</Title>
      <Muted>Buradaki mekanlar herkese açık Avantajlar listesinde görünür. Kapalı olanlar listede çıkmaz.</Muted>
      <Button label="Mekan ekle" onPress={() => setEdit('new')} />
      {partners.map((p) => {
        const s = stats[p.id];
        const cat = CATS[p.cat] ?? CATS.diger;
        return (
          <Pressable key={p.id} onPress={() => setEdit(p)}>
            <Card style={{ gap: 6, opacity: p.active ? 1 : 0.55 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={cat.icon} size={20} color={cat.color} />
                <T style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>{p.name}</T>
                <Muted>{p.active ? (p.type === 'stamp' ? 'Damga' : 'Kod') : 'Kapalı'}</Muted>
              </View>
              <Muted>{p.offer}</Muted>
              <Muted style={{ fontSize: 12 }}>
                {s ? `${s.couples} çift geldi · ${s.fresh} yeni çift · ${s.uses} kullanım` : 'Sayılar yükleniyor…'}
              </Muted>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function Chips<V extends string>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: on ? t.colors.primary : t.colors.border,
              backgroundColor: on ? t.colors.primarySoft : t.colors.card,
            }}
          >
            <Text
              maxFontSizeMultiplier={1.2}
              style={{ color: on ? t.colors.onPrimarySoft : t.colors.text, fontWeight: on ? '700' : '400' }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Form({ partner, onClose }: { partner: Partner | null; onClose: () => void }) {
  const t = useTheme();
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
          active,
        },
        true, // basılı kart: kasa kodu sabit
      );
      onClose();
    } catch {
      setError('Kaydedilemedi. Firestore kuralları yayınlandı mı?');
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
  const label = (s: string) => <T style={{ fontWeight: '600', marginTop: 4 }}>{s}</T>;

  return (
    <Screen>
      <Pressable onPress={onClose} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Mekanlar')}
        </Text>
      </Pressable>
      <Title>{partner ? 'Mekanı düzenle' : 'Yeni mekan'}</Title>

      {label('Mekan adı')}
      <Input value={name} onChangeText={setName} placeholder="Mekanın adı" maxLength={40} />
      {label('Tür')}
      <Chips value={cat} options={(Object.keys(CATS) as PartnerCat[]).map((c) => [c, CATS[c].label])} onChange={setCat} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, gap: 6 }}>
          {label('Şehir')}
          <Input value={city} onChangeText={setCity} maxLength={30} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {label('Semt')}
          <Input value={area} onChangeText={setArea} placeholder="Konyaaltı" maxLength={30} />
        </View>
      </View>

      {label('Avantaj türü')}
      {partner ? (
        <Muted>{type === 'stamp' ? 'Damga kartı' : 'İndirim kodu'} (sonradan değişmez; kartlar karışmasın)</Muted>
      ) : (
        <Chips
          value={type}
          options={[
            ['stamp', 'Damga kartı'],
            ['code', 'İndirim kodu'],
          ]}
          onChange={setType}
        />
      )}
      {label('Teklif (listede görünen cümle)')}
      <Input
        value={offer}
        onChangeText={setOffer}
        placeholder={type === 'stamp' ? '5 kahve al, 6. hediye' : 'İki bilete %25 indirim'}
        maxLength={60}
      />

      {type === 'stamp' ? (
        <>
          {label('Kaç damgada ödül')}
          <Input value={goal} onChangeText={setGoal} keyboardType="number-pad" maxLength={2} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '600' }}>İlk damga bizden</T>
              <Muted>İlk okutmada iki damga işlenir; yeni çifti karta başlatır.</Muted>
            </View>
            <Switch value={welcome} onValueChange={setWelcome} />
          </View>
        </>
      ) : (
        <>
          {label('Bir çift ne sıklıkla kod alabilir')}
          <Chips value={period} options={(Object.keys(PERIODS) as Period[]).map((p) => [p, PERIODS[p]])} onChange={setPeriod} />
          {label('Kod kaç dakika geçerli')}
          <Input value={ttl} onChangeText={setTtl} keyboardType="number-pad" maxLength={3} />
        </>
      )}

      {label('Koşullar (isteğe bağlı)')}
      <Input value={note} onChangeText={setNote} placeholder="Hafta içi geçerlidir" maxLength={120} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>Listede görünsün</T>
          <Muted>Kapatınca mekan listeden kalkar; çiftlerin damgaları silinmez.</Muted>
        </View>
        <Switch value={active} onValueChange={setActive} />
      </View>

      <ErrorText>{error}</ErrorText>
      <Button label="Kaydet" onPress={save} busy={busy} />

      {partner?.type === 'stamp' && (
        <Card style={{ alignItems: 'center', gap: 10 }}>
          <T style={{ fontWeight: '700' }}>Kasa kartı</T>
          {code ? (
            <>
              <QR value={stampLink(partner.id, code)} size={220} />
              <Text
                maxFontSizeMultiplier={1.1}
                selectable
                style={{ fontSize: 24, fontWeight: '800', letterSpacing: 4, color: t.colors.text }}
              >
                {code.toUpperCase()}
              </Text>
              <Muted style={{ textAlign: 'center' }}>
                Bu karekod ve altındaki kod mekanın kasasında duracak karta basılır. Çift karekodu okutur ya da kodu elle girer; günde bir
                damga işlenir.
              </Muted>
            </>
          ) : (
            <Muted>Kasa kodu yükleniyor…</Muted>
          )}
        </Card>
      )}

      {partner && <Button label={sure ? 'Emin misin? Mekanı kalıcı olarak sil' : 'Mekanı sil'} variant="secondary" onPress={remove} />}
    </Screen>
  );
}
