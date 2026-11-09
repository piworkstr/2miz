import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// "Liquid glass": arkası bulanık, yarı saydam, üstte ince ışık çizgisi, yumuşak gölge.
// Bütün menü takımları (sekme çubuğu, kısayollar, oyun düğmeleri) bunu kullanır.

export function Glass({
  children,
  style,
  radius = 24,
  tint,
  intensity = 45,
  strong,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  tint?: string; // renk tonu (ör. '#8C6BC2'); verilirse cam o renge çalar
  intensity?: number;
  strong?: boolean; // daha opak (yazı okunacak yüzeyler)
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.75)',
          shadowColor: tint ?? '#2B1D22',
          shadowOpacity: tint ? 0.35 : 0.14,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint="light"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tint ? hexA(tint, strong ? 0.55 : 0.32) : `rgba(255,255,255,${strong ? 0.62 : 0.38})` },
        ]}
      />
      {/* üst ışık: camın parlak kenarı */}
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

// Yuvarlak cam düğme: simge ortada; renk tonu verilirse cam o renkte parlar.
export function GlassCircle({
  size = 52,
  tint,
  active,
  onPress,
  disabled,
  accessibilityLabel,
  children,
  style,
}: {
  size?: number;
  tint?: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }, style]}
    >
      <Glass
        radius={size / 2}
        tint={tint}
        strong={active}
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      >
        {children}
      </Glass>
    </Pressable>
  );
}

export function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
