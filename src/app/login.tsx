import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { ageFrom, DateInput, toDateKey, type DateParts } from '../components/DateInput';
import { Button, ErrorText, Input, Muted, Screen } from '../components/ui';
import { auth, db } from '../lib/firebase';
import { useOnboarding } from '../lib/onboarding';
import { useTheme } from '../lib/useTheme';

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'E-posta adresi geçerli görünmüyor.';
    case 'auth/email-already-in-use':
      return 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.';
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalı.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-posta ya da şifre hatalı.';
    case 'auth/network-request-failed':
      return 'İnternet bağlantını kontrol et.';
    default:
      return 'Bir şeyler ters gitti, tekrar dene.';
  }
}

export default function Login() {
  const t = useTheme();
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
      if (!name.trim()) return setError('Partnerinin göreceği adını yaz.');
      birthDate = toDateKey(birth);
      if (!birthDate) return setError('Doğum tarihini gün / ay / yıl olarak gir.');
      if (ageFrom(birthDate) < 18) return setError('2miz, 18 yaş ve üzeri içindir.');
    }
    if (!email.trim() || !password) return setError('E-posta ve şifre gerekli.');

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
          onboarded: false,
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e: unknown) {
      setError(friendlyError((e as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: 4, marginTop: 16, marginBottom: 8 }}>
          <Text style={{ fontFamily: t.fonts.title, fontSize: 40, lineHeight: 46, color: t.colors.text }}>
            {mode === 'signup' ? 'Hesabını oluştur' : 'Tekrar hoş geldin'}
          </Text>
          {mode === 'signup' && <Muted>Son bir adım, sonra partnerini bağlayacağız.</Muted>}
        </View>

        {mode === 'signup' && (
          <>
            <Input placeholder="Adın" value={name} onChangeText={setName} autoCapitalize="words" />
            <View style={{ gap: 6 }}>
              <Muted style={{ fontSize: 13 }}>Doğum tarihin</Muted>
              <DateInput value={birth} onChange={setBirth} />
            </View>
          </>
        )}
        <Input
          placeholder="E-posta"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Input placeholder="Şifre" value={password} onChangeText={setPassword} secureTextEntry />
        <ErrorText>{error}</ErrorText>

        <Button label={mode === 'signup' ? 'Hesap oluştur' : 'Giriş yap'} onPress={submit} busy={busy} />
        <Pressable
          onPress={() => (mode === 'signin' && !loveLanguage ? router.replace('/welcome') : setMode(mode === 'signup' ? 'signin' : 'signup'))}
          style={{ alignItems: 'center', padding: 8 }}
        >
          <Text style={{ color: t.colors.primary, fontSize: 15 }}>
            {mode === 'signup' ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
