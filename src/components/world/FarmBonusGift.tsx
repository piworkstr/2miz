import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { openFarmBonus } from '../../lib/farm';
import { BONUS_ITEMS, type FarmBonus } from '../../lib/farmBonus';
import { useTheme } from '../../lib/useTheme';

// Yönetimden gelen hediye paketi: ekranın ortasında büyük, sallanan bir paket. Dokununca açılır ve içindekiler çiftliğe eklenir.
// Dışına dokununca "sonra aç": paket durur, çiftliğe bir sonraki girişte yine çıkar.
export function FarmBonusGift({ bonus, coupleId, uid, onClose }: { bonus: FarmBonus; coupleId: string; uid: string; onClose: () => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [error, setError] = useState('');
  const wobble = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wobble, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [wobble, pop]);

  async function open() {
    if (busy || opened) return;
    setBusy(true);
    setError('');
    try {
      const got = await openFarmBonus(coupleId, uid, bonus.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setOpened(got ?? 'Paket açıldı');
    } catch {
      setError('Açılamadı; bağlantıyı kontrol edip tekrar dokun.');
    } finally {
      setBusy(false);
    }
  }

  const items: { n: number; label: string }[] = [];
  if (bonus.coins > 0) items.push({ n: bonus.coins, label: 'altın' });
  if (bonus.xp > 0) items.push({ n: bonus.xp, label: 'tecrübe' });
  for (const [k, n] of Object.entries(bonus.stock ?? {}))
    if (n > 0) items.push({ n, label: (BONUS_ITEMS[k] ?? k).toLocaleLowerCase('tr') });

  return (
    <Pressable
      onPress={onClose}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(43,29,34,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Pressable
          onPress={opened ? onClose : open}
          style={{
            width: 300,
            backgroundColor: '#FFF7E0',
            borderColor: '#E0A43A',
            borderWidth: 2,
            borderRadius: 28,
            paddingHorizontal: 20,
            paddingVertical: 24,
            alignItems: 'center',
            gap: 10,
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Animated.Text
            maxFontSizeMultiplier={1.0}
            style={{
              fontSize: 96,
              lineHeight: 112,
              transform: [{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] }) }],
            }}
          >
            {opened ? '🎉' : '🎁'}
          </Animated.Text>
          <Text
            maxFontSizeMultiplier={1.0}
            style={{ fontFamily: t.fonts.title, fontSize: 34, lineHeight: 38, color: '#5A3E0A', textAlign: 'center' }}
          >
            {opened ? 'Çiftliğinize eklendi!' : '2miz’den hediye!'}
          </Text>
          {!!bonus.note && !opened && (
            <Text
              maxFontSizeMultiplier={1.0}
              style={{ fontFamily: t.fonts.note, fontSize: 22, lineHeight: 26, color: '#5A3E0A', textAlign: 'center' }}
            >
              “{bonus.note}”
            </Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {items.map((it) => (
              <View
                key={it.label}
                style={{ backgroundColor: '#FFE9B0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}
              >
                <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 22, fontWeight: '800', color: '#5A3E0A' }}>
                  {it.n}
                </Text>
                <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 13, fontWeight: '600', color: '#8A5A00' }}>
                  {it.label}
                </Text>
              </View>
            ))}
          </View>
          {!!error && (
            <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 13, color: '#B8433A', textAlign: 'center' }}>
              {error}
            </Text>
          )}
          <View style={{ backgroundColor: '#E0A43A', borderRadius: 22, paddingHorizontal: 26, paddingVertical: 12, marginTop: 4 }}>
            <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>
              {opened ? 'Harika' : busy ? 'Açılıyor…' : 'Paketi aç'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
      {!opened && (
        <Text maxFontSizeMultiplier={1.0} style={{ color: '#fff', fontSize: 13, marginTop: 14, fontWeight: '600' }}>
          Sonra açmak için boşluğa dokun
        </Text>
      )}
    </Pressable>
  );
}
