import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { activeMood, MOODS, moodLabel } from '../lib/avatar';
import { bondLabel, bondOf } from '../lib/bond';
import { useL, useLang } from '../lib/i18n';
import { isFounder } from '../lib/perks';
import { useSession, type Couple } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { BondHeart } from './BondHeart';
import { daysTogether } from './CoupleInfoCard';
import { Bust } from './home/SkyHero';
import { MoodSheet } from './MoodSheet';

// İkiniz ekranın altında: avatarlar sekme çubuğunun üstünde ayakta durur (üstteki gök bölümünde değil).
// Çerçeve ya da şerit yok; omuzlara kadar büyük çizim, yüz ifadesi okunur. Ortada el yazısıyla gün sayısı.
// DENEME: şimdilik yalnızca kurucu çiftte açık; beğenilirse herkese açılır.
export const DOCK_H = 104;
export const DOCK_GAP = 0;
const BUST = 70;
export const dockOn = (couple: Couple | null | undefined) => isFounder(couple);

export function CoupleDock() {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [moodOpen, setMoodOpen] = useState(false);
  if (!couple) return null;
  const bond = bondOf(couple, user?.uid, partnerId);
  const myMood = activeMood(profile?.mood);
  const theirMood = activeMood(partnerProfile?.mood);
  const days = couple.startDate ? daysTogether(couple.startDate) : null;
  const mood = (m: NonNullable<typeof myMood>) => `${MOODS[m].emoji} ${moodLabel(m, lang)}`;

  const tag = (text: string, color: string) => (
    <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color, fontFamily: t.fonts.body }}>
      {text}
    </Text>
  );

  return (
    <>
      <View pointerEvents="box-none" style={{ height: DOCK_H, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4 }}>
        <Pressable
          onPress={() => setMoodOpen(true)}
          accessibilityLabel={l('Ruh halini seç', 'Set your mood')}
          style={{ alignItems: 'center' }}
        >
          {tag(myMood ? mood(myMood) : l('Nasılsın? +', 'How are you? +'), myMood ? t.colors.text : t.colors.primary)}
          <Bust p={profile} name={profile?.name ?? ''} size={BUST} />
        </Pressable>
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', paddingBottom: 12 }}>
          <BondHeart box={34} max={26} showLabel={false} />
          <Text
            maxFontSizeMultiplier={1.0}
            numberOfLines={1}
            style={{ fontFamily: t.fonts.note, fontSize: 24, lineHeight: 26, color: t.colors.text }}
          >
            {days ? l(`${days}. gün`, `Day ${days}`) : bondLabel(bond.level, lang)}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          {tag(theirMood ? mood(theirMood) : partnerName, t.colors.text)}
          <Bust p={partnerProfile} name={partnerName} size={BUST} />
        </View>
      </View>
      <MoodSheet open={moodOpen} onClose={() => setMoodOpen(false)} />
    </>
  );
}
