import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { cardOf, isFounder, usePartners, usePerks } from '../lib/perks';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Ana ekranda Avantajlar: anlaşmalı mekan varsa görünür (kurucu çift mekan eklemek için hep görür).
export function PerksCard() {
  const t = useTheme();
  const { couple } = useSession();
  const partners = usePartners();
  const perks = usePerks(couple?.id);
  const active = (partners ?? []).filter((p) => p.active);
  const founder = isFounder(couple);
  if (!couple || (!active.length && !founder)) return null;

  // En yakın ödül: hazır olan ya da en az damgası kalan kart.
  const cards = active
    .filter((p) => p.type === 'stamp')
    .map((p) => ({ p, c: cardOf(p, perks ?? []) }))
    .filter((x) => x.c.used)
    .sort((a, b) => a.c.goal - a.c.filled - (b.c.goal - b.c.filled));
  const top = cards[0];
  const line = top
    ? top.c.reward
      ? `${top.p.name}: ödülünüz hazır 🎁`
      : `${top.p.name}: ${top.c.goal - top.c.filled} damga kaldı`
    : active.length
      ? `${active.length} mekanda ikinize özel hediye ve indirim`
      : 'Henüz mekan yok · eklemek için dokun';

  return (
    <Pressable onPress={() => router.push('/perks')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="pricetags" size={22} color={t.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>Avantajlar</T>
          <Muted>{line}</Muted>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.colors.muted} />
      </Card>
    </Pressable>
  );
}
