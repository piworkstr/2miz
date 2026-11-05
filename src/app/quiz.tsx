import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Muted, Screen } from '../components/ui';
import { QUESTIONS, scoreAnswers, shuffled, type LoveLanguage } from '../lib/loveLanguage';
import { LOVE_LANGUAGES } from '../lib/loveLanguage';
import { useOnboarding } from '../lib/onboarding';
import { useTheme } from '../lib/useTheme';

export default function Quiz() {
  const t = useTheme();
  const { setLoveLanguage, setTheme } = useOnboarding();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<LoveLanguage[]>([]);

  const question = QUESTIONS[step];
  const options = useMemo(() => shuffled(question.options, step), [question, step]);

  function pick(lang: LoveLanguage) {
    const next = [...answers, lang];
    if (step < QUESTIONS.length - 1) {
      setAnswers(next);
      setStep(step + 1);
      return;
    }
    const result = scoreAnswers(next);
    setLoveLanguage(result);
    setTheme(LOVE_LANGUAGES[result].theme); // uygulama önerilen temaya hemen bürünür
    router.replace('/result');
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {QUESTIONS.map((_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? t.colors.primary : t.colors.border }}
          />
        ))}
      </View>
      <Muted>
        Soru {step + 1} / {QUESTIONS.length}
      </Muted>
      <Text style={{ fontFamily: t.fonts.title, fontSize: 34, lineHeight: 38, color: t.colors.text }}>{question.q}</Text>

      <View style={{ gap: 10, marginTop: 8 }}>
        {options.map((o) => (
          <Pressable
            key={o.text}
            onPress={() => pick(o.lang)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? t.colors.primarySoft : t.colors.card,
              borderColor: pressed ? t.colors.primary : t.colors.border,
              borderWidth: 1.5,
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 16,
            })}
          >
            <Text style={{ fontSize: 16, color: t.colors.text, lineHeight: 22 }}>{o.text}</Text>
          </Pressable>
        ))}
      </View>

      {step > 0 && (
        <Pressable
          onPress={() => {
            setAnswers(answers.slice(0, -1));
            setStep(step - 1);
          }}
          style={{ alignItems: 'center', padding: 10 }}
        >
          <Text style={{ color: t.colors.muted }}>Geri</Text>
        </Pressable>
      )}
    </Screen>
  );
}
