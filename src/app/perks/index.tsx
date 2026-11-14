import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card, Loading, Muted, Screen, T, Title } from '../../components/ui';
import { cardOf, CATS, codeOf, isFounder, usePartners, usePerks, type Partner, type Perk } from '../../lib/perks';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

// Avantajlar: anlaşmalı mekanların listesi. Damga kartlarında ilerleme, indirimlerde "Kod" etiketi görünür.
export default function Perks() {
  const t = useTheme();
  const { couple } = useSession();
  const partners = usePartners();
  const perks = usePerks(couple?.id);
  if (!couple || partners === null || perks === null) return <Loading />;
  const active = partners.filter((p) => p.active);
  const cities = [...new Set(active.map((p) => p.city))];

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Bugün')}
        </Text>
      </Pressable>
      <Title>Avantajlar</Title>
      <Muted>
        {active.length
          ? `${cities.join(', ')} · bu mekanlarda ikinize özel hediye ve indirim var. Kart ikinizin; damgayı hanginiz alırsa alsın aynı karta işlenir.`
          : 'İlk mekanlar ekleniyor. Çok yakında burada ikinize özel hediye ve indirimler olacak.'}
      </Muted>

      {active.map((p) => (
        <Row key={p.id} p={p} perks={perks} />
      ))}

      {isFounder(couple) && (
        <Pressable
          onPress={() => router.push('/perks/admin')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Ionicons name="settings-outline" size={16} color={t.colors.primary} />
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}>
            {tx(t, 'Mekanları yönet')}
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Row({ p, perks }: { p: Partner; perks: Perk[] }) {
  const t = useTheme();
  const cat = CATS[p.cat] ?? CATS.diger;
  const card = p.type === 'stamp' ? cardOf(p, perks) : null;
  const code = p.type === 'code' ? codeOf(p, perks) : null;
  return (
    <Pressable onPress={() => router.push(`/perks/${p.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cat.soft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={cat.icon} size={22} color={cat.color} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{p.name}</T>
            <Muted>{p.offer}</Muted>
          </View>
          {code && (
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: code.live ? t.colors.successSoft : cat.soft,
              }}
            >
              <Text
                maxFontSizeMultiplier={1.1}
                style={{ fontSize: 12, fontWeight: '700', color: code.live ? t.colors.success : cat.color }}
              >
                {code.live ? 'Kod açık' : code.canGet ? 'Kod' : 'Kullanıldı'}
              </Text>
            </View>
          )}
        </View>
        {card && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {Array.from({ length: card.goal }, (_, i) => (
              <View
                key={i}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: i < card.filled ? t.colors.primary : 'transparent',
                  borderWidth: i < card.filled ? 0 : 1,
                  borderColor: t.colors.border,
                }}
              />
            ))}
            {card.reward && (
              <Text maxFontSizeMultiplier={1.1} style={{ marginLeft: 4, fontSize: 13, fontWeight: '700', color: t.colors.success }}>
                Ödül hazır 🎁
              </Text>
            )}
          </View>
        )}
        {!!p.area && <Muted style={{ fontSize: 12 }}>{`${p.area} · ${p.city}`}</Muted>}
      </Card>
    </Pressable>
  );
}
