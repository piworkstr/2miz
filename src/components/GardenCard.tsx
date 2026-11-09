import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ImageBackground, Pressable, Text, View } from 'react-native';
import { farmOf, farmSummary, levelOf, stockCount } from '../lib/farm';
import { ART } from '../lib/farmArt';
import { useOpenScene } from '../lib/scenes';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Card, T } from './ui';

// Ana ekranda Çiftliğimiz: manzara, ahır, seviye ve sizi bekleyen ilk iş. Dokununca çiftliğe gider.
export function GardenCard() {
  const t = useTheme();
  const { user, couple, partnerName } = useSession();
  const [now, setNow] = useState(Date.now());
  const openFarm = useOpenScene(couple?.id, 'farm');
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!user || !couple) return null;

  const farm = farmOf(couple);
  const { ready, canWater, big } = farmSummary(farm, user.uid, now);
  const bank = couple.dreamBank ?? 0;
  const call = openFarm && openFarm.by !== user.uid ? openFarm : null;
  const line = call
    ? `${partnerName} seni ${call.kind === 'market' ? 'pazara' : 'hasada'} çağırıyor 💛`
    : big
      ? `${big} büyük ürün hazır · hasat günü için ${partnerName}’ı çağır 🌾`
      : bank
        ? `Günlük görevden ${bank} altın kumbarada`
        : ready
          ? `${ready} ürün toplanmaya hazır`
          : canWater
            ? `${partnerName}’in ${canWater} ürünü susuz 💧`
            : stockCount(farm)
              ? `Depoda ${stockCount(farm)} ürün · pazar hafta sonu`
              : 'Bir şey ekin; birbirinizin ektiğini sulayın.';
  const hot = !!(call || big || bank || ready || canWater);

  return (
    <Pressable onPress={() => router.push('/garden')}>
      <Card style={{ gap: 10, padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
          <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Çiftliğimiz')}</T>
          <Text
            maxFontSizeMultiplier={1.25}
            numberOfLines={1}
            style={{ fontSize: 12, fontWeight: '700', color: hot ? t.colors.primary : t.colors.muted, maxWidth: 220 }}
          >
            {line}
          </Text>
        </View>
        <ImageBackground
          source={ART.manzara.src}
          imageStyle={{ borderRadius: 16 }}
          style={{ height: 100, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' }}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(43,29,34,0.55)', 'rgba(43,29,34,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.7, y: 0.5 }}
            style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          />
          <Image source={ART.barn.src} style={{ position: 'absolute', right: 12, bottom: 4, width: 92, height: 84 }} resizeMode="contain" />
          <View style={{ padding: 12, gap: 2 }}>
            <Text
              maxFontSizeMultiplier={1.25}
              style={{ color: '#fff', fontWeight: '800', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}
            >
              Seviye {levelOf(farm.xp).level} · {farm.harvests} ortak hasat · {farm.coins} altın
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text
                maxFontSizeMultiplier={1.25}
                style={{ color: '#fff', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 }}
              >
                Çiftliğe gir
              </Text>
              <Ionicons name="arrow-forward" size={12} color="#fff" />
            </View>
          </View>
        </ImageBackground>
      </Card>
    </Pressable>
  );
}
