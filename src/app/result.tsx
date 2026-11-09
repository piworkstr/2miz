import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { ThemeOption } from '../components/ThemeOption';
import { Button, Card, Muted, Screen } from '../components/ui';
import { LOVE_LANGUAGES } from '../lib/loveLanguage';
import { useOnboarding } from '../lib/onboarding';
import { THEME_LIST } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

export default function Result() {
  const t = useTheme();
  const { loveLanguage, setTheme } = useOnboarding();
  const lang = LOVE_LANGUAGES[loveLanguage ?? 'zaman'];

  return (
    <Screen>
      <View style={{ gap: 4, marginTop: 8 }}>
        <Muted>Senin sevgi dilin</Muted>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: t.fonts.title, fontSize: 44, lineHeight: 48, color: t.colors.primary }}>
          {lang.name}
        </Text>
      </View>
      <Card>
        <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 16, lineHeight: 23, color: t.colors.text, fontFamily: t.fonts.body }}>
          {lang.description}
        </Text>
        <Muted>Partnerin de testi çözünce görevleriniz ikinizin sevgi diline göre seçilecek.</Muted>
      </Card>

      <View style={{ gap: 4 }}>
        <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 17, fontWeight: '600', color: t.colors.text }}>
          Sana bir tema seçtik
        </Text>
        <Muted>Uygulamanın görünüşü ve konuşma tarzı. İstediğin zaman değiştirebilirsin.</Muted>
      </View>

      {THEME_LIST.map((theme) => (
        <ThemeOption
          key={theme.id}
          theme={theme}
          selected={theme.id === t.id}
          badge={theme.id === lang.theme ? 'Önerimiz' : undefined}
          onPress={() => setTheme(theme.id)}
        />
      ))}

      <Button label="Devam et" onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })} />
    </Screen>
  );
}
