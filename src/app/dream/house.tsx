import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Avatar } from '../../components/Avatar';
import { ActTile, Btn, DreamHud, DreamSheet, DreamToast, Head, INK, MUTED, Note, Shop } from '../../components/world/DreamUI';
import { ScenePanel, type SceneMeta } from '../../components/world/ScenePanel';
import { DART } from '../../lib/dreamArt';
import {
  DAY_SCENES,
  dreamAction,
  HITEMS,
  HOUSE_LV,
  homeOf,
  houseLevel,
  SLOTS,
  type HItemId,
  type HomeAction,
  type SlotId,
} from '../../lib/dreams';
import { farmOf } from '../../lib/farm';
import { notifyPartner } from '../../lib/push';
import { hourNow, inWindow, startScene, useOpenScene } from '../../lib/scenes';
import { useSession } from '../../lib/session';

// Sahilde Ev: tek bir sahne (ev, bahçe, kumsal). Ev parayla değil huzurla büyür; huzur yalnızca birlikte yaşanan sahnelerden gelir.
// Eşyalar sahnedeki sabit yuvalara konur; her eşya günün bir sahnesini açar (masa → sabah kahvesi, mangal → mangal akşamı).

export const HOME_SCENES: Record<string, SceneMeta> = {
  coffee: { title: 'Sabah kahvesi', verb: 'terasta sabah kahvesi', reward: { huzur: 3 } },
  beach: { title: 'Deniz günü', verb: 'kumsalda deniz günü', reward: { huzur: 4 } },
  bike: { title: 'Bisiklet turu', verb: 'sahilde bisiklet turu', reward: { huzur: 4 } },
  bbq: { title: 'Mangal akşamı', verb: 'bahçede mangal', reward: { huzur: 5 } },
  stars: { title: 'Yıldızlar', verb: 'yıldızların altında bir dilek', reward: { huzur: 5 }, playMs: 7000 },
};
const SCENE_ART: Record<string, keyof typeof DART> = {
  coffee: 'masa',
  beach: 'sezlong',
  bike: 'bisiklet',
  bbq: 'mangal',
  stars: 'gunbatimi',
};
const WINDOW = (k: string) => {
  const d = DAY_SCENES.find((x) => x.kind === k)!;
  return `${String(d.from).padStart(2, '0')}–${String(d.to).padStart(2, '0')}`;
};
const todOf = (h: number) => (h >= 6 && h < 11 ? 'sabah' : h < 17 ? 'gun' : h < 21 ? 'aksam' : 'gece');
const TINT: Record<string, [string, string] | null> = {
  sabah: ['rgba(255,220,170,0.35)', 'rgba(255,245,230,0.05)'],
  gun: null,
  aksam: ['rgba(255,160,80,0.4)', 'rgba(90,40,110,0.45)'],
  gece: ['rgba(10,20,70,0.62)', 'rgba(5,10,40,0.72)'],
};

