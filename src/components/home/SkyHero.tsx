import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { activeMood, avatarBustSvg, MOODS, moodLabel } from '../../lib/avatar';
import { bondLabel, bondOf } from '../../lib/bond';
import { localeOf, useL, useLang } from '../../lib/i18n';
import { useSession, type Profile } from '../../lib/session';
import { useTheme } from '../../lib/useTheme';
import { SvgXml } from 'react-native-svg';
import { ArtAvatar } from '../ArtAvatar';
import { BondHeart } from '../BondHeart';
import { Glass } from '../Glass';
import { MoodSheet } from '../MoodSheet';

// Ana ekranın üstü: oyun değil, ikiniz. Günün saatine göre gökyüzü, ikinizin avatarı, ruh halleriniz, aranızda bağ kalbi.
export const HERO_H = 300;
export const HERO_COMPACT_H = 150;

type Sky = { colors: [string, string, string]; ink: string; sub: string; hills: [string, string]; sun: string; night: boolean };
export function skyFor(h: number): Sky {
  if (h >= 5 && h < 10)
    return {
      colors: ['#FFD8B5', '#FFEBD6', '#CFE7F5'],
      ink: '#2B1D22',
      sub: '#6E5A60',
      hills: ['#F6CFC2', '#EBC3D0'],
      sun: '#FFE3A0',
      night: false,
    };
  if (h >= 10 && h < 17)
    return {
      colors: ['#BFE3F5', '#FFE4CF', '#FFD1C2'],
      ink: '#2B1D22',
      sub: '#6E5A60',
      hills: ['#F6C9C9', '#E9B8C8'],
      sun: '#FFE39A',
      night: false,
    };
  if (h >= 17 && h < 21)
    return {
      colors: ['#F7B267', '#F49E7A', '#9D7BB8'],
      ink: '#2B1D22',
      sub: '#5A3E4A',
      hills: ['#D98A9E', '#A979A8'],
      sun: '#FFD36B',
      night: false,
    };
  return {
    colors: ['#1B2A4A', '#2F3F6E', '#5C4F86'],
    ink: '#FFFFFF',
    sub: 'rgba(255,255,255,0.8)',
    hills: ['#2D3E6A', '#3E4C7E'],
    sun: '#F4F1E1',
    night: true,
  };
}

