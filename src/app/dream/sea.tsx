import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Avatar } from '../../components/Avatar';
import { ActTile, Btn, DreamHud, DreamSheet, DreamToast, Head, INK, MUTED, Note, Shop } from '../../components/world/DreamUI';
import { ScenePanel, type SceneMeta } from '../../components/world/ScenePanel';
import { DART } from '../../lib/dreamArt';
import {
  bay,
  BAYS,
  BOATS,
  castsLeft,
  dreamAction,
  FISH,
  fishOnBoard,
  seaOf,
  tripMins,
  type BoatId,
  type FishId,
  type SeaAction,
} from '../../lib/dreams';
import { farmOf, MIN, timeLeft } from '../../lib/farm';
import { notifyPartner } from '../../lib/push';
import { hourNow, startScene, useOpenScene, type Scene } from '../../lib/scenes';
import { useSession } from '../../lib/session';

// Mavi Yolculuk: gerçek koylar, iki ekran (harita ve koy), iki kişilik sahneler.
// Sahneler günün saatine bağlıdır: sabah kahve, gündüz yüzme ve balık, akşam yemek ve gün batımı, gece kamp.

export const SEA_SCENES: Record<string, SceneMeta> = {
  swim: { title: 'Yüzme', verb: 'birlikte yüzmek', reward: { coins: 10 } },
  dinner: { title: 'Akşam yemeği', verb: 'güvertede akşam yemeği', reward: { coins: 20 } },
  camp: { title: 'Kamp', verb: 'kumsalda kamp', reward: { coins: 20 } },
  sunset: { title: 'Gün batımı', verb: 'gün batımını izlemek', reward: { coins: 20 }, playMs: 7000 },
  coffee_sea: { title: 'Sabah kahvesi', verb: 'teknede sabah kahvesi', reward: { coins: 10 } },
};
type Tod = 'sabah' | 'gun' | 'aksam' | 'gece';
const todOf = (h: number): Tod => (h >= 6 && h < 11 ? 'sabah' : h < 17 ? 'gun' : h < 21 ? 'aksam' : 'gece');
const TINT: Record<string, [string, string] | null> = {
  '': null,
  sabah: ['rgba(255,215,150,0.4)', 'rgba(255,240,220,0.1)'],
  gun: null,
  aksam: ['rgba(255,150,60,0.45)', 'rgba(70,30,100,0.55)'],
  gece: ['rgba(10,20,70,0.6)', 'rgba(5,10,40,0.7)'],
};
type Fishing = { state: 'wait' | 'bite' | 'miss' | 'early' | 'done' | 'saving'; fish: FishId; bite: number };

function Who({ p, name, size = 44 }: { p: Parameters<typeof Avatar>[0]['p']; name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: '#fff',
        overflow: 'hidden',
        elevation: 3,
      }}
    >
      <Avatar p={p} name={name} size={size - 4} showMood={false} />
    </View>
  );
}

