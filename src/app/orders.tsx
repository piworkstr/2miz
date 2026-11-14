import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { Button, Card, ErrorText, Input, Loading, Muted, Screen, T, Title } from '../components/ui';
import { trDate } from '../lib/date';
import {
  NEXT,
  saveAlbumConfig,
  setOrderStatus,
  STATUS,
  STEPS,
  tl,
  useAlbumConfig,
  useAllOrders,
  useMyOrders,
  type AlbumConfig,
  type Order,
} from '../lib/orders';
import { isFounder } from '../lib/perks';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

const sizeLabel = (s: string) => (s === '21x21' ? '21×21 cm' : s);

// Albüm siparişleri: çift kendi siparişinin durumunu görür; kurucu çift bütün siparişleri yönetir ve fiyatları belirler.
export default function Orders() {
  const t = useTheme();
  const { couple } = useSession();
  const founder = isFounder(couple);
  const mine = useMyOrders(couple?.id);
  const all = useAllOrders(founder);
  const cfg = useAlbumConfig();
  if (!couple || mine === null || cfg === undefined || (founder && all === null)) return <Loading />;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Albüm')}
        </Text>
      </Pressable>
      <Title>Siparişler</Title>

      {founder ? (
        <>
          <PriceCard cfg={cfg} />
          <Muted>{`${(all ?? []).length} sipariş · en yeni üstte`}</Muted>
          {(all ?? []).map((o) => (
            <AdminOrder key={`${o.coupleId}/${o.id}`} o={o} />
          ))}
        </>
      ) : mine.length ? (
        mine.map((o) => <MyOrder key={o.id} o={o} />)
      ) : (
        <Muted>Henüz siparişiniz yok. Albüm sekmesinden albümünüzü hazırlayıp bastırabilirsiniz.</Muted>
      )}
    </Screen>
  );
}

function Badge({ o }: { o: Order }) {
  const s = STATUS[o.status] ?? STATUS.talep;
  return (
    <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 9, backgroundColor: s.soft }}>
      <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 12, fontWeight: '700', color: s.color }}>
        {s.label}
      </Text>
    </View>
  );
}

function MyOrder({ o }: { o: Order }) {
  const t = useTheme();
  const at = STEPS.findIndex((s) => s.id === o.status);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>{`${sizeLabel(o.size)} · ${o.pageCount} sayfa`}</T>
        {(o.status === 'talep' || o.status === 'iptal') && <Badge o={o} />}
      </View>
      <Muted>{`${trDate(new Date(o.createdAtMs), { year: true })}${o.price ? ` · ${tl(o.price.total)}` : ''}`}</Muted>
      {o.status === 'talep' ? (
        <Muted>Baskı talebiniz kayıtlı. Sipariş açıldığında albümü buradan bastırabilirsiniz.</Muted>
      ) : o.status === 'iptal' ? (
        <Muted>Bu sipariş iptal edildi.</Muted>
      ) : (
        <View style={{ gap: 10 }}>
          {STEPS.map((s, i) => {
            const done = i <= at;
            const now = i === at;
            return (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={done ? (now ? t.colors.primary : t.colors.success) : t.colors.muted}
                />
                <T style={{ color: done ? t.colors.text : t.colors.muted, fontWeight: now ? '700' : '400' }}>{s.label}</T>
              </View>
            );
          })}
        </View>
      )}
      {o.status === 'odeme' && <Muted>Ödeme için sizinle iletişime geçeceğiz. Ödeme alınınca albümünüz baskıya girer.</Muted>}
      {!!o.tracking && (
        <Text maxFontSizeMultiplier={1.25} selectable style={{ color: t.colors.text, fontFamily: t.fonts.body }}>
          {`Kargo takip no: ${o.tracking}`}
        </Text>
      )}
    </Card>
  );
}

