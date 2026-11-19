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

// Kabartmalı düğme: yeşil (asıl iş), kırmızı (ödül), ahşap (ikincil). Basınca hafifçe çöker. Kapalıyken soluklaşır.
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
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        { opacity: disabled ? 0.72 : 1, transform: [{ translateY: pressed ? 2 : 0 }, { scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      <Bar3 kind={`btn_${kind}`} height={height} style={{ alignSelf: 'stretch' }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: Math.round(height * 0.42),
            paddingBottom: Math.round(height * 0.1), // düğmenin alt dudağı kadar yukarı
          }}
        >
          {a ? <Image source={a.src} style={{ width: height * 0.56, height: height * 0.56 }} resizeMode="contain" /> : icon}
          <GText light size={size}>
            {label}
          </GText>
        </View>
      </Bar3>
      {!!count && count > 0 && <Dot n={count} style={{ position: 'absolute', right: -4, top: -8 }} />}
    </Pressable>
  );
}

// Kırmızı sayaç noktası.
export function Dot({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image source={UI.dot.src} style={{ position: 'absolute', width: 26, height: 26 }} />
      <GText size={n > 99 ? 10 : 12} color="#fff" style={{ lineHeight: 15 }}>
        {n > 99 ? '99+' : n}
      </GText>
    </View>
  );
}

// Yuvarlak ahşap düğme; içine simge ya da çizim konur.
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
        { width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.93 : 1 }] },
        style,
      ]}
    >
      <Image source={UI.round.src} style={{ position: 'absolute', width: size, height: size }} />
      {children}
    </Pressable>
  );
}

// Ahşap levha: üst bardaki ad ve altın kutuları.
export function Plaque({ height = 44, style, children }: { height?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <Bar3 kind="plaque" height={height} style={style}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Math.round(height * 0.34) }}>
        {children}
      </View>
    </Bar3>
  );
}

// İlerleme çubuğu: ahşap oluk içinde yeşil dolgu (0..1).
export function WoodBar({ value, height = 16, style }: { value: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const v = Math.max(0, Math.min(1, value));
  const pad = Math.round(height * 0.26);
  return (
    <Bar3 kind="track" height={height} style={style}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: pad + 2 }}>
        {v > 0 && <Bar3 kind="fill" height={height - pad * 2} style={{ width: `${Math.max(8, Math.round(v * 100))}%` }} />}
      </View>
    </Bar3>
  );
}

// Seviye rozeti: yapraklı kalkan içinde sayı.
export function LevelBadge({ level, size = 52 }: { level: number; size?: number }) {
  const h = Math.round((size * UI.shield.h) / UI.shield.w);
  return (
    <View style={{ width: size, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={UI.shield.src} style={{ position: 'absolute', width: size, height: h }} />
      <GText size={Math.round(size * (level > 99 ? 0.3 : 0.36))} style={{ marginTop: -2 }}>
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
