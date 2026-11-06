import { Image, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { activeMood, avatarSvg, MOODS } from '../lib/avatar';
import type { Profile } from '../lib/session';
import { useTheme } from '../lib/useTheme';

// Kişinin avatarı: çizilmiş karakter, fotoğraf ya da (hiçbiri yoksa) adının baş harfi.
// Ruh hali varsa çizilmiş avatarın yüz ifadesi değişir; fotoğrafta köşede emoji çıkar.
export function Avatar({ p, name, size = 44, showMood = true }: { p: Profile | null | undefined; name: string; size?: number; showMood?: boolean }) {
  const t = useTheme();
  const mood = showMood ? activeMood(p?.mood) : null;
  const a = p?.avatar;
  const badge = mood && (a?.kind !== 'drawn' || size < 40) && (
    <View
      style={{
        position: 'absolute',
        right: -4,
        bottom: -4,
        width: size * 0.45,
        height: size * 0.45,
        minWidth: 18,
        minHeight: 18,
        borderRadius: size,
        backgroundColor: t.colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <Text style={{ fontSize: Math.max(11, size * 0.26) }}>{MOODS[mood].emoji}</Text>
    </View>
  );

  return (
    <View style={{ width: size, height: size }}>
      {a?.kind === 'drawn' ? (
        <SvgXml xml={avatarSvg(a.opts, mood)} width={size} height={size} />
      ) : a?.kind === 'photo' ? (
        <Image source={{ uri: `data:image/jpeg;base64,${a.photo}` }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: t.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: t.colors.primary, fontWeight: '700', fontSize: size * 0.4 }}>{(name || '?').slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
        </View>
      )}
      {badge}
    </View>
  );
}
