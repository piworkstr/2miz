import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import { InviteModal } from '../../components/InviteModal';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { tx, type ThemeId } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Her temanın kendi sekme simgeleri var.
const ICONS: Record<ThemeId, [IconName, IconName, IconName, IconName]> = {
  standart: ['heart-outline', 'images-outline', 'gift-outline', 'people-outline'],
  agir: ['flash-outline', 'archive-outline', 'ticket-outline', 'shield-outline'],
  asko: ['heart', 'images', 'gift', 'happy-outline'],
};

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const [today, album, coupons, us] = ICONS[t.id];
  const label = (s: string) => tx(t, s);

  return (
    <>
    <InviteModal />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.muted,
        tabBarStyle: { backgroundColor: t.colors.tabBar, borderTopColor: t.colors.border },
        tabBarLabelStyle: { fontFamily: t.fonts.button, letterSpacing: t.upper ? 1 : 0 },
        sceneStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: label(t.copy.tabs.today), tabBarIcon: icon(today) }} />
      <Tabs.Screen name="album" options={{ title: label(t.copy.tabs.album), tabBarIcon: icon(album) }} />
      <Tabs.Screen name="coupons" options={{ title: label(t.copy.tabs.coupons), tabBarIcon: icon(coupons) }} />
      <Tabs.Screen name="profile" options={{ title: label(t.copy.tabs.us), tabBarIcon: icon(us) }} />
    </Tabs>
    </>
  );
}
