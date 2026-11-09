import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Text, View, type ImageSourcePropType } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { avatarHeadSvg } from '../../lib/avatar';
import type { Profile } from '../../lib/session';

// Hayal dünyalarındaki karakter: tam boy. Gövde dünyaya göre çizilmiş bir kıyafet (çiftlikte tulum),
// baş kişinin kendi avatarı. Yürürken adım kareleri değişir. (x, y) ayakların bastığı nokta, dünya koordinatında.
export const WALK_SPEED = 0.16; // px / ms

type Frames = { stand: ImageSourcePropType; a: ImageSourcePropType; b: ImageSourcePropType; ratio: number };
const BODY: Record<'m' | 'f', Frames> = {
  m: {
    stand: require('../../../assets/farm/body_m0.webp'),
    a: require('../../../assets/farm/body_m1.webp'),
    b: require('../../../assets/farm/body_m2.webp'),
    ratio: 1.34,
  },
  f: {
    stand: require('../../../assets/farm/body_f0.webp'),
    a: require('../../../assets/farm/body_f1.webp'),
    b: require('../../../assets/farm/body_f2.webp'),
    ratio: 1.376,
  },
};
const FEM_TOPS = new Set([
  'bob',
  'bun',
  'curly',
  'curvy',
  'straight01',
  'straight02',
  'straightAndStrand',
  'longButNotTooLong',
  'bigHair',
  'miaWallace',
  'frida',
  'froBand',
  'hijab',
]);
// Gövde seçimi: profilde cinsiyet yok; avatarın saç ve sakalından çıkarılır.
export function bodyOf(profile: Profile | null | undefined): 'm' | 'f' {
  const a = profile?.avatar;
  if (a?.kind === 'drawn') {
    if (a.opts.facialHair && a.opts.facialHair !== 'none') return 'm';
    if (FEM_TOPS.has(a.opts.top)) return 'f';
  }
  return 'm';
}

const BODY_H = 44; // gövde yüksekliği (dünya px)
const HEAD_W = 42; // baş genişliği
const HEAD_H = (HEAD_W * 200) / 280; // avatarHeadSvg viewBox 280×200
const NECK = 7; // başın gövde üstüne bindiği miktar (boyun kütüğünü örter)

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
  const [walking, setWalking] = useState(false);
  const [step, setStep] = useState(0); // 0 duruş, 1/2 adım
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

  // Adım kareleri: yürürken sol/sağ adım dönüşümlü
  useEffect(() => {
    if (!walking) {
      setStep(0);
      return;
    }
    let k = 1;
    setStep(1);
    const id = setInterval(() => {
      k = k === 1 ? 2 : 1;
      setStep(k);
    }, 170);
    return () => clearInterval(id);
  }, [walking]);

  const a = profile?.avatar;
  const body = BODY[bodyOf(profile)];
  const bodyW = BODY_H / body.ratio;
  const src = step === 0 ? body.stand : step === 1 ? body.a : body.b;
  const total = BODY_H + HEAD_H - NECK;
  const bob = step === 0 ? 0 : -1.5;

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
      <View
        style={{
          position: 'absolute',
          left: -30,
          top: -total - 1,
          width: 60,
          height: total,
          alignItems: 'center',
          transform: [{ scaleX: flip ? -1 : 1 }],
        }}
      >
        {/* gövde: ayaklar (x, y) noktasında */}
        <Image source={src} style={{ position: 'absolute', bottom: 0, width: bodyW, height: BODY_H }} resizeMode="contain" />
        {/* baş: boyun kütüğünün üstüne oturur */}
        <View style={{ position: 'absolute', top: bob, width: HEAD_W, height: HEAD_H, alignItems: 'center', justifyContent: 'flex-end' }}>
          {a?.kind === 'drawn' ? (
            <SvgXml xml={avatarHeadSvg(a.opts)} width={HEAD_W} height={HEAD_H} />
          ) : a?.kind === 'photo' ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${a.photo}` }}
              style={{ width: HEAD_H, height: HEAD_H, borderRadius: HEAD_H / 2, borderWidth: 2, borderColor: '#fff' }}
            />
          ) : (
            <View
              style={{
                width: HEAD_H,
                height: HEAD_H,
                borderRadius: HEAD_H / 2,
                backgroundColor: '#FDE7EA',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#fff',
              }}
            >
              <Text maxFontSizeMultiplier={1.0} style={{ color: '#E8516A', fontWeight: '800', fontSize: 15 }}>
                {(name || '?').slice(0, 1).toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
          )}
        </View>
        {tool}
      </View>
      {!!tag && (
        <View style={{ position: 'absolute', top: -total - 18, left: -40, width: 80, alignItems: 'center' }}>
          <Text
            maxFontSizeMultiplier={1.0}
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
        <View style={{ position: 'absolute', top: -total - 42, left: -90, width: 180, alignItems: 'center' }}>
          <Text
            maxFontSizeMultiplier={1.0}
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
