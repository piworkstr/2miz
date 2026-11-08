import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { farmOf, farmSummary, levelOf } from '../lib/farm';
import { ART } from '../lib/farmArt';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Ana ekranda Bizim Bahçe kartı; dokununca 2.5D çiftlik açılır.
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
  const { ready, canWater, fields } = farmSummary(farm, user.uid, now);
  const fresh = !couple.farm || (couple.farm as { v?: number }).v !== 2;
  const line =
    ready > 0
      ? `${ready} ürün toplanmaya hazır`
      : canWater > 0
        ? `${partnerName}’in ektiği ${canWater} ürün sulanmayı bekliyor 💧`
        : fresh
          ? 'Ortak çiftliğiniz sizi bekliyor. İlk tohumları ekin!'
          : `${fields} tarlanız var. Ürünler büyüyor.`;

  return (
    <Pressable onPress={() => router.push('/garden')}>
      <Card style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View
          style={{
            width: 92,
            height: 80,
            borderRadius: 14,
            backgroundColor: '#A9D46C',
            alignItems: 'center',
            justifyContent: 'flex-end',
            overflow: 'hidden',
          }}
        >
          <Image source={ART.soil.src} style={{ position: 'absolute', left: -6, bottom: -4, width: 60, height: 37 }} />
          <Image source={ART.bugday.src} style={{ position: 'absolute', left: 34, bottom: -8, width: 58, height: 51 }} />
          <Image source={ART.barn.src} style={{ position: 'absolute', left: 4, top: 2, width: 52, height: 54 }} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Bizim Bahçe')}</T>
            <Ionicons name="chevron-forward" size={18} color={t.colors.primary} />
          </View>
          <Muted style={{ fontSize: 12 }}>
            Seviye {level} · {farm.coins} altın
          </Muted>
          <Text style={{ color: ready || canWater ? t.colors.primary : t.colors.text, fontSize: 14, fontFamily: t.fonts.body }}>
            {line}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
