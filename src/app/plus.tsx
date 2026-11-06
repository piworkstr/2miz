import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Muted, Screen, T } from '../components/ui';
import { FREE, PLUS, PRICES, usePlus, type PlusReason } from '../lib/plus';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Sınıra gelince ya da Biz ekranındaki karttan açılan 2miz Plus ekranı.
const HEADLINES: Record<PlusReason, { title: string; sub: string }> = {
  wheel: { title: 'Bugünkü çark hakkınız bitti', sub: 'Ücretsizde çark günde bir kez döner. Plus ile istediğiniz kadar çevirin.' },
  game: { title: 'Bugünkü oyununuzu oynadınız', sub: 'Ücretsizde günde bir canlı oyun var. Plus ile sınırsız oynayın.' },
  trip: {
    title: 'Yeni seyahatler Plus’ta',
    sub: `Ücretsizde ${FREE.trips} seyahat albümü açılır. Plus ile her tatilin kendi albümü olsun.`,
  },
  tripPhotos: {
    title: `Bu seyahat ${FREE.tripPhotos} fotoğrafla doldu`,
    sub: `Plus ile her seyahate ${PLUS.tripPhotos} fotoğrafa kadar ekleyin.`,
  },
  card: { title: '2miz Plus', sub: 'Biriniz öder, ikiniz de kullanırsınız.' },
};

const FEATURES: { icon: IconName; text: string; soon?: boolean }[] = [
  { icon: 'sync-circle-outline', text: 'Bonus görev çarkı sınırsız' },
  { icon: 'game-controller-outline', text: 'Canlı oyunlar sınırsız' },
  { icon: 'airplane-outline', text: `Sınırsız seyahat albümü, her birine ${PLUS.tripPhotos} fotoğraf` },
  { icon: 'book-outline', text: 'Baskı albümde %15 indirim' },
  { icon: 'image-outline', text: 'Yüksek çözünürlüklü fotoğraflar', soon: true },
  { icon: 'color-palette-outline', text: 'Ek temalar ve widget görünümleri', soon: true },
];

export default function PlusScreen() {
  const t = useTheme();
  const { from } = useLocalSearchParams<{ from?: PlusReason }>();
  const { user, couple, partnerName } = useSession();
  const plus = usePlus();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const head = HEADLINES[from && from in HEADLINES ? from : 'card'];

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const payer = plus.by === user?.uid ? 'Senin' : `${partnerName}’in`;
  const until = plus.until ? new Date(plus.until).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <Screen>
      <Pressable onPress={close} hitSlop={12} accessibilityLabel="Kapat" style={{ alignSelf: 'flex-end' }}>
        <Ionicons name="close" size={28} color={t.colors.text} />
      </Pressable>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: t.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="heart" size={32} color={t.colors.primary} />
        </View>
        <Text style={{ color: t.colors.text, fontSize: 24, textAlign: 'center', fontFamily: t.fonts.display, fontWeight: '700' }}>
          {tx(t, head.title)}
        </Text>
        <Muted style={{ textAlign: 'center' }}>{head.sub}</Muted>
      </View>

      {plus.paid && (
        <Card accent style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Ionicons name="gift-outline" size={22} color={t.colors.primary} />
          <T style={{ flex: 1 }}>
            {payer} Plus’ı ikinizde de açık{until ? ` · ${until} tarihine kadar` : ''}.
          </T>
        </Card>
      )}

      {plus.beta && (
        <Card
          style={{
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
            backgroundColor: t.colors.successSoft,
            borderColor: t.colors.successSoft,
          }}
        >
          <Ionicons name="sparkles-outline" size={22} color={t.colors.success} />
          <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
            Beta boyunca Plus’ın her şeyi size açık. Satışlar mağazada başlayınca buradan abone olabileceksiniz.
          </T>
        </Card>
      )}

      <Card style={{ gap: 12 }}>
        {FEATURES.map((f) => (
          <View key={f.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ionicons name={f.icon} size={22} color={t.colors.primary} />
            <T style={{ flex: 1, fontSize: 15 }}>{f.text}</T>
            {f.soon && <Muted style={{ fontSize: 11 }}>yakında</Muted>}
          </View>
        ))}
      </Card>

      <Muted style={{ fontSize: 13, textAlign: 'center' }}>Günlük görev, albüm ve mesajlaşma her zaman ücretsiz.</Muted>

      {!plus.paid && (
        <>
          <View style={{ gap: 10 }}>
            {(['yearly', 'monthly'] as const).map((k) => {
              const p = PRICES[k];
              const on = plan === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setPlan(k)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    borderRadius: t.radius.card,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? t.colors.primary : t.colors.border,
                    backgroundColor: t.colors.card,
                  }}
                >
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? t.colors.primary : t.colors.muted} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '700' }}>{p.label}</T>
                    {'note' in p && <Muted style={{ fontSize: 12 }}>{p.note}</Muted>}
                  </View>
                  <T style={{ fontWeight: '700' }}>
                    {p.price}
                    <Text style={{ fontWeight: '400', color: t.colors.muted }}>{p.per}</Text>
                  </T>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            disabled
            style={{
              minHeight: 52,
              borderRadius: t.radius.button,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.colors.primary,
              opacity: 0.45,
            }}
          >
            <Text style={{ color: t.colors.onPrimary, fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>
              {tx(t, plan === 'yearly' ? '7 gün ücretsiz dene' : 'Abone ol')} · yakında
            </Text>
          </Pressable>

          <Muted style={{ fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            Abonelik çiftinize açılır; partnerin ayrıca ödemez. İptal etmezsen dönem sonunda yenilenir. İptal ve yönetim App Store ya da
            Google Play hesap ayarlarından yapılır.
          </Muted>
        </>
      )}
      {!couple && <Muted>Plus, eşleştikten sonra ikinize birden açılır.</Muted>}
    </Screen>
  );
}
