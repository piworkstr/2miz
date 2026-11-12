import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { bondLabel, bondOf } from '../lib/bond';
import { useL, useLang } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

// İletişim arttıkça büyüyen, azaldıkça küçülen kalp. Sıcakken atar.
export function BondHeart({ box = 64, max = 58, showLabel = true }: { box?: number; max?: number; showLabel?: boolean }) {
  const t = useTheme();
  const { user, couple, partnerId, partnerName } = useSession();
  const l = useL();
  const { lang } = useLang();
  const bond = bondOf(couple, user?.uid, partnerId);
  const label = bondLabel(bond.level, lang);
  const size = Math.round(16 + bond.level * (max - 16));
  const beat = useRef(new Animated.Value(1)).current;
  const [info, setInfo] = useState(false);
  const hot = bond.level >= 0.5;

  useEffect(() => {
    if (!hot) {
      beat.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1.14, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1.08, duration: 160, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.delay(bond.level >= 0.75 ? 650 : 1100),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hot, bond.level >= 0.75]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Pressable
        onPress={() => setInfo(true)}
        hitSlop={8}
        accessibilityLabel={l(`İlişki kalbi: ${label}`, `Relationship heart: ${label}`)}
        style={{ alignItems: 'center', width: box }}
      >
        <View style={{ height: max + 4, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={{ transform: [{ scale: beat }], opacity: 0.4 + 0.6 * Math.max(bond.level, 0.05) }}>
            <Ionicons name={bond.level > 0 ? 'heart' : 'heart-outline'} size={size} color={t.colors.primary} />
          </Animated.View>
        </View>
        {showLabel && (
          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={{ fontSize: 10, color: t.colors.muted, fontFamily: t.fonts.body }}>
            {label}
          </Text>
        )}
      </Pressable>

      <Modal visible={info} transparent animationType="fade" onRequestClose={() => setInfo(false)}>
        <Pressable onPress={() => setInfo(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable
            style={{
              backgroundColor: t.colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 22,
              paddingBottom: 40,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="heart" size={28} color={t.colors.primary} />
              <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 19, fontWeight: '700', color: t.colors.text }}>
                {l(`Kalbiniz: ${label}`, `Your heart: ${label}`)}
              </Text>
            </View>
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 15, lineHeight: 21, color: t.colors.text }}>
              {l(
                'Kalp, son 7 gündeki iletişiminize göre büyür ya da küçülür. Mesajlar, anlık fotoğraflar, görevler, oyunlar, bonus görevler ve çiftlikte yaptıklarınız kalbi büyütür (birbirinizin ürününü sulamak, birlikte hasat ve pazar en çok sayılır); en çok da ikinizin de aynı gün bir şey yaptığı günler sayılır. Birkaç gün sessiz kalırsanız kalp küçülür.',
                "The heart grows or shrinks with how much you've connected over the last 7 days. Messages, snaps, tasks, games, bonus tasks and what you do on the farm make it grow (watering each other's crops, harvesting together and market day count the most); days when you both do something count most of all. A few quiet days and the heart shrinks.",
              )}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flame" size={20} color="#E07A45" />
              <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 15, lineHeight: 21, color: t.colors.text }}>
                {bond.streak > 0
                  ? l(
                      `${bond.streak} gündür ikiniz de her gün iletişimdesiniz.`,
                      `You've both connected every day for ${bond.streak} days.`,
                    )
                  : l(
                      'İkiniz de aynı gün bir şey yaptığınızda iletişim seriniz başlar.',
                      'Your streak starts when you both do something on the same day.',
                    )}
                {bond.atRisk
                  ? l(
                      ` Bugün henüz ${bond.meToday ? partnerName : 'sen'} bir şey yapmadı; gün bitmeden yaparsanız seri devam eder.`,
                      bond.meToday
                        ? ` ${partnerName} hasn't done anything yet today; do it before the day ends to keep the streak.`
                        : " You haven't done anything yet today; do it before the day ends to keep the streak.",
                    )
                  : ''}
              </Text>
            </View>
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 13, color: t.colors.muted }}>
              {l(
                `Bugün: sen ${bond.meToday} puan · ${partnerName} ${bond.themToday} puan`,
                `Today: you ${bond.meToday} pts · ${partnerName} ${bond.themToday} pts`,
              )}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// İletişim serisi rozeti: alev ve gün sayısı; seri tehlikedeyse kum saati.
export function BondStreak({ compact }: { compact?: boolean }) {
  const t = useTheme();
  const { user, couple, partnerId } = useSession();
  const l = useL();
  const bond = bondOf(couple, user?.uid, partnerId);
  if (compact && bond.streak === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons
        name={bond.streak > 0 ? 'flame' : 'flame-outline'}
        size={compact ? 15 : 17}
        color={bond.streak > 0 ? '#E07A45' : t.colors.muted}
      />
      <Text
        maxFontSizeMultiplier={1.25}
        style={{ fontSize: compact ? 13 : 14, fontWeight: '700', color: t.colors.text, fontFamily: t.fonts.body }}
      >
        {l(`${bond.streak} gün`, bond.streak === 1 ? '1 day' : `${bond.streak} days`)}
      </Text>
      {bond.atRisk && <Ionicons name="hourglass-outline" size={compact ? 13 : 15} color="#E07A45" />}
    </View>
  );
}
