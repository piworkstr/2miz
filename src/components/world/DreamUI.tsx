import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Pressable, ScrollView, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ART } from '../../lib/farmArt';

// Hayal dünyalarının ortak parçaları: üst bilgi, alt panel, düğmeler, dükkân.
export const INK = '#2B1D22';
export const MUTED = '#8A7479';
export const GREEN = '#5FA83A';
const pill = {
  backgroundColor: 'rgba(255,255,255,0.94)',
  borderRadius: 999,
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 2,
} as const;

export function DreamHud({ title, sub, coins, left }: { title: string; sub: string; coins: number; left?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        accessibilityLabel="Geri"
        style={[pill, { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }]}
      >
        <Ionicons name="chevron-back" size={22} color={INK} />
      </Pressable>
      <View style={[pill, { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 3, paddingRight: 12 }]}>
        {left}
        <View>
          <Text style={{ fontWeight: '800', fontSize: 13, color: INK }}>{title}</Text>
          <Text style={{ fontSize: 11, color: MUTED }}>{sub}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: '#FFF3C4',
          borderRadius: 999,
          paddingVertical: 4,
          paddingLeft: 4,
          paddingRight: 10,
        }}
      >
        <Image source={ART.coin.src} style={{ width: 24, height: 21 }} />
        <Text style={{ fontWeight: '900', color: '#7A5A00', fontSize: 15 }}>{coins}</Text>
      </View>
    </View>
  );
}

export function DreamToast({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 50, left: 24, right: 24, alignItems: 'center' }}>
      <Text
        numberOfLines={2}
        style={{
          backgroundColor: 'rgba(43,29,34,0.86)',
          color: '#fff',
          fontWeight: '700',
          fontSize: 12,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export function DreamSheet({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        padding: 14,
        paddingBottom: insets.bottom + 14,
        gap: 10,
        shadowColor: '#0A283C',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {children}
    </View>
  );
}

export function Btn({
  label,
  onPress,
  kind = 'green',
  disabled,
  flex,
}: {
  label: string;
  onPress: () => void;
  kind?: 'green' | 'soft' | 'accent' | 'sea';
  disabled?: boolean;
  flex?: boolean;
}) {
  const bg = kind === 'green' ? GREEN : kind === 'accent' ? '#E8516A' : kind === 'sea' ? '#2B8CC0' : '#F3EEE8';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
        minHeight: 46,
        borderRadius: 23,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: kind === 'soft' ? INK : '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Head({ img, title, onClose }: { img?: ImageSourcePropType; title: string; onClose?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {img && <Image source={img} style={{ width: 36, height: 32 }} resizeMode="contain" />}
      <Text style={{ flex: 1, fontWeight: '900', fontSize: 17, color: INK }}>{title}</Text>
      {onClose && (
        <Pressable
          onPress={onClose}
          accessibilityLabel="Kapat"
          hitSlop={8}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3EEE8', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="close" size={18} color={INK} />
        </Pressable>
      )}
    </View>
  );
}

export function Note({ children, center }: { children: ReactNode; center?: boolean }) {
  return <Text style={{ color: MUTED, fontSize: 13, lineHeight: 18, textAlign: center ? 'center' : 'left' }}>{children}</Text>;
}

export type ShopItem = {
  id: string;
  img: ImageSourcePropType;
  name: string;
  price: string;
  sub: string;
  off?: boolean;
  onPress: () => void;
};
export function Shop({ list }: { list: ShopItem[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {list.map((it) => (
        <Pressable
          key={it.id}
          disabled={it.off}
          onPress={it.onPress}
          style={({ pressed }) => ({
            width: 88,
            paddingVertical: 6,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: pressed ? GREEN : '#F0E2DC',
            backgroundColor: '#FBFAF6',
            alignItems: 'center',
            opacity: it.off ? 0.4 : 1,
          })}
        >
          <Image source={it.img} style={{ width: 56, height: 44 }} resizeMode="contain" />
          <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 12, color: INK }}>
            {it.name}
          </Text>
          <Text numberOfLines={1} style={{ fontWeight: '900', fontSize: 11, color: '#7A5A00' }}>
            {it.price}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 10, color: MUTED }}>
            {it.sub}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function ActTile({
  img,
  title,
  sub,
  onPress,
  off,
}: {
  img: ImageSourcePropType;
  title: string;
  sub: string;
  onPress: () => void;
  off?: boolean;
}) {
  return (
    <Pressable
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        borderWidth: 1.5,
        borderColor: pressed ? '#2B8CC0' : '#F0E2DC',
        backgroundColor: '#FBFAF6',
        borderRadius: 14,
        paddingVertical: 6,
        alignItems: 'center',
        opacity: off ? 0.45 : 1,
      })}
    >
      <Image source={img} style={{ width: 40, height: 34 }} resizeMode="contain" />
      <Text style={{ fontSize: 11, fontWeight: '800', color: INK }}>{title}</Text>
      <Text numberOfLines={1} style={{ fontSize: 10, color: MUTED }}>
        {sub}
      </Text>
    </Pressable>
  );
}
