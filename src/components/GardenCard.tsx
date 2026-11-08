import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { DART } from '../lib/dreamArt';
import { bay, homeOf, HOUSE_LV, houseLevel, seaOf } from '../lib/dreams';
import { farmOf, farmSummary } from '../lib/farm';
import { ART } from '../lib/farmArt';
import { useOpenScene } from '../lib/scenes';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Ana ekranda Hayalimiz kartı: üç dünyanın küçük resmi ve sizi bekleyen ilk şey.
export function GardenCard() {
  const t = useTheme();
  const { user, couple, partnerName } = useSession();
  const [now, setNow] = useState(Date.now());
  const openSea = useOpenScene(couple?.id, 'sea');
  const openHome = useOpenScene(couple?.id, 'home');
  const openFarm = useOpenScene(couple?.id, 'farm');
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!user || !couple) return null;

  const farm = farmOf(couple);
  const sea = seaOf(couple, now);
  const home = homeOf(couple);
  const { ready, canWater } = farmSummary(farm, user.uid, now);
  const bank = couple.dreamBank ?? 0;
  // Partnerin başlattığı ve beni beklediği sahne
  const call = [openSea, openHome, openFarm].find((s) => s && s.by !== user.uid);
  const where = call ? (call.world === 'sea' ? `${bay(sea.at).name}’e` : call.world === 'home' ? 'Sahilde Ev’e' : 'çiftliğe') : '';

  const line = call
    ? `${partnerName} seni ${where} çağırıyor 💛`
    : bank
      ? `Günlük görevden ${bank} altın kumbarada`
      : ready
        ? `Çiftlikte ${ready} ürün toplanmaya hazır`
        : canWater
          ? `${partnerName}’in ektiği ${canWater} ürün sulanmayı bekliyor 💧`
          : sea.trip
            ? `Tekneniz ${bay(sea.trip.to).name} yolunda ⛵`
            : 'Çiftlik, tekne ve sahildeki ev sizi bekliyor.';
  const hot = !!(call || bank || ready || canWater);

  return (
    <Pressable
      onPress={() =>
        router.push(call ? (call.world === 'sea' ? '/dream/sea' : call.world === 'home' ? '/dream/house' : '/garden') : '/dreams')
      }
    >
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Hayalimiz')}</T>
          <Muted style={{ fontSize: 12 }}>{farm.coins} altın</Muted>
          <Ionicons name="chevron-forward" size={18} color={t.colors.primary} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { bg: '#8BC34F', src: ART.barn.src },
            { bg: '#4FA8D8', src: DART[sea.boat].src },
            { bg: '#E99AB8', src: DART[HOUSE_LV[houseLevel(home) - 1].art as keyof typeof DART].src },
          ].map((w, k) => (
            <View
              key={k}
              style={{
                flex: 1,
                height: 64,
                borderRadius: 12,
                backgroundColor: w.bg,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Image source={w.src} style={{ width: 62, height: 54 }} resizeMode="contain" />
            </View>
          ))}
        </View>
        <Text style={{ color: hot ? t.colors.primary : t.colors.text, fontSize: 14, fontFamily: t.fonts.body }}>{line}</Text>
      </Card>
    </Pressable>
  );
}