export default function SeaScreen() {
  const insets = useSafeAreaInsets();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [now, setNow] = useState(Date.now());
  const [map, setMap] = useState({ w: 0, h: 0 });
  const [screen, setScreen] = useState<'map' | 'bay'>('map');
  const [sel, setSel] = useState<string | null>(null); // haritada seçili koy
  const [shop, setShop] = useState(false);
  const [rename, setRename] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [fishing, setFishing] = useState<Fishing | null>(null);
  const bob = useRef(new Animated.Value(0)).current;
  const rock = useRef(new Animated.Value(0)).current;
  const sun = useRef(new Animated.Value(0)).current;
  const scene = useOpenScene(couple?.id, 'sea');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(rock, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rock, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [rock]);
  // Şamandıra
  useEffect(() => {
    if (!fishing || (fishing.state !== 'wait' && fishing.state !== 'bite')) return;
    const fast = fishing.state === 'bite';
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: fast ? 9 : -4,
          duration: fast ? 120 : 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, { toValue: 0, duration: fast ? 120 : 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    l.start();
    const t = setTimeout(
      () => setFishing((f) => (f && f.state === fishing.state ? { ...f, state: fishing.state === 'wait' ? 'bite' : 'miss' } : f)),
      fishing.state === 'wait' ? fishing.bite : 900,
    );
    return () => {
      l.stop();
      clearTimeout(t);
    };
  }, [fishing, bob]);

  if (!user || !couple || !partnerId) return null;
  const uid = user.uid;
  const myName = profile?.name ?? 'Ben';
  const sea = seaOf(couple, now);
  const farm = farmOf(couple);
  const here = bay(sea.at);
  const B = BOATS[sea.boat];
  const tod = todOf(hourNow());
  const scenes = couple.sceneCount ?? 0;
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2800);
  };

  async function act(x: SeaAction) {
    try {
      const r = await dreamAction(couple!.id, uid, myName, { w: 'sea', x });
      if (typeof r === 'string') {
        flash(r);
        return null;
      }
      if (x.a === 'sail')
        notifyPartner(partnerId!, r.text, 'Teknede ikiniz de varsınız. Varınca koya inin.', { type: 'mood', url: '/dream/sea' });
      if (x.a === 'boat') notifyPartner(partnerId!, r.text, 'Mavi Yolculuk', { type: 'mood', url: '/dream/sea' });
      if (x.a !== 'fish' && x.a !== 'eat' && x.a !== 'camp') flash(r.text);
      return r;
    } catch {
      flash('Olmadı, tekrar dene');
      return null;
    }
  }

  // İki kişilik sahne başlat
  async function begin(kind: string) {
    if (scene) return flash('Önce açık sahneyi bitirin.');
    if (sea.trip) return flash('Önce koya varın.');
    if (kind === 'dinner' && fishOnBoard(sea) <= 0) return flash('Önce balık tutun; yemek tekneden çıkar.');
    if (kind === 'camp' && !here.camp) return flash('Bu koyda kamp kurulmaz.');
    try {
      await startScene(couple!.id, uid, { world: 'sea', kind, place: here.name, windowMin: kind === 'sunset' ? 60 : 120 });
      notifyPartner(partnerId!, `${myName} seni ${SEA_SCENES[kind].verb} için çağırıyor`, `${here.name} · Mavi Yolculuk`, {
        type: 'mood',
        url: '/dream/sea',
      });
      // Sahne açıldıysa dünyayı da değiştir: balıklar ızgaraya, çadır kumsala.
      if (kind === 'dinner') await act({ a: 'eat' });
      if (kind === 'camp') await act({ a: 'camp' });
    } catch {
      flash('Sahne başlatılamadı');
    }
  }

  function startFishing() {
    if (castsLeft(sea, uid) <= 0) return flash('Bugün yeterince balık tuttunuz.');
    const pool = here.fish;
    setFishing({
      state: 'wait',
      fish: Math.random() < 0.12 ? 'ahtapot' : pool[Math.floor(Math.random() * pool.length)],
      bite: 1200 + Math.random() * 2600,
    });
  }
  async function pull() {
    if (!fishing) return;
    if (fishing.state === 'wait') {
      setFishing({ ...fishing, state: 'early' });
      await act({ a: 'fish', fish: null });
      return;
    }
    if (fishing.state === 'bite') {
      setFishing({ ...fishing, state: 'saving' });
      const r = await act({ a: 'fish', fish: fishing.fish });
      setFishing((f) => (f ? { ...f, state: r ? 'done' : 'miss' } : f));
      return;
    }
    if (fishing.state === 'miss') await act({ a: 'fish', fish: null });
    setFishing(null);
    startFishing();
  }

  // ---- harita ----
  const xy = (id: string) => {
    const b = bay(id);
    return { x: b.x * map.w, y: b.y * map.h };
  };
  let bp = { x: 0, y: 0, flip: false, k: 1 };
  if (map.w) {
    if (sea.trip) {
      const k = Math.min(1, (now - sea.trip.start) / (sea.trip.end - sea.trip.start));
      const a = xy(sea.trip.from);
      const b = xy(sea.trip.to);
      bp = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k + 30, flip: b.x < a.x, k };
    } else {
      const p = xy(sea.at);
      bp = { x: p.x, y: p.y + 30, flip: false, k: 1 };
    }
  }

  // ---- koy ekranı ----
  const live = scene && scene.status === 'live' ? scene : null;
  const kind = live?.kind ?? null;
  const playing = !!live && !!live.joinedAt && now < live.joinedAt + (SEA_SCENES[live.kind]?.playMs ?? 6000);
  const tint =
    kind === 'camp' ? 'gece' : kind === 'dinner' || kind === 'sunset' ? 'aksam' : kind === 'coffee_sea' ? 'sabah' : kind ? '' : tod;
  const tintCols = TINT[tint];
  useEffect(() => {
    if (kind === 'sunset' && playing) {
      sun.setValue(0);
      Animated.timing(sun, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true }).start();
    }
  }, [kind, playing, sun]);

  const rockY = rock.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const rockR = rock.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  const fishN = fishOnBoard(sea);
  const canCamp = here.camp && (tod === 'aksam' || tod === 'gece');
  const sceneBtn = (k: string, img: keyof typeof DART, sub: string, off: boolean) => (
    <ActTile key={k} img={DART[img].src} title={SEA_SCENES[k].title} sub={sub} onPress={() => begin(k)} off={off || !!scene} />
  );

  let sheet: React.ReactNode = null;
  if (fishing) {
    sheet = (
      <>
        {fishing.state === 'done' ? (
          <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
            <Image source={DART[fishing.fish].src} style={{ width: 150, height: 150 * DART[fishing.fish].h }} />
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 20, fontWeight: '900', color: INK }}>
              {FISH[fishing.fish].name}!
            </Text>
            <Note>Tekneye kondu. Akşam yemeğinde ızgarada.</Note>
          </View>
        ) : (
          <View style={{ height: 150, borderRadius: 16, backgroundColor: '#3FA4D2', overflow: 'hidden' }}>
            <Image
              source={DART.olta.src}
              style={{ position: 'absolute', left: 10, bottom: 6, width: 110, height: 116, transform: [{ rotate: '8deg' }] }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                left: '62%',
                top: '52%',
                width: 18,
                height: 18,
                borderRadius: 9,
                overflow: 'hidden',
                transform: [{ translateY: bob }],
              }}
            >
              <View style={{ flex: 1, backgroundColor: '#E53935' }} />
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            </Animated.View>
          </View>
        )}
        <Text maxFontSizeMultiplier={1.25} style={{ textAlign: 'center', fontWeight: '800', color: INK }}>
          {fishing.state === 'wait'
            ? 'Şamandıra batınca dokun!'
            : fishing.state === 'bite'
              ? 'Vurdu! Hemen çek!'
              : fishing.state === 'miss'
                ? 'Kaçtı… geç kaldın.'
                : fishing.state === 'early'
                  ? 'Erken çektin, balık kaçtı.'
                  : fishing.state === 'saving'
                    ? 'Çekiliyor…'
                    : `${castsLeft(sea, uid)} olta hakkın kaldı`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn flex kind="soft" label="Bitir" onPress={() => setFishing(null)} />
          {(fishing.state === 'wait' || fishing.state === 'bite') && <Btn flex kind="accent" label="Çek!" onPress={pull} />}
          {(fishing.state === 'miss' || fishing.state === 'early' || fishing.state === 'done') && castsLeft(sea, uid) > 0 && (
            <Btn flex kind="sea" label="Tekrar at" onPress={pull} />
          )}
        </View>
      </>
    );
  } else if (scene && screen === 'bay') {
    sheet = (
      <ScenePanel
        scene={scene}
        meta={SEA_SCENES[scene.kind] ?? { title: scene.kind, verb: '' }}
        coupleId={couple.id}
        uid={uid}
        partnerId={partnerId}
        partnerName={partnerName}
        profile={profile}
        partnerProfile={partnerProfile}
        onJoined={() =>
          notifyPartner(partnerId, `${myName} geldi 💛`, `${SEA_SCENES[scene.kind]?.title} başlıyor`, { type: 'mood', url: '/dream/sea' })
        }
      />
    );
  } else if (screen === 'bay') {
    const real = sea.realRoute.includes(here.id);
    sheet = (
      <>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '900', fontSize: 17, color: INK }}>
              {here.name}
            </Text>
            <Note>{here.note}</Note>
          </View>
          <Pressable
            onPress={() => act({ a: 'real', id: here.id })}
            accessibilityLabel="Gerçekte de gidelim"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: real ? '#E8516A' : '#FFF3F5',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text maxFontSizeMultiplier={1.25} style={{ color: real ? '#fff' : '#E8516A', fontSize: 20 }}>
              {real ? '♥' : '♡'}
            </Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {sceneBtn('swim', 'simit', 'ikiniz', here.id === 'kekova' || tod === 'gece')}
          <ActTile
            img={DART.olta.src}
            title="Balık tut"
            sub="tek başına"
            onPress={startFishing}
            off={castsLeft(sea, uid) <= 0 || !!scene}
          />
          {sceneBtn('dinner', 'masa', fishN ? `${fishN} balık var` : 'önce balık tut', !fishN || !(tod === 'aksam' || tod === 'gece'))}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {here.camp && sceneBtn('camp', 'cadir', sea.camps[here.id] ? 'çadır kurulu' : 'akşam', !canCamp)}
          {sceneBtn('sunset', 'gunbatimi', tod === 'aksam' ? 'şimdi' : 'akşam 17–21', tod !== 'aksam')}
          {sceneBtn('coffee_sea', 'masa', tod === 'sabah' ? 'şimdi' : 'sabah 06–11', tod !== 'sabah')}
        </View>
        <Note>
          Sahneler günün saatine bağlı: sabah kahve, akşam yemek ve gün batımı, gece kamp. Saat {String(hourNow()).padStart(2, '0')}:00.
        </Note>
      </>
    );
  } else if (shop) {
    sheet = (
      <>
        <Head img={DART[sea.boat].src} title={sea.boatName} onClose={() => setShop(false)} />
        <Shop
          list={(Object.keys(BOATS) as BoatId[]).map((id) => {
            const b = BOATS[id];
            const own = B.rank >= b.rank;
            return {
              id,
              img: DART[id].src,
              name: b.name,
              price: own ? 'Sizin' : `${b.cost} altın`,
              sub: own ? '' : `${b.need} ortak sahne`,
              off: own || b.rank !== B.rank + 1 || scenes < b.need || farm.coins < b.cost,
              onPress: () => act({ a: 'boat', boat: id }).then(() => setShop(false)),
            };
          })}
        />
        <Note>Tekneyi para değil birliktelik büyütür: {scenes} sahne yaşadınız. Büyük tekne uzak koylara gider.</Note>
        {rename === null ? (
          <Pressable onPress={() => setRename(sea.boatName)}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: MUTED, fontSize: 13, textDecorationLine: 'underline' }}>
              Tekneye isim ver
            </Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={rename}
              onChangeText={setRename}
              maxLength={24}
              style={{ flex: 1, borderWidth: 1, borderColor: '#F0E2DC', borderRadius: 10, padding: 8, color: INK }}
            />
            <Btn label="Kaydet" onPress={() => act({ a: 'rename', name: rename }).then(() => setRename(null))} />
          </View>
        )}
      </>
    );
  } else if (sea.trip) {
    sheet = (
      <>
        <Note center>
          {bay(sea.trip.to).name} yolundasınız ⛵ {timeLeft(sea.trip.end - now)} kaldı. {partnerName} de teknede.
        </Note>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E3EEF4', overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(bp.k * 100)}%`, height: 8, backgroundColor: '#2B8CC0' }} />
        </View>
      </>
    );
  } else if (sel && sel !== sea.at) {
    const t = bay(sel);
    const ok = B.rank >= t.rank;
    const need = Object.values(BOATS).find((b) => b.rank === t.rank)!;
    sheet = (
      <>
        <Head img={DART[t.id].src} title={t.name} onClose={() => setSel(null)} />
        <Note>
          {t.note}
          {sea.visited[t.id] ? ' Daha önce geldiniz.' : ''}
        </Note>
        {ok ? (
          <Btn
            kind="sea"
            label={`Yola çık · ${timeLeft(tripMins(sea, sea.at, t.id) * MIN)}`}
            onPress={() => act({ a: 'sail', to: t.id }).then(() => setSel(null))}
          />
        ) : (
          <Btn kind="soft" label={`Bu koy için ${need.name} lazım`} onPress={() => setShop(true)} />
        )}
      </>
    );
  } else {
    sheet = (
      <>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Image source={DART[here.id].src} style={{ width: 64, height: 64, borderRadius: 12 }} />
          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '900', fontSize: 16, color: INK }}>
              {here.name}’dasınız
            </Text>
            <Note>{here.note}</Note>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn
            flex
            kind="sea"
            label={scene ? `Koya in · ${SEA_SCENES[scene.kind]?.title ?? 'sahne'} açık` : 'Koya in'}
            onPress={() => setScreen('bay')}
          />
          <Btn kind="soft" label="Tekne" onPress={() => setShop(true)} />
        </View>
        <View>
          <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
            Gerçek rotamız
          </Text>
          <Note>
            {sea.realRoute.length
              ? sea.realRoute.map((id) => bay(id).name).join(' → ')
              : 'Koyda kalbe dokunun: “gerçekte de gidelim”. Liste buraya gelir.'}
          </Note>
        </View>
      </>
    );
  }

  // ---- koy sahnesi görünümü ----
  const stage = (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <Image
        source={DART[here.id].src}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
        resizeMode="cover"
      />
      {tintCols && (
        <Svg style={{ position: 'absolute', left: 0, top: 0 }} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="tint" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tintCols[0]} />
              <Stop offset="1" stopColor={tintCols[1]} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#tint)" />
          {tint === 'gece' &&
            [10, 30, 55, 75, 90, 45, 20, 65].map((x, i) => (
              <Circle key={i} cx={`${x}%`} cy={`${8 + ((i * 37) % 30)}%`} r={i % 3 === 0 ? 2 : 1.3} fill="#fff" opacity={0.9} />
            ))}
        </Svg>
      )}
      {kind === 'sunset' && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '68%',
            top: '34%',
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: '#FFC26B',
            shadowColor: '#FF8A3D',
            shadowOpacity: 0.9,
            shadowRadius: 30,
            transform: [{ translateY: sun.interpolate({ inputRange: [0, 1], outputRange: [0, 90] }) }],
          }}
        />
      )}
      {/* tekne */}
      <Animated.View
        style={{
          position: 'absolute',
          left: kind === 'camp' ? '76%' : '50%',
          top: kind === 'camp' ? '62%' : '52%',
          width: B.w,
          marginLeft: -B.w / 2,
          marginTop: -B.w * 0.4,
          transform: [{ translateY: rockY }, { rotate: rockR }],
        }}
      >
        <Image source={DART[sea.boat].src} style={{ width: B.w, height: B.w * DART[sea.boat].h }} />
        {kind !== 'camp' && kind !== 'swim' && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: -18,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <Who p={profile} name={myName} />
            {(kind === 'dinner' || kind === 'coffee_sea') && (
              <Image source={DART.masa.src} style={{ width: 60, height: 48 }} resizeMode="contain" />
            )}
            <Who p={partnerProfile} name={partnerName} />
          </View>
        )}
      </Animated.View>
      {kind === 'swim' && (
        <>
          <Animated.View style={{ position: 'absolute', left: '30%', top: '66%', transform: [{ translateY: rockY }] }}>
            <Who p={profile} name={myName} size={36} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: '62%', top: '70%', transform: [{ translateY: rockY }] }}>
            <Who p={partnerProfile} name={partnerName} size={36} />
          </Animated.View>
        </>
      )}
      {kind === 'camp' && (
        <>
          <Image
            source={DART.cadir.src}
            style={{ position: 'absolute', left: '2%', top: '26%', width: '28%', height: undefined, aspectRatio: 1 / DART.cadir.h }}
            resizeMode="contain"
          />
          <Image
            source={DART.ates.src}
            style={{ position: 'absolute', left: '35%', top: '36%', width: '13%', height: undefined, aspectRatio: 1 / DART.ates.h }}
            resizeMode="contain"
          />
          <View style={{ position: 'absolute', left: '26%', top: '41%' }}>
            <Who p={profile} name={myName} size={34} />
          </View>
          <View style={{ position: 'absolute', left: '48%', top: '41%' }}>
            <Who p={partnerProfile} name={partnerName} size={34} />
          </View>
        </>
      )}
      {scene?.status === 'waiting' && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: '42%', alignItems: 'center' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderRadius: 999,
              padding: 6,
              paddingRight: 12,
            }}
          >
            <Avatar p={scene.by === uid ? partnerProfile : profile} name="" size={28} showMood={false} />
            <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '800', fontSize: 12, color: INK }}>
              {scene.by === uid ? `${partnerName} bekleniyor…` : `${partnerName} seni bekliyor`}
            </Text>
          </View>
        </View>
      )}
      <Pressable
        onPress={() => setScreen('map')}
        style={{
          position: 'absolute',
          left: 10,
          top: insets.top + 50,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
          ‹ Harita
        </Text>
      </Pressable>
      <View
        style={{
          position: 'absolute',
          right: 10,
          top: insets.top + 50,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
          {here.name}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#3FA4D2' }}>
      {screen === 'map' ? (
        <>
          <Svg style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
            <Defs>
              <LinearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#7FD3EE" />
                <Stop offset="0.6" stopColor="#3FA4D2" />
                <Stop offset="1" stopColor="#2B8CC0" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#sea)" />
            {Array.from({ length: 40 }, (_, k) => (
              <Path
                key={k}
                d={`M${(k * 89) % 400},${(k * 137) % 900} q6,-4 12,0 q6,4 12,0`}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={2}
                fill="none"
              />
            ))}
          </Svg>
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 44, bottom: 210 + insets.bottom }}
            onLayout={(e) => setMap({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          >
            {map.w > 0 && sea.trip && (
              <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={map.w} height={map.h}>
                <Path
                  d={`M${xy(sea.trip.from).x},${xy(sea.trip.from).y + 30} L${xy(sea.trip.to).x},${xy(sea.trip.to).y + 30}`}
                  stroke="#fff"
                  strokeWidth={3}
                  strokeDasharray="2 8"
                  strokeLinecap="round"
                  opacity={0.85}
                />
              </Svg>
            )}
            {map.w > 0 &&
              BAYS.map((b) => {
                const p = xy(b.id);
                const far = B.rank < b.rank;
                const on = sel === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setSel(on || b.id === sea.at ? null : b.id)}
                    style={{ position: 'absolute', left: p.x - 46, top: p.y - 46, width: 92, alignItems: 'center' }}
                  >
                    <Image
                      source={DART[b.id].src}
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 42,
                        borderWidth: 3,
                        borderColor: sea.visited[b.id] ? '#FFD34D' : '#fff',
                        opacity: far ? 0.7 : 1,
                      }}
                    />
                    <Text
                      maxFontSizeMultiplier={1.25}
                      style={{
                        marginTop: -8,
                        color: '#fff',
                        fontWeight: '800',
                        fontSize: 11,
                        backgroundColor: on ? '#2B8CC0' : 'rgba(20,60,90,0.6)',
                        paddingHorizontal: 7,
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      {b.name}
                      {sea.realRoute.includes(b.id) ? ' ♥' : ''}
                    </Text>
                    {far && (
                      <Text maxFontSizeMultiplier={1.25} style={{ color: '#fff', fontSize: 10, fontWeight: '700', opacity: 0.9 }}>
                        {Object.values(BOATS).find((x) => x.rank === b.rank)!.name} ister
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            {map.w > 0 && (
              <Pressable onPress={() => setShop(true)} style={{ position: 'absolute', left: bp.x - 32, top: bp.y - 26, width: 64 }}>
                <Image
                  source={DART[sea.boat].src}
                  style={{ width: 64, height: 64 * DART[sea.boat].h, transform: [{ scaleX: bp.flip ? -1 : 1 }] }}
                />
                <View style={{ position: 'absolute', left: 18, top: -6, flexDirection: 'row' }}>
                  <Avatar p={profile} name={myName} size={22} showMood={false} />
                  <View style={{ marginLeft: -6 }}>
                    <Avatar p={partnerProfile} name={partnerName} size={22} showMood={false} />
                  </View>
                </View>
              </Pressable>
            )}
          </View>
          <DreamHud
            title={sea.boatName}
            sub={`${Object.keys(sea.visited).length}/${BAYS.length} koy · ${scenes} sahne`}
            coins={farm.coins}
            left={<Avatar p={profile} name={myName} size={30} showMood={false} />}
          />
        </>
      ) : (
        <>
          {stage}
          <DreamHud
            title={sea.boatName}
            sub={`${scenes} sahne`}
            coins={farm.coins}
            left={<Avatar p={profile} name={myName} size={30} showMood={false} />}
          />
        </>
      )}
      <DreamToast text={toast} />
      <DreamSheet>{sheet}</DreamSheet>
    </View>
  );
}
