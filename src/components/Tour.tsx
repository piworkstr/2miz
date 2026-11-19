import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ART } from '../lib/farmArt';
import { useL } from '../lib/i18n';
import { markTour, tourSeen } from '../lib/invite';

// Kaydırmalı tanıtım kartları: eşleşince bir kez (uygulama), çiftliğe ilk girişte bir kez (çiftlik). Her adımda "Geç" var.
type IconName = ComponentProps<typeof Ionicons>['name'];
type Step = { art: ReactNode; title: [string, string]; body: [string, string] };

const ROSE = '#E8516A';
const PINK = '#F7A1AE';
const SOFT = '#FDECEF';
const INK = '#4A1D2B';
const MUTED = '#8A6470';
const DEEP = '#8E3A59';

function Polaroid() {
  return (
    <View
      style={{
        width: 150,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        paddingBottom: 12,
        transform: [{ rotate: '-5deg' }],
        borderWidth: 1,
        borderColor: '#F1DCD4',
      }}
    >
      <View style={{ height: 118, borderRadius: 4, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="camera" size={38} color={DEEP} />
      </View>
      <Text
        maxFontSizeMultiplier={1.2}
        style={{ textAlign: 'center', marginTop: 8, color: MUTED, fontFamily: 'Caveat_700Bold', fontSize: 20 }}
      >
        1. gün
      </Text>
    </View>
  );
}

function Badge({ icon, extra }: { icon: IconName; extra?: IconName[] }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 170 }}>
      <View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={62} color={ROSE} />
      </View>
      {extra?.map((e, i) => (
        <View
          key={e}
          style={{
            position: 'absolute',
            left: i === 0 ? '50%' : undefined,
            right: i === 1 ? '50%' : undefined,
            marginLeft: i === 0 ? 46 : 0,
            marginRight: i === 1 ? 46 : 0,
            top: i === 0 ? 8 : 104,
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: i === 0 ? PINK : DEEP,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={e} size={24} color="#fff" />
        </View>
      ))}
    </View>
  );
}

function Farm({ items }: { items: string[] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, height: 170 }}>
      {items.map((k, i) => {
        const a = ART[k];
        if (!a) return null;
        const w = i === 0 ? 120 : 76;
        return <Image key={k} source={a.src as ImageSourcePropType} style={{ width: w, height: w * a.h }} resizeMode="contain" />;
      })}
    </View>
  );
}

const APP_STEPS: Step[] = [
  {
    art: <Polaroid />,
    title: ['Her gün bir iz', 'A mark every day'],
    body: [
      'Günün görevini ikiniz de yapın, selfie’niz albüme polaroid olarak düşsün. Seri uzadıkça puanınız artar.',
      'Both of you do the daily task and your selfies land in the album as a polaroid. Longer streaks earn more points.',
    ],
  },
  {
    art: <Badge icon="images" extra={['book', 'airplane']} />,
    title: ['Albümünüz kendiliğinden dolar', 'Your album fills itself'],
    body: [
      'Albüm sekmesinde bütün anılarınız durur. Seyahat albümü açabilir, dilerseniz basılı albüm sipariş edebilirsiniz.',
      'All your memories live in the Album tab. Start a trip album or order a printed one.',
    ],
  },
  {
    art: <Badge icon="chatbubbles" extra={['mic', 'happy']} />,
    title: ['Sadece ikinizin sohbeti', 'A chat just for you two'],
    body: [
      'Yazı, fotoğraf ve sesli mesaj. Ruh halini paylaş, sevdiğin fotoğrafı tek dokunuşla albüme ekle.',
      'Text, photos and voice notes. Share your mood and add a favourite photo to the album with one tap.',
    ],
  },
  {
    art: <Badge icon="game-controller" extra={['dice', 'leaf']} />,
    title: ['Birlikte oynayın', 'Play together'],
    body: [
      'Ana sayfadaki "Birlikte oyna" ile tavla, blok, hafıza ve "beni ne kadar tanıyorsun" oyunları açılır. "Bizim çiftlik"te birlikte ekip biçersiniz.',
      'Tap "Play together" on the home page for backgammon, blocks, memory and quizzes. Grow "Our farm" side by side.',
    ],
  },
  {
    art: <Badge icon="gift" extra={['star', 'heart']} />,
    title: ['Puanlarınla kupon aç', 'Spend points on coupons'],
    body: [
      'Kuponlar sekmesinde partnerine kupon yaz: "kahvaltı benden" gibi. O da puanlarıyla açsın. Hazırsanız başlayalım.',
      'Write coupons for your partner in the Coupons tab, like "breakfast is on me". They unlock them with points. Ready when you are.',
    ],
  },
];

