import Ionicons from '@expo/vector-icons/Ionicons';
import { trDate } from '../lib/date';
import { router } from 'expo-router';
import { Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import { Avatar } from '../components/Avatar';
import { DreamBoard } from '../components/DreamBoard';
import { Card, Muted, Screen, T } from '../components/ui';
import { DART } from '../lib/dreamArt';
import { bay, BAYS, BOATS, homeOf, HOUSE_LV, houseLevel, seaOf } from '../lib/dreams';
import { farmOf, farmSummary, levelOf } from '../lib/farm';
import { ART } from '../lib/farmArt';
import { useOpenScene, usePages } from '../lib/scenes';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

// Hayalimiz: çiftin gerçek hayali, hedef yılı ve hayal dünyaları. Altın dünyalarda ortak.
// Mavi Yolculuk ve Sahilde Ev yayında kapalı; üzerinde çalışılıp en iyi hâliyle açılacak.
const WORLDS_OPEN = false;
// Her dünyada yapılan şeyler gerçek hayatta yapılabilecek şeylerdir; birlikte yaşanan her sahne hayal defterine bir sayfa olur.
export default function DreamsScreen() {
  const t = useTheme();
  const { user, couple, profile, partnerProfile, partnerName } = useSession();
  const openSea = useOpenScene(couple?.id, 'sea');
  const openHome = useOpenScene(couple?.id, 'home');
  const openFarm = useOpenScene(couple?.id, 'farm');
  const pages = usePages(couple?.id, 3);
  if (!user || !couple) return null;

  const farm = farmOf(couple);
  const sea = seaOf(couple);
  const home = homeOf(couple);
  const sum = farmSummary(farm, user.uid);
  const scenes = couple.sceneCount ?? 0;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const waitLine = (s: { by: string } | null | undefined, who: string) =>
    s ? (s.by === user!.uid ? `${partnerName} bekleniyor…` : `${partnerName} seni ${who} çağırıyor 💛`) : null;

  const world = (
    href: '/garden' | '/dream/sea' | '/dream/house',
    img: ImageSourcePropType,
    bg: string,
    title: string,
    line: string,
    stat: string,
    wait?: string | null,
  ) => (
    <Pressable key={href} onPress={() => router.push(href)}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10 }}>
        <View
          style={{
            width: 96,
            height: 84,
            borderRadius: 14,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image source={img} style={{ width: 84, height: 74 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontWeight: '700', fontSize: 16 }}>{title}</T>
          <Muted style={{ fontSize: 12, lineHeight: 16 }}>{line}</Muted>
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, fontWeight: '800', color: wait ? '#E8516A' : t.colors.primary }}>
            {wait ?? stat}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.colors.muted} />
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Geri">
          <Ionicons name="chevron-back" size={28} color={t.colors.text} />
        </Pressable>
        <Avatar p={profile} name={profile?.name ?? ''} size={36} showMood={false} />
        <View style={{ marginLeft: -14 }}>
          <Avatar p={partnerProfile} name={partnerName} size={36} showMood={false} />
        </View>
        <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: t.fonts.title, fontSize: 30, color: t.colors.text }}>
          Hayalimiz
        </Text>
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
          <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '900', color: '#7A5A00', fontSize: 15 }}>
            {farm.coins}
          </Text>
        </View>
      </View>

      <DreamBoard couple={couple} uid={user.uid} />

      {world(
        '/garden',
        ART.barn.src,
        '#8BC34F',
        'Bizim Çiftlik',
        'Ekin, birbirinizin ektiğini sulayın, hasadı birlikte kaldırın.',
        `Seviye ${levelOf(farm.xp).level} · ${sum.fields} tarla${sum.ready ? ` · ${sum.ready} hazır` : ''}`,
        waitLine(openFarm, 'hasada'),
      )}
      {WORLDS_OPEN && (
        <>
          {world(
            '/dream/sea',
            DART[sea.boat].src,
            '#4FA8D8',
            'Mavi Yolculuk',
            'Göcek’ten Kaş’a gerçek koylar. Yüzün, balık tutun, güvertede yemek yiyin, kumsalda kamp kurun.',
            sea.trip
              ? `${bay(sea.trip.to).name} yolunda ⛵`
              : `${sea.boatName} · ${Object.keys(sea.visited).length}/${BAYS.length} koy · ${BOATS[sea.boat].name}`,
            waitLine(openSea, 'koya'),
          )}
          {world(
            '/dream/house',
            DART[HOUSE_LV[houseLevel(home) - 1].art as keyof typeof DART].src,
            '#E99AB8',
            'Sahilde Ev',
            'Küçük beyaz evden begonvilli villaya. Sabah kahvesi, mangal akşamı, yıldızların altında bir dilek.',
            `${HOUSE_LV[houseLevel(home) - 1].name} · ${home.huzur} huzur`,
            waitLine(openHome, 'eve'),
          )}
        </>
      )}
      <Pressable onPress={() => router.push('/dream/book')}>
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T style={{ flex: 1, fontWeight: '700', fontSize: 16 }}>Hayal defteri</T>
            <Muted style={{ fontSize: 12 }}>{scenes} sahne</Muted>
            <Ionicons name="chevron-forward" size={18} color={t.colors.muted} />
          </View>
          {pages && pages.length > 0 ? (
            pages.map((p) => (
              <Muted key={p.id} style={{ fontSize: 13 }}>
                {trDate(new Date(p.startedAt), { month: 'short' })} · {p.place}
                {p.question ? ` · “${p.question}”` : ''}
              </Muted>
            ))
          ) : (
            <Muted style={{ fontSize: 12, lineHeight: 17 }}>
              Birlikte yaşadığınız her sahne (bir gün batımı, bir mangal akşamı) burada bir sayfa olur; baskı albüme de girer.
            </Muted>
          )}
        </Card>
      </Pressable>

      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <T style={{ fontWeight: '700', fontSize: 13 }}>Nasıl ilerler?</T>
        <Muted style={{ fontSize: 12, lineHeight: 17 }}>
          Günlük görevi ikiniz de yapınca altın kumbaraya düşer; çiftlikte “Al” ile toplarsınız. Tekne ve ev parayla değil birliktelikle
          büyür: sahneler tekneyi, huzur evi büyütür. Sahneler günün saatine bağlıdır; biri çağırır, diğeri gelir.
        </Muted>
      </View>
    </Screen>
  );
}
