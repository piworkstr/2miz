import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Button, Muted, Screen } from '../components/ui';
import { EN_OPEN, LANGS, useL, useLang } from '../lib/i18n';
import { LAST_EMAIL_KEY } from '../lib/session';
import { useTheme } from '../lib/useTheme';

export default function Welcome() {
  const t = useTheme();
  const l = useL();
  const { lang, setLang } = useLang();
  // Bu telefonda daha önce giriş yapılmışsa (çıkış yapıp dönen kullanıcı) teste değil girişe yönlendir.
  const [returning, setReturning] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(LAST_EMAIL_KEY)
      .then((v) => setReturning(!!v))
      .catch(() => setReturning(false));
  }, []);
  const toSignIn = () => router.push({ pathname: '/login', params: { mode: 'signin' } });
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 40 }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 132, height: 132, borderRadius: 30 }} accessibilityLabel="2miz" />
        <Muted style={{ textAlign: 'center', fontSize: 16, lineHeight: 23 }}>
          {l('Her gün küçük bir görev, birlikte büyüyen bir hikaye.', 'A small task every day, a story that grows with you.')}
        </Muted>
      </View>
      <View style={{ gap: 12 }}>
        {returning ? (
          <>
            <Muted style={{ textAlign: 'center' }}>
              {l('Tekrar hoş geldin. Hesabınla giriş yap.', 'Welcome back. Sign in to your account.')}
            </Muted>
            <Button label={l('Giriş yap', 'Sign in')} onPress={toSignIn} />
            <Pressable onPress={() => router.push('/quiz')} style={{ alignItems: 'center', padding: 10 }}>
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontSize: 15 }}>
                {l('Yeni hesap açacağım (teste başla)', 'Create a new account (take the quiz)')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Muted style={{ textAlign: 'center' }}>
              {l(
                'Önce seni tanıyalım: 5 soruda sevgi dilini bulalım.',
                "Let's get to know you first: find your love language in 5 questions.",
              )}
            </Muted>
            <Button label={l('Teste başla', 'Take the quiz')} onPress={() => router.push('/quiz')} />
            <Pressable onPress={toSignIn} style={{ alignItems: 'center', padding: 10 }}>
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontSize: 15 }}>
                {l('Zaten hesabım var', 'I already have an account')}
              </Text>
            </Pressable>
          </>
        )}
        {/* İngilizce herkese açılana kadar dil seçimi burada görünmez (EN_OPEN, src/lib/i18n.tsx). */}
        {EN_OPEN && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
            {LANGS.map((o) => (
              <Pressable key={o.id} onPress={() => setLang(o.id)} style={{ padding: 6 }}>
                <Text
                  maxFontSizeMultiplier={1.25}
                  style={{ color: lang === o.id ? t.colors.text : t.colors.muted, fontSize: 13, fontWeight: lang === o.id ? '700' : '400' }}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
