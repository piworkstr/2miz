import { Caveat_500Medium, Caveat_700Bold, useFonts } from '@expo-google-fonts/caveat';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../components/ui';
import { SessionProvider, useSession } from '../lib/session';
import { colors } from '../lib/theme';

function RootNavigator() {
  const { loading, user, couple } = useSession();
  if (loading) return <Loading />;

  // Giriş yoksa → giriş ekranı, giriş var ama partner yoksa → eşleşme, ikisi de varsa → uygulama.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !couple}>
        <Stack.Screen name="pair" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && !!couple}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Caveat_500Medium, Caveat_700Bold });
  if (!fontsLoaded) return <Loading />;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
