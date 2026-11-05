import { Baloo2_500Medium, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { Caveat_500Medium, Caveat_700Bold, useFonts } from '@expo-google-fonts/caveat';
import { Oswald_400Regular, Oswald_500Medium } from '@expo-google-fonts/oswald';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../components/ui';
import { OnboardingProvider } from '../lib/onboarding';
import { SessionProvider, useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

function RootNavigator() {
  const { loading, user, couple, profile } = useSession();
  const ready = !!profile?.onboarded;
  const theme = useTheme();
  if (loading) return <Loading />;

  // Hesap yok → hoş geldin + sevgi dili testi + kayıt
  // Hesap var, tanışma bitmedi → ilgi alanları
  // Partner yok → eşleşme, hepsi tamam → uygulama
  return (
    <>
      <StatusBar style={theme.id === 'agir' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="quiz" />
          <Stack.Screen name="result" />
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={!!user && !ready}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={!!user && ready && !couple}>
          <Stack.Screen name="pair" />
        </Stack.Protected>
        <Stack.Protected guard={!!user && ready && !!couple}>
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
      <OnboardingProvider>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