const FARM_STEPS: Step[] = [
  {
    art: <Farm items={['bugday', 'havuc']} />,
    title: ['Ek, sula, topla', 'Plant, water, harvest'],
    body: [
      'Boş tarlaya dokun; yanında çıkan tohumu tarlaların üstünde gezdir. Ürün hazır olunca tarlaya dokun, çıkan orağı gezdirerek topla.',
      'Tap an empty field and drag a seed across your fields. When crops are ready, tap one and drag the sickle across to harvest.',
    ],
  },
  {
    art: <Farm items={['kumes', 'tavuk']} />,
    title: ['Hayvanlar ve ağaçlar', 'Animals and trees'],
    body: [
      'Dükkândan kümes, ağıl ve ağaç al. Yumurta, süt ve meyve belli aralıklarla hazır olur.',
      'Buy a coop, a pen and trees from the shop. Eggs, milk and fruit are ready at intervals.',
    ],
  },
  {
    art: <Farm items={['firin', 'ekmek']} />,
    title: ['Atölyelerde üret', 'Make things in workshops'],
    body: [
      'Dükkândaki "Atölye" sekmesinden değirmen, fırın ve diğerlerini kur. Eksik malzemeyi ve nereden geleceğini tarifte görürsün.',
      'Build the mill, bakery and more from the "Workshop" tab in the shop. Each recipe shows what is missing and where it comes from.',
    ],
  },
  {
    art: <Farm items={['posta', 'bugdayunu']} />,
    title: ['Siparişleri teslim et', 'Deliver orders'],
    body: [
      'Posta kutusundaki sipariş defterini aç, hazır siparişi seç. Çift girişe gelince üstlerine dokun; altın ve deneyim kazanırsın.',
      'Open the order book at the mailbox and pick a ready order. Tap the couple at the gate to hand it over for gold and experience.',
    ],
  },
];

export const TOURS = { app: APP_STEPS, farm: FARM_STEPS };
export type TourId = keyof typeof TOURS;

export function Tour({ id, visible, onClose }: { id: TourId; visible: boolean; onClose: () => void }) {
  const steps = TOURS[id];
  const l = useL();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (visible) setI(0);
  }, [visible]);
  const last = i === steps.length - 1;
  const go = (n: number) => {
    setI(n);
    ref.current?.scrollTo({ x: n * width, animated: true });
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: SOFT, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 16 }}>
        <Pressable onPress={onClose} hitSlop={14} style={{ alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 8 }}>
          <Text maxFontSizeMultiplier={1.25} style={{ color: '#B93A55', fontSize: 16, fontWeight: '600' }}>
            {l('Geç', 'Skip')}
          </Text>
        </Pressable>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {steps.map((s) => (
            <View key={s.title[0]} style={{ width, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 14 }}>
              {s.art}
              <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 24, fontWeight: '700', color: INK, textAlign: 'center', marginTop: 12 }}>
                {l(s.title[0], s.title[1])}
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 16, lineHeight: 23, color: MUTED, textAlign: 'center' }}>
                {l(s.body[0], s.body[1])}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
          {steps.map((s, n) => (
            <View
              key={s.title[0]}
              style={{ width: n === i ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: n === i ? ROSE : PINK }}
            />
          ))}
        </View>
        <Pressable
          onPress={() => (last ? onClose() : go(i + 1))}
          style={({ pressed }) => ({
            marginHorizontal: 24,
            minHeight: 52,
            borderRadius: 26,
            backgroundColor: ROSE,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text maxFontSizeMultiplier={1.25} style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
            {last ? l('Başlayalım', "Let's start") : l('Devam', 'Next')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// Koşul sağlanınca turu bir kez gösterir (telefon başına). Kapatınca bir daha açılmaz.
export function TourOnce({ id, when }: { id: TourId; when: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!when) return;
    let alive = true;
    tourSeen(id).then((seen) => {
      if (alive && !seen) setOpen(true);
    });
    return () => {
      alive = false;
    };
  }, [id, when]);
  return (
    <Tour
      id={id}
      visible={open}
      onClose={() => {
        setOpen(false);
        markTour(id);
      }}
    />
  );
}
