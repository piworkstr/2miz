import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { Button, Muted, Screen } from '../components/ui';
import { useTheme } from '../lib/useTheme';

export default function Welcome() {
  const t = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 40 }}>
        <Image source={require('../../assets/icon.png')} style={{ width: 120, height: 120, borderRadius: 28 }} />
        <Image source={require('../../assets/wordmark.png')} style={{ width: 240, height: 68 }} resizeMode="contain" accessibilityLabel="us.daily" />
        <Muted style={{ textAlign: 'center', fontSize: 16, lineHeight: 23 }}>
          Her gün küçük bir görev, birlikte büyüyen bir hikaye.
        </Muted>
      </View>
      <View style={{ gap: 12 }}>
        <Muted style={{ textAlign: 'center' }}>Önce seni tanıyalım: 5 soruda sevgi dilini bulalım.</Muted>
        <Button label="Teste başla" onPress={() => router.push('/quiz')} />
        <Pressable onPress={() => router.push({ pathname: '/login', params: { mode: 'signin' } })} style={{ alignItems: 'center', padding: 10 }}>
          <Text style={{ color: t.colors.primary, fontSize: 15 }}>Zaten hesabım var</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
