import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { ageFrom, DateInput, toDateKey, type DateParts } from '../components/DateInput';
import { Button, ErrorText, Input, Muted, Screen } from '../components/ui';
import { auth, db } from '../lib/firebase';
import { useL, useLang } from '../lib/i18n';
import { useOnboarding } from '../lib/onboarding';
import { useTheme } from '../lib/useTheme';

function friendlyError(code: string, l: (tr: string, en: string) => string): string {
  switch (code) {
    case 'auth/invalid-email':
      return l('E-posta adresi geçerli görünmüyor.', "That email address doesn't look right.");
    case 'auth/email-already-in-use':
      return l('Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.', 'There is already an account with this email. Try signing in.');
    case 'auth/weak-password':
      return l('Şifre en az 6 karakter olmalı.', 'Password must be at least 6 characters.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return l('E-posta ya da şifre hatalı.', 'Wrong email or password.');
    case 'auth/network-request-failed':
      return l('İnternet bağlantını kontrol et.', 'Check your internet connection.');
    default:
      return l('Bir şeyler ters gitti, tekrar dene.', 'Something went wrong, please try again.');
  }
}

export default function Login() {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { loveLanguage, theme } = useOnboarding();
  const [mode, setMode] = useState<'signup' | 'signin'>(params.mode === 'signin' ? 'signin' : 'signup');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<DateParts>({ d: '', m: '', y: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    let birthDate: string | null = null;
    if (mode === 'signup') {
      if (!name.trim()) return setError(l('Partnerinin göreceği adını yaz.', 'Enter the name your partner will see.'));
      birthDate = toDateKey(birth);
      if (!birthDate) return setError(l('Doğum tarihini gün / ay / yıl olarak gir.', 'Enter your date of birth as day / month / year.'));
      if (ageFrom(birthDate) < 18) return setError(l('2miz, 18 yaş ve üzeri içindir.', '2miz is for ages 18 and up.'));
    }
    if (!email.trim() || !password) return setError(l('E-posta ve şifre gerekli.', 'Email and password are required.'));

    setBusy(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: name.trim(),
          birthDate,
          theme: theme ?? 'standart',
          ...(loveLanguage ? { loveLanguage } : {}),
          lang,
          onboarded: false,
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e: unknown) {
      setError(friendlyError((e as { code?: string }).code ?? '', l));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: 4, marginTop: 16, marginBottom: 8 }}>
          <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: t.fonts.title, fontSize: 40, lineHeight: 46, color: t.colors.text }}>
            {mode === 'signup' ? l('Hesabını oluştur', 'Create your account') : l('Tekrar hoş geldin', 'Welcome back')}
          </Text>
          {mode === 'signup' && (
            <Muted>{l('Son bir adım, sonra partnerini bağlayacağız.', "One last step, then we'll connect your partner.")}</Muted>
          )}
        </View>

        {mode === 'signup' && (
          <>
            <Input placeholder={l('Adın', 'Your name')} value={name} onChangeText={setName} autoCapitalize="words" />
            <View style={{ gap: 6 }}>
              <Muted style={{ fontSize: 13 }}>{l('Doğum tarihin', 'Date of birth')}</Muted>
              <DateInput value={birth} onChange={setBirth} />
            </View>
          </>
        )}
        <Input
          placeholder={l('E-posta', 'Email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Input placeholder={l('Şifre', 'Password')} value={password} onChangeText={setPassword} secureTextEntry />
        <ErrorText>{error}</ErrorText>

        <Button label={mode === 'signup' ? l('Hesap oluştur', 'Create account') : l('Giriş yap', 'Sign in')} onPress={submit} busy={busy} />
        <Pressable
          onPress={() =>
            mode === 'signin' && !loveLanguage ? router.replace('/welcome') : setMode(mode === 'signup' ? 'signin' : 'signup')
          }
          style={{ alignItems: 'center', padding: 8 }}
        >
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontSize: 15 }}>
            {mode === 'signup'
              ? l('Zaten hesabın var mı? Giriş yap', 'Already have an account? Sign in')
              : l('Hesabın yok mu? Kayıt ol', "Don't have an account? Sign up")}
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
