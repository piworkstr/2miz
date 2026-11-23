import { type ReactNode } from 'react';
import { Image, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { ART } from '../../lib/farmArt';
import { UI, type UIKey } from '../../lib/farmUiArt';

// Çiftliğin arayüz takımı: ahşap levha, kabartmalı düğme, yuvarlak düğme, panel çerçevesi ve oyun yazısı.
// Görseller assets/farm/ui altında; uzayan parçalar (levha, düğme, çubuk) sol-orta-sağ üç görselden,
// panel dokuz görselden birleştirilir. Orta parçalar gerilir, uçlar ve köşeler bozulmaz.
export const GAME_FONT = 'Baloo2_800ExtraBold';
export const WOOD_INK = '#4A2C14';
export const CREAM = '#FFF6E0';

// Oyun yazısı. light: koyu zemin üstünde krem yazı, ince koyu gölgeyle okunur.
export function GText({
  children,
  size = 16,
  light,
  color,
  style,
  lines = 1,
}: {
  children: ReactNode;
  size?: number;
  light?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  lines?: number;
}) {
  return (
    <Text
      maxFontSizeMultiplier={1.0}
      numberOfLines={lines}
      style={[
        { fontFamily: GAME_FONT, fontSize: size, lineHeight: Math.round(size * 1.25), color: color ?? (light ? CREAM : WOOD_INK) },
        light && { textShadowColor: 'rgba(60,30,8,0.95)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 2 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type Kind3 = 'plaque' | 'btn_green' | 'btn_red' | 'btn_wood' | 'track' | 'fill';
// Sol-orta-sağ üç parçadan uzayan şerit. İçerik ortalanır; yükseklik verilir, genişlik stilden gelir.
export function Bar3({
  kind,
  height,
  style,
  children,
}: {
  kind: Kind3;
  height: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const l = UI[`${kind}_l` as UIKey];
  const m = UI[`${kind}_m` as UIKey];
  const r = UI[`${kind}_r` as UIKey];
  const lw = Math.round((l.w * height) / l.h);
  const rw = Math.round((r.w * height) / r.h);
  return (
    <View style={[{ height, minWidth: lw + rw }, style]}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
        <Image source={l.src} style={{ width: lw, height }} />
        {/* orta parça uçların altına yarım piksel taşar: aralarında çizgi kalmaz */}
        <Image source={m.src} resizeMode="stretch" style={{ flex: 1, height, marginHorizontal: -0.5 }} />
        <Image source={r.src} style={{ width: rw, height }} />
      </View>
      {children}
    </View>
  );
}

// Çiftliğin üstündeki düğme: yeşil (asıl iş), kırmızı (ödül), beyaz (ikincil). Basınca hafifçe küçülür. Kapalıyken soluklaşır.
// (Adı eski ahşap takımdan kaldı; görünüm sade takımla aynıdır.)
const SHADOW = {
  shadowColor: '#32200A',
  shadowOpacity: 0.22,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
} as const;
export function WoodButton({
  kind = 'green',
  label,
  art,
  icon,
  count,
  disabled,
  onPress,
  height = 50,
  size = 17,
  style,
}: {
  kind?: 'green' | 'red' | 'wood';
  label: string;
  art?: string; // çiftlik çizimi (ör. 'coin', 'sepet_dolu')
  icon?: ReactNode;
  count?: number; // köşedeki kırmızı sayaç
  disabled?: boolean;
  onPress: () => void;
  height?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const a = art ? ART[art] : null;
  const h = height - 4;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [{ opacity: disabled ? 0.62 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }, style]}
    >
      <View
        style={{
          height: h,
          borderRadius: h / 2,
          backgroundColor: kind === 'green' ? '#76BA48' : kind === 'red' ? '#E8604C' : '#FFFFFF',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: Math.round(h * 0.4),
          ...SHADOW,
        }}
      >
        {a ? <Image source={a.src} style={{ width: h * 0.56, height: h * 0.56 }} resizeMode="contain" /> : icon}
        <GText size={size} color={kind === 'wood' ? '#4A2E1C' : '#fff'}>
          {label}
        </GText>
      </View>
      {!!count && count > 0 && <Dot n={count} style={{ position: 'absolute', right: -4, top: -8 }} />}
    </Pressable>
  );
}

// Kırmızı sayaç noktası.
export function Dot({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          minWidth: 24,
          height: 24,
          borderRadius: 12,
          paddingHorizontal: 5,
          backgroundColor: '#E8604C',
          borderWidth: 2,
          borderColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <GText size={n > 99 ? 10 : 12} color="#fff" style={{ lineHeight: 15 }}>
        {n > 99 ? '99+' : n}
      </GText>
    </View>
  );
}

// Yuvarlak beyaz düğme; içine simge ya da çizim konur.
export function RoundButton({
  size = 44,
  label,
  onPress,
  children,
  style,
}: {
  size?: number;
  label: string;
  onPress: () => void;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.93 : 1 }],
          ...SHADOW,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

// Üst bardaki ad ve altın kutuları: beyaz hap.
export function Plaque({ height = 44, style, children }: { height?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const h = height - 4;
  return (
    <View
      style={[
        {
          height: h,
          borderRadius: h / 2,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Math.round(h * 0.36),
          ...SHADOW,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// İlerleme çubuğu (0..1).
export function WoodBar({ value, height = 16, style }: { value: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const v = Math.max(0, Math.min(1, value));
  const h = Math.max(6, Math.round(height * 0.6));
  return (
    <View style={[{ height: h, borderRadius: h / 2, backgroundColor: '#ECE0CC', overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, height: h, borderRadius: h / 2, backgroundColor: '#76BA48' }} />
    </View>
  );
}

// Seviye rozeti: yeşil daire içinde sayı.
export function LevelBadge({ level, size = 52 }: { level: number; size?: number }) {
  const d = Math.round(size * 0.86);
  return (
    <View
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: '#76BA48',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOW,
      }}
    >
      <GText size={Math.round(d * (level > 99 ? 0.34 : 0.42))} color="#fff">
        {level}
      </GText>
    </View>
  );
}

// Ahşap çerçeveli parşömen panel (dokuz parça). İçerik çerçevenin içine yerleşir.
export function WoodPanel({ children, style, cap = 34 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; cap?: number }) {
  const row = (t: 't' | 'm' | 'b', h?: number) => (
    <View style={{ flexDirection: 'row', height: h, flex: h ? undefined : 1 }}>
      <Image source={UI[`panel_${t}l` as UIKey].src} resizeMode="stretch" style={{ width: cap, height: h ?? '100%' }} />
      <Image
        source={UI[`panel_${t}m` as UIKey].src}
        resizeMode="stretch"
        style={{ flex: 1, height: h ?? '100%', marginHorizontal: -0.5 }}
      />
      <Image source={UI[`panel_${t}r` as UIKey].src} resizeMode="stretch" style={{ width: cap, height: h ?? '100%' }} />
    </View>
  );
  return (
    <View style={style}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
        {row('t', cap)}
        <View style={{ flex: 1, marginVertical: -0.5 }}>{row('m')}</View>
        {row('b', cap)}
      </View>
      {/* içerik ahşap çerçevenin içinde kalır (çerçeve kalınlığı ≈ cap × 0.55) */}
      <View style={{ padding: Math.round(cap * 0.86) }}>{children}</View>
    </View>
  );
}

// Ürün balonu: binanın üstünde, içinde hazır ürünün çizimi.
export function Bubble({ size = 38, children }: { size?: number; children?: ReactNode }) {
  const h = Math.round((size * UI.bubble.h) / UI.bubble.w);
  return (
    <View style={{ width: size, height: h, alignItems: 'center' }}>
      <Image source={UI.bubble.src} style={{ position: 'absolute', width: size, height: h }} />
      <View style={{ height: h * 0.8, justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

// ── Sade pencere takımı ──────────────────────────────────────────────────────────────────────────────────────────────
// Çiftlikteki pencereler çerçevesiz, açık renkli ve yuvarlak köşelidir; ürün çizimleri öne çıkar. Ahşap parçalar yalnızca
// çiftliğin üstündeki göstergelerde (seviye, altın, alt düğmeler) kalır.
export const SOFT_INK = '#4A2E1C';
export const SOFT_MUTED = '#8C6E54';
export const SOFT_LINE = '#F0E4D0';
export const SOFT_GREEN = '#76BA48';
export const FONT_BODY = 'Baloo2_500Medium';
export const FONT_BOLD = 'Baloo2_700Bold';

export function SoftPanel({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle>; cap?: number }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFAF0',
          borderRadius: 26,
          padding: 18,
          shadowColor: '#32200A',
          shadowOpacity: 0.28,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Düğme: yeşil asıl iş, kırmızı ödül ve dikkat, bej ikincil işler. art: yazının solunda küçük çizim (ör. altın).
export function SoftButton({
  label,
  onPress,
  kind = 'green',
  disabled,
  height = 46,
  size = 16,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'green' | 'red' | 'soft';
  disabled?: boolean;
  height?: number;
  size?: number;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = kind === 'green' ? SOFT_GREEN : kind === 'red' ? '#E8604C' : SOFT_LINE;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          minHeight: height,
          borderRadius: height / 2,
          backgroundColor: bg,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
          shadowColor: '#32200A',
          shadowOpacity: kind === 'soft' ? 0.08 : 0.18,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      {icon}
      <Text
        maxFontSizeMultiplier={1.0}
        numberOfLines={2}
        style={{
          fontFamily: GAME_FONT,
          fontSize: size,
          lineHeight: Math.round(size * 1.2),
          color: kind === 'soft' ? SOFT_INK : '#fff',
          textAlign: 'center',
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SoftClose({ onPress, size = 34 }: { onPress: () => void; size?: number }) {
  const w = Math.round(size * 0.34);
  const bar = (deg: string) => (
    <View
      style={{
        position: 'absolute',
        width: w * 1.5,
        height: 2.6,
        borderRadius: 2,
        backgroundColor: SOFT_INK,
        transform: [{ rotate: deg }],
      }}
    />
  );
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Kapat"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: SOFT_LINE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {bar('45deg')}
      {bar('-45deg')}
    </Pressable>
  );
}

export function SoftBar({
  value,
  height = 10,
  color,
  style,
}: {
  value: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: '#ECE0CC', overflow: 'hidden' }, style]}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? SOFT_GREEN }} />
    </View>
  );
}

// Ürün kutusunun zemini: beyaz, yumuşak köşeli. Seçiliyken yeşil kenarlık.
export function SoftTileBg({ on, radius = 16 }: { on?: boolean; radius?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderRadius: radius,
        borderWidth: on ? 2.5 : 1.5,
        borderColor: on ? SOFT_GREEN : SOFT_LINE,
        shadowColor: '#32200A',
        shadowOpacity: 0.1,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    />
  );
}
