import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Input, Muted, Screen } from '../components/ui';
import { auth, db } from '../lib/firebase';
import { THEMES } from '../lib/theme';

// Giriş ve eşleşme, tema seçilmeden önce görüldüğü için Standart temayla çizilir.
const { colors, fonts } = THEMES.standart;

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
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (mode === 'signup' && !name.trim()) return setError('Partnerinin göreceği adını yaz.');
    if (!email.trim() || !password) return setError('E-posta ve şifre gerekli.');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(db, 'users', cred.user.uid), { name: name.trim() });
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
        <View style={styles.hero}>
          <Text style={styles.logo}>UsDaily</Text>
          <Muted style={{ textAlign: 'center' }}>Her gün küçük bir görev, birlikte büyüyen bir hikaye.</Muted>
        </View>

        {mode === 'signup' && (
          <Input placeholder="Adın" value={name} onChangeText={setName} autoCapitalize="words" />
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
        <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={styles.switch}>
          <Text style={styles.switchText}>
            {mode === 'signup' ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 48, marginBottom: 24, gap: 6 },
  logo: { fontFamily: fonts.title, fontSize: 64, color: colors.primary },
  switch: { alignItems: 'center', padding: 8 },
  switchText: { color: colors.primary, fontSize: 15 },
});
