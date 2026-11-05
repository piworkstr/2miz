import { Baloo2_500Medium, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { Caveat_500Medium, Caveat_700Bold, useFonts } from '@expo-google-fonts/caveat';
import { Oswald_400Regular, Oswald_500Medium } from '@expo-google-fonts/oswald';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../components/ui';
import { SessionProvider, useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

function RootNavigator() {
  const { loading, user, couple } = useSession();
  const theme = useTheme();
  if (loading) return <Loading />;

  // Giriş yoksa → giriş ekranı, giriş var ama partner yoksa → eşleşme, ikisi de varsa → uygulama.
  return (
    <>
      <StatusBar style={theme.id === 'agir' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
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
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Caveat_500Medium,
    Caveat_700Bold,
    Oswald_400Regular,
    Oswald_500Medium,
    Baloo2_500Medium,
    Baloo2_700Bold,
  });
  if (!fontsLoaded) return <Loading />;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
