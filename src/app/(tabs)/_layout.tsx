import Ionicons from '@expo/vector-icons/Ionicons';

import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoupleDock, DOCK_GAP, DOCK_H, dockOn } from '../../components/CoupleDock';
import { Glass, hexA } from '../../components/Glass';
import { InviteModal } from '../../components/InviteModal';
import { useUnreadCount } from '../../lib/chat';
import { useDeviceStamp } from '../../lib/deviceStamp';
import { usePushSetup } from '../../lib/push';
import { useSession } from '../../lib/session';
import { tx, type ThemeId } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Her temanın kendi sekme simgeleri var (dolu simgeler: yazı yok, simge konuşur).
const ICONS: Record<ThemeId, [IconName, IconName, IconName, IconName, IconName]> = {
  standart: ['heart', 'chatbubbles', 'images', 'gift', 'people'],
  agir: ['flash', 'radio', 'archive', 'ticket', 'shield'],
  asko: ['heart', 'chatbubble-ellipses', 'images', 'gift', 'happy'],
};
// Sekme renkleri: her sekmenin kendi tonu, seçiliyken cam o renge çalar.
const TINTS = ['#E8516A', '#5B8DB8', '#8C6BC2', '#E0A43A', '#4FA37E'];

export const TAB_BAR_H = 64;

// Yüzen cam sekme çubuğu: ekranın altında, kenarlardan açık, arkası bulanık.
function GlassTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();
  const icons = ICONS[t.id];
  const { couple } = useSession();
  // Çift şeridi sohbet sekmesinde gizlenir: yazı alanına yer kalsın.
  const dock = dockOn(couple) && state.routes[state.index]?.name !== 'chat';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 8, gap: DOCK_GAP }}>
      {dock && <CoupleDock />}
      <Glass
        radius={TAB_BAR_H / 2}
        intensity={60}
        style={{ height: TAB_BAR_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const tint = TINTS[i] ?? t.colors.primary;
          const onPress = () => {
            const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigateToTab(route.key);
          };
          const badge = route.name === 'chat' && unread > 0 ? (unread > 9 ? '9+' : String(unread)) : null;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={typeof options.title === 'string' ? options.title : route.name}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? hexA(tint, 0.22) : 'transparent',
                  borderWidth: focused ? 1 : 0,
                  borderColor: 'rgba(255,255,255,0.9)',
                }}
              >
                <Ionicons name={icons[i]} size={focused ? 26 : 23} color={focused ? tint : t.colors.muted} />
                {!!badge && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 4,
                      backgroundColor: t.colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text maxFontSizeMultiplier={1.0} style={{ color: t.colors.onPrimary, fontSize: 10, fontWeight: '800' }}>
                      {badge}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { user, couple } = useSession();
  usePushSetup(user?.uid);
  useDeviceStamp(couple, user?.uid);
  const pad = TAB_BAR_H + insets.bottom + 8;
  const dockPad = dockOn(couple) ? DOCK_H + DOCK_GAP : 0;
  const label = (s: string) => tx(t, s);

  return (
    <>
      <InviteModal />
      <Tabs
        tabBar={(p) => <GlassTabBar {...p} />}
        screenOptions={{
          headerShown: false,
          // İçerik yüzen çubuğun altında kalmasın.
          sceneStyle: { backgroundColor: t.colors.bg, paddingBottom: pad + dockPad },
        }}
      >
        <Tabs.Screen name="index" options={{ title: label(t.copy.tabs.today) }} />
        <Tabs.Screen
          name="chat"
          options={{ title: label(t.copy.tabs.chat), sceneStyle: { backgroundColor: t.colors.bg, paddingBottom: pad } }}
        />
        <Tabs.Screen name="album" options={{ title: label(t.copy.tabs.album) }} />
        <Tabs.Screen name="coupons" options={{ title: label(t.copy.tabs.coupons) }} />
        <Tabs.Screen name="profile" options={{ title: label(t.copy.tabs.us) }} />
      </Tabs>
    </>
  );
}
