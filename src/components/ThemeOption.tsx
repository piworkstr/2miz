import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { tx, type Theme } from '../lib/theme';

// Her seçenek kendi temasının renk ve fontuyla çizilir, böylece seçmeden önce görürsün.
export function ThemeOption({
  theme,
  selected,
  saving,
  badge,
  onPress,
}: {
  theme: Theme;
  selected: boolean;
  saving?: boolean;
  badge?: string;
  onPress: () => void;
}) {
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.bg,
        borderRadius: Math.max(theme.radius.card, 8),
        borderWidth: selected ? 2.5 : 1,
        borderColor: selected ? c.primary : c.border,
        padding: 16,
        gap: 10,
        opacity: pressed || saving ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: theme.fonts.title, fontSize: theme.titleSize * 0.75, color: c.text }}>
          {tx(theme, theme.name)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {badge && (
            <Text
              maxFontSizeMultiplier={1.25}
              style={{
                backgroundColor: c.primary,
                color: c.onPrimary,
                fontSize: 11,
                fontWeight: '700',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {badge}
            </Text>
          )}
          {selected && <Ionicons name="checkmark-circle" size={24} color={c.primary} />}
        </View>
      </View>
      <Text maxFontSizeMultiplier={1.25} style={{ color: c.muted, fontFamily: theme.fonts.body, fontSize: 13 }}>
        {theme.tagline}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: c.primary,
            borderRadius: theme.radius.button,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text
            maxFontSizeMultiplier={1.25}
            style={{
              color: c.onPrimary,
              fontFamily: theme.fonts.button,
              fontWeight: theme.fonts.button ? undefined : '600',
              letterSpacing: theme.upper ? 1 : 0,
            }}
          >
            {tx(theme, theme.copy.accept)}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, color: c.text, fontFamily: theme.fonts.body, fontSize: 13 }} numberOfLines={1}>
          {theme.copy.hello('Elif')}
        </Text>
      </View>
    </Pressable>
  );
}
