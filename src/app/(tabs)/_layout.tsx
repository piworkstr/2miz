import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { colors } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Bugün', tabBarIcon: icon('heart-outline') }} />
      <Tabs.Screen name="album" options={{ title: 'Albüm', tabBarIcon: icon('images-outline') }} />
      <Tabs.Screen name="coupons" options={{ title: 'Kuponlar', tabBarIcon: icon('gift-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Biz', tabBarIcon: icon('people-outline') }} />
    </Tabs>
  );
}
