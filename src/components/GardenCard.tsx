import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ANIMALS, COLS, CROPS, DECOR, farmOf, farmSummary, levelOf, type Tile } from '../lib/farm';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Ana ekranda Bizim Bahçe'nin küçük önizlemesi; dokununca çiftlik açılır.
export function GardenCard() {
  const t = useTheme();
  const { user, couple, partnerName } = useSession();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!user || !couple) return null;

  const farm = farmOf(couple);
  const { level } = levelOf(farm.xp);
  const { ready, canWater } = farmSummary(farm, user.uid, now);
  const line =
    ready > 0
      ? `${ready} ürün toplanmaya hazır ✨`
      : canWater > 0
        ? `${partnerName}’in ektiği ${canWater} ürün sulanmayı bekliyor 💧`
        : !couple.farm
          ? 'Ortak çiftliğiniz sizi bekliyor. İlk tohumları ekin!'
          : 'Ürünler büyüyor. Boş tarla varsa ekin.';

  return (
    <Pressable onPress={() => router.push('/garden')}>
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View
          style={{ width: 92, padding: 3, borderRadius: 10, backgroundColor: '#8BC34A', flexDirection: 'row', flexWrap: 'wrap', gap: 1 }}
        >
          {farm.tiles.map((tl, i) => (
            <View
              key={i}
              style={{
                width: (86 - (COLS - 1)) / COLS,
                height: (86 - (COLS - 1)) / COLS,
                borderRadius: 3,
                backgroundColor: tl.k === 'locked' ? '#5D7A3A' : tl.k === 'soil' || tl.k === 'crop' ? '#8D6E63' : '#8BC34A',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 10 }}>{mini(tl, now)}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Bizim Bahçe')}</T>
            <Ionicons name="chevron-forward" size={18} color={t.colors.primary} />
          </View>
          <Muted style={{ fontSize: 12 }}>
            Seviye {level} · {farm.coins} 🪙
          </Muted>
          <Text style={{ color: ready || canWater ? t.colors.primary : t.colors.text, fontSize: 14, fontFamily: t.fonts.body }}>
            {line}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

function mini(tl: Tile, now: number) {
  if (tl.k === 'crop') return now >= tl.ready ? CROPS[tl.crop].art : '🌱';
  if (tl.k === 'animal') return ANIMALS[tl.item].art;
  if (tl.k === 'decor') return DECOR[tl.item].art;
  return '';
}
