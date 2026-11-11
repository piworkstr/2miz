import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

// scroll=false: sürüklemeyle oynanan oyunlar (blok, tavla) kaydırma listesine girmez; yoksa parmak hareketi sayfayı kaydırır.
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 20, gap: 16 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// Temanın gövde fontu ve rengiyle yazı.
export function T({ children, style }: { children: ReactNode; style?: TextStyle | TextStyle[] }) {
  const t = useTheme();
  return (
    <Text maxFontSizeMultiplier={1.25} style={[{ color: t.colors.text, fontFamily: t.fonts.body, fontSize: 15 }, style as TextStyle]}>
      {children}
    </Text>
  );
}

export function Title({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.25}
      style={{ fontFamily: t.fonts.title, fontSize: t.titleSize, color: t.colors.text, lineHeight: t.titleSize * (t.upper ? 1.4 : 1.15) }}
    >
      {tx(t, children)}
    </Text>
  );
}

export function Display({ children, style }: { children: string; style?: TextStyle }) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.25}
      style={[
        { fontFamily: t.fonts.display, fontSize: t.displaySize, color: t.colors.text, lineHeight: t.displaySize * (t.upper ? 1.4 : 1.15) },
        style,
      ]}
    >
      {tx(t, children)}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return (
    <Text maxFontSizeMultiplier={1.25} style={[{ fontSize: 14, color: t.colors.muted, lineHeight: 20, fontFamily: t.fonts.body }, style]}>
      {children}
    </Text>
  );
}

export function Pill({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.25}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: t.accentBar ? 'transparent' : t.colors.primarySoft,
        color: t.colors.primary,
        fontSize: 12,
        fontWeight: '600',
        fontFamily: t.fonts.button,
        letterSpacing: t.upper ? 1.5 : 0,
        paddingHorizontal: t.accentBar ? 0 : 10,
        paddingVertical: t.accentBar ? 0 : 4,
        borderRadius: t.radius.pill,
        overflow: 'hidden',
      }}
    >
      {tx(t, children)}
    </Text>
  );
}

export function Card({ children, style, accent }: { children: ReactNode; style?: ViewStyle; accent?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.card,
          borderRadius: t.radius.card,
          borderWidth: t.id === 'asko' ? 2 : 1,
          borderColor: t.colors.border,
          padding: 18,
          gap: 12,
        },
        accent && t.accentBar && { borderLeftWidth: 3, borderLeftColor: t.colors.primary },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  busy?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', busy, style }: ButtonProps) {
  const t = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? t.colors.onPrimary : t.colors.onPrimarySoft;
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: t.radius.button,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          backgroundColor: primary ? t.colors.primary : t.accentBar ? 'transparent' : t.colors.primarySoft,
          borderWidth: !primary && t.accentBar ? 1 : 0,
          borderColor: t.colors.border,
        },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          maxFontSizeMultiplier={1.25}
          style={{
            fontSize: 16,
            fontWeight: t.fonts.button ? undefined : '600',
            fontFamily: t.fonts.button,
            letterSpacing: t.upper ? 1.5 : 0,
            color: fg,
          }}
        >
          {tx(t, label)}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.colors.muted}
      {...props}
      style={[
        {
          backgroundColor: t.id === 'agir' ? t.colors.bg : t.colors.card,
          borderWidth: 1,
          borderColor: t.colors.border,
          borderRadius: Math.min(t.radius.card, 14),
          paddingHorizontal: 14,
          paddingVertical: 14,
          fontSize: 16,
          fontFamily: t.fonts.body,
          color: t.colors.text,
        },
        props.style,
      ]}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const t = useTheme();
  if (!children) return null;
  return (
    <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontSize: 14, fontFamily: t.fonts.body }}>
      {children}
    </Text>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg }}>
      <ActivityIndicator color={t.colors.primary} size="large" />
    </View>
  );
}