export default function HouseScreen() {
  const insets = useSafeAreaInsets();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [now, setNow] = useState(Date.now());
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [slot, setSlot] = useState<SlotId | null>(null);
  const [town, setTown] = useState<string | null>(null);
  const [wish, setWish] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const twinkle = useRef(new Animated.Value(0)).current;
  const scene = useOpenScene(couple?.id, 'home');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [twinkle]);

  if (!user || !couple || !partnerId) return null;
  const uid = user.uid;
  const myName = profile?.name ?? 'Ben';
  const home = homeOf(couple);
  const farm = farmOf(couple);
  const lvl = houseLevel(home);
  const H = HOUSE_LV[lvl - 1];
  const hour = hourNow();
  const tod = todOf(hour);
  const next = HOUSE_LV[lvl]; // bir sonraki ev
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2800);
  };

  async function act(x: HomeAction) {
    try {
      const r = await dreamAction(couple!.id, uid, myName, { w: 'home', x });
      if (typeof r === 'string') return flash(r);
      flash(r.text);
      if (x.a === 'place') notifyPartner(partnerId!, r.text, home.town, { type: 'mood', url: '/dream/house' });
    } catch {
      flash('Olmadı, tekrar dene');
    }
  }
  async function begin(kind: string) {
    if (scene) return flash('Önce açık sahneyi bitirin.');
    const d = DAY_SCENES.find((x) => x.kind === kind)!;
    if (d.needs && !Object.values(home.slots).includes(d.needs)) return flash(`${HITEMS[d.needs].name} lazım.`);
    if (!inWindow(hour, d.from, d.to)) return flash(`Bu sahne ${WINDOW(kind)} arası.`);
    try {
      await startScene(couple!.id, uid, { world: 'home', kind, place: home.town, windowMin: 120, qkind: kind });
      notifyPartner(partnerId!, `${myName} seni ${HOME_SCENES[kind].verb} için çağırıyor`, `${home.town} · Sahilde Ev`, {
        type: 'mood',
        url: '/dream/house',
      });
    } catch {
      flash('Sahne başlatılamadı');
    }
  }

  const live = scene && scene.status === 'live' ? scene : null;
  const kind = live?.kind ?? null;
  const tint = kind === 'stars' ? 'gece' : kind === 'bbq' ? 'aksam' : kind === 'coffee' ? 'sabah' : kind ? 'gun' : tod;
  const tintCols = TINT[tint];
  const at = kind ? DAY_SCENES.find((x) => x.kind === kind)?.where : null;
  const whereXY = (s: SlotId) => ({ x: SLOTS[s].x * stage.w, y: SLOTS[s].y * stage.h });

  // ---- alt panel ----
  let sheet: React.ReactNode;
  if (scene) {
    sheet = (
      <ScenePanel
        scene={scene}
        meta={HOME_SCENES[scene.kind] ?? { title: scene.kind, verb: '' }}
        coupleId={couple.id}
        uid={uid}
        partnerId={partnerId}
        partnerName={partnerName}
        profile={profile}
        partnerProfile={partnerProfile}
        onJoined={() =>
          notifyPartner(partnerId, `${myName} geldi 💛`, `${HOME_SCENES[scene.kind]?.title} başlıyor`, {
            type: 'mood',
            url: '/dream/house',
          })
        }
        extra={
          scene.kind === 'stars' && scene.status === 'live' ? (
            wish === null ? (
              <Btn kind="soft" label="Bir dilek tut (yalnız ikiniz görür)" onPress={() => setWish('')} />
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={wish}
                  onChangeText={setWish}
                  placeholder="Dileğimiz…"
                  maxLength={120}
                  style={{ flex: 1, borderWidth: 1, borderColor: '#F0E2DC', borderRadius: 10, padding: 8, color: INK }}
                />
                <Btn label="Tut" onPress={() => act({ a: 'wish', text: wish.trim() }).then(() => setWish(null))} />
              </View>
            )
          ) : null
        }
      />
    );
  } else if (slot) {
    const S = SLOTS[slot];
    const cur = home.slots[slot];
    sheet = (
      <>
        <Head title={S.name} onClose={() => setSlot(null)} />
        {cur ? (
          <>
            <Note>
              {HITEMS[cur].name} burada.{' '}
              {DAY_SCENES.find((d) => d.needs === cur)
                ? `${HOME_SCENES[DAY_SCENES.find((d) => d.needs === cur)!.kind].title} sahnesini açıyor.`
                : ''}
            </Note>
            {HITEMS[cur].cost > 0 && (
              <Btn kind="soft" label="Kaldır" onPress={() => act({ a: 'remove', slot }).then(() => setSlot(null))} />
            )}
          </>
        ) : (
          <Shop
            list={S.items.map((id) => {
              const it = HITEMS[id];
              const d = DAY_SCENES.find((x) => x.needs === id);
              return {
                id,
                img: DART[it.art as keyof typeof DART].src,
                name: it.name,
                price: it.cost ? `${it.cost} altın` : 'Hediye',
                sub: it.lvl > lvl ? `${HOUSE_LV[it.lvl - 1].name} ister` : d ? `${HOME_SCENES[d.kind].title} sahnesini açar` : '',
                off: it.lvl > lvl || farm.coins < it.cost,
                onPress: () => act({ a: 'place', slot, item: id }).then(() => setSlot(null)),
              };
            })}
          />
        )}
      </>
    );
  } else if (town !== null) {
    sheet = (
      <>
        <Head title="Evimizin adı" onClose={() => setTown(null)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={town}
            onChangeText={setTown}
            maxLength={28}
            style={{ flex: 1, borderWidth: 1, borderColor: '#F0E2DC', borderRadius: 10, padding: 8, color: INK }}
          />
          <Btn label="Kaydet" onPress={() => act({ a: 'town', name: town.trim() }).then(() => setTown(null))} />
        </View>
        <Note>Hangi sahil? Hangi köy? Gerçek hayalinizin adını verin.</Note>
      </>
    );
  } else {
    const avail = DAY_SCENES.filter((d) => inWindow(hour, d.from, d.to));
    const later = DAY_SCENES.filter((d) => !inWindow(hour, d.from, d.to));
    sheet = (
      <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Pressable onPress={() => setTown(home.town)}>
              <Text style={{ fontWeight: '900', fontSize: 17, color: INK }}>
                {home.town} <Text style={{ color: MUTED, fontSize: 12 }}>✎</Text>
              </Text>
            </Pressable>
            <Note>
              {H.name} · huzur {home.huzur}
              {next ? ` · ${next.name} için ${next.huzur}` : ' · en büyük ev'}
            </Note>
          </View>
        </View>
        {next && (
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#F3E4EA', overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.min(100, Math.round(((home.huzur - H.huzur) / (next.huzur - H.huzur)) * 100))}%`,
                height: 8,
                backgroundColor: '#E8516A',
              }}
            />
          </View>
        )}
        <Text style={{ fontWeight: '800', fontSize: 13, color: INK }}>Şimdi yapılabilir</Text>
        {avail.length === 0 && <Note>Şu an sahne yok. Saat {String(hour).padStart(2, '0')}:00.</Note>}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {avail.map((d) => {
            const has = !d.needs || Object.values(home.slots).includes(d.needs);
            return (
              <ActTile
                key={d.kind}
                img={DART[SCENE_ART[d.kind]].src}
                title={HOME_SCENES[d.kind].title}
                sub={has ? `+${HOME_SCENES[d.kind].reward?.huzur} huzur` : `${HITEMS[d.needs!].name} lazım`}
                onPress={() => begin(d.kind)}
                off={!has}
              />
            );
          })}
        </View>
        {later.length > 0 && <Note>Sonra: {later.map((d) => `${HOME_SCENES[d.kind].title} ${WINDOW(d.kind)}`).join(' · ')}</Note>}
        <Note>
          Ev parayla değil huzurla büyür; huzur yalnızca birlikte yaşanan sahnelerden gelir. Eşya almak için sahnedeki noktalara dokunun.
        </Note>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#9ED4EE' }}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <Image
          source={DART[H.art as keyof typeof DART].src}
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {tintCols && (
          <Svg style={{ position: 'absolute', left: 0, top: 0 }} width="100%" height="100%" pointerEvents="none">
            <Defs>
              <LinearGradient id="t" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={tintCols[0]} />
                <Stop offset="1" stopColor={tintCols[1]} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#t)" />
          </Svg>
        )}
        {tint === 'gece' && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              height: '40%',
              opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            }}
          >
            <Svg width="100%" height="100%">
              {[6, 14, 25, 38, 47, 58, 69, 80, 91, 33, 75, 18].map((x, i) => (
                <Circle key={i} cx={`${x}%`} cy={`${10 + ((i * 53) % 70)}%`} r={i % 4 === 0 ? 2.2 : 1.4} fill="#fff" />
              ))}
            </Svg>
          </Animated.View>
        )}
        {/* eşyalar ve yuvalar */}
        {stage.w > 0 &&
          (Object.keys(SLOTS) as SlotId[]).map((s) => {
            const S = SLOTS[s];
            if (S.lvl && S.lvl > lvl) return null;
            const it = home.slots[s];
            const w = S.w * stage.w;
            const p = whereXY(s);
            if (it) {
              const art = DART[HITEMS[it].art as keyof typeof DART];
              const hgt = w * art.h;
              return (
                <Pressable
                  key={s}
                  onPress={() => !scene && setSlot(s)}
                  style={{ position: 'absolute', left: p.x - w / 2, top: p.y - hgt, width: w, height: hgt }}
                >
                  <Image source={art.src} style={{ width: w, height: hgt }} resizeMode="contain" />
                </Pressable>
              );
            }
            if (scene) return null;
            return (
              <Pressable
                key={s}
                onPress={() => setSlot(s)}
                style={{
                  position: 'absolute',
                  left: p.x - 16,
                  top: p.y - 16,
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Animated.View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    borderWidth: 2,
                    borderColor: '#E8516A',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
                  }}
                >
                  <Text style={{ color: '#E8516A', fontWeight: '900', fontSize: 16, lineHeight: 18 }}>+</Text>
                </Animated.View>
              </Pressable>
            );
          })}
        {/* ikisi sahnede */}
        {stage.w > 0 && (
          <>
            {(() => {
              const spot = at ? whereXY(at) : whereXY('kapi');
              const dx = kind === 'bike' ? 70 : kind === 'beach' ? 60 : 46;
              return (
                <>
                  <View style={{ position: 'absolute', left: spot.x - dx - 18, top: spot.y - 46 }}>
                    <Who p={profile} name={myName} />
                  </View>
                  <View style={{ position: 'absolute', left: spot.x + dx - 18, top: spot.y - 46 }}>
                    <Who p={partnerProfile} name={partnerName} />
                  </View>
                </>
              );
            })()}
          </>
        )}
        {scene?.status === 'waiting' && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: '45%', alignItems: 'center' }}>
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
              <Text style={{ fontWeight: '800', fontSize: 12, color: INK }}>
                {scene.by === uid ? `${partnerName} bekleniyor…` : `${partnerName} seni bekliyor`}
              </Text>
            </View>
          </View>
        )}
        {home.wishes.length > 0 && !scene && (
          <View
            style={{
              position: 'absolute',
              right: 10,
              top: insets.top + 50,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 12, color: INK }}>✦ {home.wishes.length} dilek</Text>
          </View>
        )}
      </View>
      <DreamHud
        title={home.town}
        sub={`${H.name} · huzur ${home.huzur}`}
        coins={farm.coins}
        left={<Avatar p={profile} name={myName} size={30} showMood={false} />}
      />
      <DreamToast text={toast} />
      <DreamSheet>{sheet}</DreamSheet>
    </View>
  );
}

function Who({ p, name }: { p: Parameters<typeof Avatar>[0]['p']; name: string }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#fff',
        backgroundColor: '#fff',
        overflow: 'hidden',
        elevation: 3,
      }}
    >
      <Avatar p={p} name={name} size={32} showMood={false} />
    </View>
  );
}
