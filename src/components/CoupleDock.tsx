import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { activeMood, MOODS, moodLabel } from '../lib/avatar';
import { bondLabel, bondOf } from '../lib/bond';
import { useL, useLang } from '../lib/i18n';
import { isFounder } from '../lib/perks';
import { useSession, type Couple } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Avatar } from './Avatar';
import { BondHeart } from './BondHeart';
import { daysTogether } from './CoupleInfoCard';
import { Glass } from './Glass';
import { MoodSheet } from './MoodSheet';

// Çift şeridi: ikinizin avatarı ekranın altında, sekmelerin hemen üstünde durur (üstteki gök bölümünde değil).
// DENEME: şimdilik yalnızca kurucu çiftte açık; beğenilirse herkese açılır.
export const DOCK_H = 56;
export const DOCK_GAP = 8;
export const dockOn = (couple: Couple | null | undefined) => isFounder(couple);

export function CoupleDock() {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [moodOpen, setMoodOpen] = useState(false);
  if (!couple) return null;
  const bond = bondOf(couple, user?.uid, partnerId);
  const theirMood = activeMood(partnerProfile?.mood);
  const days = couple.startDate ? daysTogether(couple.startDate) : null;
  const sub = theirMood
    ? `${partnerName} ${MOODS[theirMood].emoji} ${moodLabel(theirMood, lang).toLocaleLowerCase(lang === 'en' ? 'en' : 'tr')}`
    : bondLabel(bond.level, lang);

  return (
    <>
      <Glass
        radius={DOCK_H / 2}
        intensity={60}
        style={{ height: DOCK_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8 }}
      >
        <Pressable onPress={() => setMoodOpen(true)} accessibilityLabel={l('Ruh halini seç', 'Set your mood')} hitSlop={6}>
          <Avatar p={profile} name={profile?.name ?? ''} size={42} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <BondHeart box={34} max={26} showLabel={false} />
          <View style={{ flexShrink: 1 }}>
            <Text
              maxFontSizeMultiplier={1.0}
              numberOfLines={1}
              style={{ fontFamily: t.fonts.note, fontSize: 22, lineHeight: 24, color: t.colors.text }}
            >
              {days ? l(`${days}. gün`, `Day ${days}`) : l('Birlikte', 'Together')}
            </Text>
            <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontSize: 11, color: t.colors.muted, fontFamily: t.fonts.body }}>
              {sub}
            </Text>
          </View>
        </View>
        <Avatar p={partnerProfile} name={partnerName} size={42} />
      </Glass>
      <MoodSheet open={moodOpen} onClose={() => setMoodOpen(false)} />
    </>
  );
}
