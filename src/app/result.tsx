import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { ThemeOption } from '../components/ThemeOption';
import { Button, Card, Muted, Screen } from '../components/ui';
import { useL, useLang } from '../lib/i18n';
import { loveLanguage as loveLanguageOf } from '../lib/loveLanguage';
import { useOnboarding } from '../lib/onboarding';
import { themeList } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

export default function Result() {
  const t = useTheme();
  const { loveLanguage, setTheme } = useOnboarding();
  const l = useL();
  const { lang: uiLang } = useLang();
  const lang = loveLanguageOf(loveLanguage ?? 'zaman', uiLang);

  return (
    <Screen>
      <View style={{ gap: 4, marginTop: 8 }}>
        <Muted>{l('Senin sevgi dilin', 'Your love language')}</Muted>
        <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: t.fonts.title, fontSize: 44, lineHeight: 48, color: t.colors.primary }}>
          {lang.name}
        </Text>
      </View>
      <Card>
        <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 16, lineHeight: 23, color: t.colors.text, fontFamily: t.fonts.body }}>
          {lang.description}
        </Text>
        <Muted>
          {l(
            'Partnerin de testi çözünce görevleriniz ikinizin sevgi diline göre seçilecek.',
            'Once your partner takes the quiz too, your tasks will be picked for both of your love languages.',
          )}
        </Muted>
      </Card>

      <View style={{ gap: 4 }}>
        <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 17, fontWeight: '600', color: t.colors.text }}>
          {l('Sana bir tema seçtik', 'We picked a theme for you')}
        </Text>
        <Muted>
          {l(
            'Uygulamanın görünüşü ve konuşma tarzı. İstediğin zaman değiştirebilirsin.',
            'How the app looks and talks. You can change it anytime.',
          )}
        </Muted>
      </View>

      {themeList(uiLang).map((theme) => (
        <ThemeOption
          key={theme.id}
          theme={theme}
          selected={theme.id === t.id}
          badge={theme.id === lang.theme ? l('Önerimiz', 'Our pick') : undefined}
          onPress={() => setTheme(theme.id)}
        />
      ))}

      <Button label={l('Devam et', 'Continue')} onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })} />
    </Screen>
  );
}
