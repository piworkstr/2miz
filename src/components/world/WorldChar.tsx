import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { avatarBustSvg } from '../../lib/avatar';
import type { Profile } from '../../lib/session';

// Hayal dünyalarındaki karakter: kişinin kendi avatarı (baş-omuz) + yürüyen bacaklar.
// (x, y) ayakların bastığı nokta, dünya koordinatında. Hedef değişince oraya yürür.
export const WALK_SPEED = 0.16; // px / ms

export function WorldChar({
  profile,
  name,
  x,
  y,
  z,
  tag,
  say,
  tool,
  onArrive,
}: {
  profile: Profile | null | undefined;
  name: string;
  x: number;
  y: number;
  z: number;
  tag?: string;
  say?: string;
  tool?: React.ReactNode;
  onArrive?: () => void;
}) {
  const pos = useRef(new Animated.ValueXY({ x, y })).current;
  const cur = useRef({ x, y });
  const leg = useRef(new Animated.Value(0)).current;
  const [walking, setWalking] = useState(false);
  const [flip, setFlip] = useState(false);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;

  useEffect(() => {
    const d = Math.hypot(x - cur.current.x, y - cur.current.y);
    if (d < 2) {
      arrive.current?.();
      return;
    }
    setFlip(x < cur.current.x);
    setWalking(true);
    const anim = Animated.timing(pos, {
      toValue: { x, y },
      duration: Math.max(250, d / WALK_SPEED),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      cur.current = { x, y };
      setWalking(false);
      if (finished) arrive.current?.();
    });
    return () => anim.stop();
  }, [x, y, pos]);

  useEffect(() => {
    if (!walking) {
      leg.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(leg, { toValue: 1, duration: 180, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(leg, { toValue: -1, duration: 360, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(leg, { toValue: 0, duration: 180, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [walking, leg]);

  const a = profile?.avatar;
  const rotA = leg.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });
  const rotB = leg.interpolate({ inputRange: [-1, 1], outputRange: ['18deg', '-18deg'] });
  const bob = leg.interpolate({ inputRange: [-1, 0, 1], outputRange: [-2, 0, -2] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, zIndex: z, transform: pos.getTranslateTransform() }}
    >
      <View
        style={{
          position: 'absolute',
          left: -14,
          top: -5,
          width: 28,
          height: 10,
          borderRadius: 14,
          backgroundColor: 'rgba(30,50,10,0.28)',
        }}
      />
      <View style={{ position: 'absolute', left: -26, top: -62, width: 52, alignItems: 'center', transform: [{ scaleX: flip ? -1 : 1 }] }}>
        <Animated.View style={{ width: 52, height: 52, marginBottom: -3, zIndex: 2, transform: [{ translateY: bob }] }}>
          {a?.kind === 'drawn' ? (
            <SvgXml xml={avatarBustSvg(a.opts)} width={52} height={52} />
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>
              {a?.kind === 'photo' ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${a.photo}` }}
                  style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#fff' }}
                />
              ) : (
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: '#FDE7EA',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                >
                  <Text style={{ color: '#E8516A', fontWeight: '800', fontSize: 15 }}>
                    {(name || '?').slice(0, 1).toLocaleUpperCase('tr-TR')}
                  </Text>
                </View>
              )}
              <View
                style={{
                  width: 30,
                  height: 14,
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                  backgroundColor: '#E8516A',
                  marginTop: -2,
                }}
              />
            </View>
          )}
        </Animated.View>
        <View style={{ flexDirection: 'row', gap: 3, height: 13 }}>
          {[rotA, rotB].map((r, k) => (
            <Animated.View key={k} style={{ width: 7, height: 13, borderRadius: 3, overflow: 'hidden', transform: [{ rotate: r }] }}>
              <View style={{ height: 9, backgroundColor: '#3D5A80' }} />
              <View style={{ height: 4, backgroundColor: '#5B3A29' }} />
            </Animated.View>
          ))}
        </View>
        {tool}
      </View>
      {!!tag && (
        <View style={{ position: 'absolute', top: -80, left: -40, width: 80, alignItems: 'center' }}>
          <Text
            style={{
              color: '#fff',
              fontSize: 10,
              fontWeight: '800',
              backgroundColor: 'rgba(43,29,34,0.72)',
              paddingHorizontal: 6,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {tag}
          </Text>
        </View>
      )}
      {!!say && (
        <View style={{ position: 'absolute', top: -104, left: -90, width: 180, alignItems: 'center' }}>
          <Text
            style={{
              backgroundColor: '#fff',
              color: '#2B1D22',
              fontSize: 11,
              fontWeight: '800',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {say}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
