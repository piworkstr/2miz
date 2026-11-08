import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { DART } from '../lib/dreamArt';
import { homeOf, HOUSE_LV, ritualState, seaOf } from '../lib/dreams';
import { farmOf, farmSummary } from '../lib/farm';
import { ART } from '../lib/farmArt';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Ana ekranda Hayalimiz kartı: üç dünyanın küçük resmi ve sizi bekleyen ilk şey.
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
  const sea = seaOf(couple, now);
  const home = homeOf(couple);
  const { ready, canWater } = farmSummary(farm, user.uid, now);
  const bank = couple.dreamBank ?? 0;
  const waitHome = home.tiles.some(
    (x, i) => x.k === 'item' && ritualState(home, i).length === 1 && !ritualState(home, i).includes(user.uid),
  );
  const sun = sea.sunset && !sea.sunset.joined && sea.sunset.by !== user.uid;

  const line = bank
    ? `Günlük görevden ${bank} altın kumbarada`
    : sun
      ? `${partnerName} seni gün batımına çağırıyor 🌅`
      : waitHome
        ? `${partnerName} seni Sahilde Ev’de bekliyor 💛`
        : ready
          ? `Çiftlikte ${ready} ürün toplanmaya hazır`
          : canWater
            ? `${partnerName}’in ektiği ${canWater} ürün sulanmayı bekliyor 💧`
            : sea.trip
              ? 'Tekneniz yolda ⛵'
              : 'Çiftlik, tekne ve sahildeki ev sizi bekliyor.';
  const hot = !!(bank || sun || waitHome || ready || canWater);

  return (
    <Pressable onPress={() => router.push('/dreams')}>
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
            { bg: '#E99AB8', src: DART[HOUSE_LV[home.lvl - 1].art].src },
          ].map((w, k) => (
            <View
              key={k}
              style={{ flex: 1, height: 64, borderRadius: 12, backgroundColor: w.bg, alignItems: 'center', justifyContent: 'center' }}
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