function Bust({ p, name, size }: { p: Profile | null; name: string; size: number }) {
  const t = useTheme();
  const { lang } = useLang();
  const a = p?.avatar;
  // çizgi avatar: ruh hali yüze yansır; omuzlara kadar, zemin bandına oturur
  if (a?.kind === 'art')
    return <ArtAvatar opts={a.opts} size={size * 1.25} mood={activeMood(p?.mood)} variant="bust" style={{ marginBottom: -6 }} />;
  if (a?.kind === 'drawn') return <SvgXml xml={avatarBustSvg(a.opts)} width={size} height={size} />;
  const r = size * 0.72;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      {a?.kind === 'photo' ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${a.photo}` }}
          style={{ width: r, height: r, borderRadius: r / 2, borderWidth: 3, borderColor: '#fff' }}
        />
      ) : (
        <View
          style={{
            width: r,
            height: r,
            borderRadius: r / 2,
            backgroundColor: t.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: '#fff',
          }}
        >
          <Text maxFontSizeMultiplier={1.0} style={{ color: t.colors.primary, fontWeight: '800', fontSize: r * 0.4 }}>
            {(name || '?').slice(0, 1).toLocaleUpperCase(localeOf(lang))}
          </Text>
        </View>
      )}
    </View>
  );
}

function Bubble({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignSelf: 'center' }}>
      <Glass radius={14} strong style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 12, fontWeight: '700', color: '#2B1D22' }}>
          {children}
        </Text>
      </Glass>
    </Pressable>
  );
}

export function SkyHero({
  greeting,
  line,
  streak,
  points,
  pointsLabel,
  compact = false,
}: {
  greeting: string;
  line: string;
  streak: number;
  points: number;
  pointsLabel: string;
  compact?: boolean; // çift şeridi açıkken avatarlar altta durur; gök bölümü kısalır
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const l = useL();
  const { lang } = useLang();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [moodOpen, setMoodOpen] = useState(false);
  const sky = skyFor(new Date().getHours());
  const bond = bondOf(couple, user?.uid, partnerId);
  const myMood = activeMood(profile?.mood);
  const theirMood = activeMood(partnerProfile?.mood);
  const H = (compact ? HERO_COMPACT_H : HERO_H) + insets.top;
  const W = 390;

  return (
    <View style={{ height: H, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' }}>
      <LinearGradient colors={sky.colors} locations={[0, 0.55, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      {/* güneş / ay, yıldızlar, tepeler */}
      <Svg
        style={{ position: 'absolute', left: 0, top: 0 }}
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
      >
        {sky.night &&
          [8, 40, 90, 150, 210, 260, 320, 360, 120, 300, 60, 230].map((x, i) => (
            <Circle key={i} cx={x} cy={insets.top + 10 + ((i * 53) % 110)} r={i % 3 === 0 ? 1.8 : 1.2} fill="#fff" opacity={0.85} />
          ))}
        <Circle cx={W - 84} cy={insets.top + 60} r={sky.night ? 22 : 44} fill={sky.sun} opacity={sky.night ? 0.95 : 0.85} />
        {!sky.night && <Circle cx={W - 84} cy={insets.top + 60} r={64} fill={sky.sun} opacity={0.25} />}
        <Ellipse cx={W * 0.78} cy={H + 30} rx={W * 0.62} ry={120} fill={sky.hills[0]} opacity={0.6} />
        <Ellipse cx={W * 0.18} cy={H + 50} rx={W * 0.7} ry={130} fill={sky.hills[1]} opacity={0.55} />
      </Svg>
      {/* zemin camı: avatarların durduğu bant */}
      {!compact && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 34, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      )}

      <View style={{ position: 'absolute', left: 20, right: 16, top: insets.top + 8, flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text
            maxFontSizeMultiplier={1.0}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{ fontFamily: t.fonts.title, fontSize: 40, lineHeight: 44, color: sky.ink }}
          >
            {greeting}
          </Text>
          <Text
            maxFontSizeMultiplier={1.0}
            numberOfLines={1}
            style={{ fontSize: 13, color: sky.sub, fontFamily: t.fonts.body, marginTop: 2 }}
          >
            {line}
          </Text>
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Glass radius={999} style={{ paddingHorizontal: 11, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="flame" size={14} color="#E07A45" />
            <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 13, fontWeight: '800', color: '#2B1D22' }}>
              {l(`${streak} gün`, streak === 1 ? '1 day' : `${streak} days`)}
            </Text>
          </Glass>
          <Glass radius={999} style={{ paddingHorizontal: 11, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="star" size={13} color={t.colors.primary} />
            <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 13, fontWeight: '800', color: '#2B1D22' }}>
              {points} {pointsLabel}
            </Text>
          </Glass>
        </View>
      </View>

      {/* ikiniz */}
      {!compact && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 30,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 22,
          }}
        >
          <Pressable onPress={() => setMoodOpen(true)} style={{ alignItems: 'center', gap: 6 }}>
            <Bubble onPress={() => setMoodOpen(true)}>
              {myMood ? `${MOODS[myMood].emoji} ${moodLabel(myMood, lang)}` : l('Nasılsın? +', 'How are you? +')}
            </Bubble>
            <Bust p={profile} name={profile?.name ?? ''} size={118} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 4, marginBottom: 46 }}>
            <Glass radius={30} style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
              <BondHeart box={56} max={40} showLabel={false} />
            </Glass>
            <Glass radius={999} strong style={{ paddingHorizontal: 9, paddingVertical: 3 }}>
              <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 11, fontWeight: '700', color: '#2B1D22' }}>
                {bondLabel(bond.level, lang)}
              </Text>
            </Glass>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Bubble>{theirMood ? `${MOODS[theirMood].emoji} ${moodLabel(theirMood, lang)}` : partnerName}</Bubble>
            <Bust p={partnerProfile} name={partnerName} size={118} />
          </View>
        </View>
      )}
      <MoodSheet open={moodOpen} onClose={() => setMoodOpen(false)} />
    </View>
  );
}