function AdminOrder({ o }: { o: Order }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(o.tracking ?? '');
  const [sure, setSure] = useState(false);
  const next = NEXT[o.status];
  const needsTracking = next?.to === 'kargo';

  async function go(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>{o.names || 'Çift'}</T>
        <Badge o={o} />
      </View>
      <Muted>
        {`${sizeLabel(o.size)} · ${o.pageCount} sayfa${o.price ? ` · ${tl(o.price.total)}` : ''} · ${trDate(new Date(o.createdAtMs))}`}
      </Muted>
      {o.price && (
        <Muted style={{ fontSize: 12 }}>
          {`Albüm ${tl(o.price.album)}${o.price.discount ? ` − Plus ${tl(o.price.discount)}` : ''} + kargo ${tl(o.price.shipping)}`}
        </Muted>
      )}
      {o.ship && (
        <Text maxFontSizeMultiplier={1.25} selectable style={{ color: t.colors.text, fontFamily: t.fonts.body, lineHeight: 20 }}>
          {`${o.ship.name} · ${o.ship.phone}\n${o.ship.address}, ${o.ship.city}`}
        </Text>
      )}
      <Text maxFontSizeMultiplier={1.1} selectable style={{ color: t.colors.muted, fontSize: 11 }}>
        {`Baskı Merkezi: npm run siparis -- ${o.coupleId} ${o.id}`}
      </Text>
      {!!o.tracking && o.status !== 'baski' && <Muted>{`Takip no: ${o.tracking}`}</Muted>}
      {needsTracking && (
        <Input
          value={tracking}
          onChangeText={setTracking}
          placeholder="Kargo takip no (isteğe bağlı)"
          autoCapitalize="characters"
          maxLength={40}
        />
      )}
      {next && (
        <Button
          label={next.label}
          busy={busy}
          onPress={() => go(() => setOrderStatus(o, next.to, needsTracking ? tracking.trim() : undefined))}
          style={{ minHeight: 46 }}
        />
      )}
      {o.status !== 'iptal' && o.status !== 'teslim' && o.status !== 'talep' && (
        <Pressable
          onPress={() => (sure ? go(() => setOrderStatus(o, 'iptal')) : setSure(true))}
          style={{ alignSelf: 'center', padding: 4 }}
        >
          <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.muted, fontSize: 13 }}>
            {sure ? 'Emin misin? İptal etmek için tekrar dokun' : 'Siparişi iptal et'}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

// Fiyatlar: kurucu çift istediği an değiştirir. Verilmiş siparişlerin tutarı değişmez.
function PriceCard({ cfg }: { cfg: AlbumConfig | null }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [p21, setP21] = useState('');
  const [pA4, setPA4] = useState('');
  const [ship, setShip] = useState('');
  const [pct, setPct] = useState('15');
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setP21(cfg?.prices?.['21x21'] ? String(cfg.prices['21x21']) : '');
    setPA4(cfg?.prices?.A4 ? String(cfg.prices.A4) : '');
    setShip(cfg ? String(cfg.shipping ?? 0) : '');
    setPct(String(cfg?.plusPct ?? 15));
    setOn(cfg?.open ?? false);
  }, [cfg]);

  const num = (s: string) => Math.round(Number(s.replace(',', '.')));
  async function save() {
    if (busy) return;
    const a = num(p21);
    const b = num(pA4);
    const k = num(ship || '0');
    const d = num(pct || '0');
    if (!(a > 0) || !(b > 0)) return setError('İki boyut için de fiyat girin.');
    if (!(k >= 0) || !(d >= 0 && d <= 90)) return setError('Kargo 0 ya da üstü, indirim %0–90 arasında olmalı.');
    setBusy(true);
    setError('');
    try {
      await saveAlbumConfig({ prices: { '21x21': a, A4: b }, shipping: k, plusPct: d, open: on });
      setOpen(false);
    } catch {
      setError('Kaydedilemedi. Firestore kuralları yayınlandı mı?');
    } finally {
      setBusy(false);
    }
  }

  const summary = cfg?.prices
    ? `21×21: ${tl(cfg.prices['21x21'] ?? 0)} · A4: ${tl(cfg.prices.A4 ?? 0)} · Kargo: ${tl(cfg.shipping ?? 0)} · Plus: %${cfg.plusPct ?? 0} · ${cfg.open ? 'Sipariş açık' : 'Sipariş kapalı'}`
    : 'Fiyat girilmedi; sipariş kapalı.';
  const row = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <T style={{ flex: 1 }}>{label}</T>
      <Input
        value={value}
        onChangeText={set}
        keyboardType="number-pad"
        maxLength={6}
        style={{ width: 110, textAlign: 'right', paddingVertical: 10 }}
      />
      <Muted style={{ width: 24 }}>{unit}</Muted>
    </View>
  );

  return (
    <Card style={{ gap: 10 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>Fiyatlar</T>
        <Ionicons name={open ? 'chevron-up' : 'pencil'} size={18} color={t.colors.muted} />
      </Pressable>
      {!open ? (
        <Muted>{summary}</Muted>
      ) : (
        <>
          {row('21×21 cm albüm', p21, setP21, 'TL')}
          {row('A4 albüm', pA4, setPA4, 'TL')}
          {row('Kargo', ship, setShip, 'TL')}
          {row('Plus indirimi', pct, setPct, '%')}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <T>Sipariş alınsın</T>
              <Muted>Kapalıyken çiftler yalnızca baskı talebi bırakabilir.</Muted>
            </View>
            <Switch value={on} onValueChange={setOn} />
          </View>
          <ErrorText>{error}</ErrorText>
          <Button label="Fiyatları kaydet" onPress={save} busy={busy} />
        </>
      )}
    </Card>
  );
}
