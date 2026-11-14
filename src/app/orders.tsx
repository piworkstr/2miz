import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card, Loading, Muted, Screen, T, Title } from '../components/ui';
import { trDate } from '../lib/date';
import { STATUS, STEPS, tl, useMyOrders, type Order } from '../lib/orders';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

const sizeLabel = (s: string) => (s === '21x21' ? '21×21 cm' : s);

// Albüm siparişleri: çift kendi siparişinin durumunu görür. Yönetim (durum, fiyat) web panelindedir.
export default function Orders() {
  const t = useTheme();
  const { couple } = useSession();
  const mine = useMyOrders(couple?.id);
  if (!couple || mine === null) return <Loading />;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Albüm')}
        </Text>
      </Pressable>
      <Title>Siparişler</Title>

      {mine.length ? (
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
