import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Avatar } from '../../components/Avatar';
import { ActTile, Btn, DreamHud, DreamSheet, DreamToast, Head, Note, Shop } from '../../components/world/DreamUI';
import { DART } from '../../lib/dreamArt';
import {
  BOATS,
  CAMP_COST,
  castsLeft,
  dreamAction,
  FISH,
  island,
  ISLANDS,
  seaOf,
  tripMins,
  type BoatId,
  type FishId,
  type SeaAction,
} from '../../lib/dreams';
import { dayKey } from '../../lib/date';
import { farmOf, MIN, timeLeft } from '../../lib/farm';
import { notifyPartner } from '../../lib/push';
import { useSession } from '../../lib/session';

// Mavi Yolculuk: haritada koy koy tekne gezisi. Yolculuk gerçek zamanlıdır; ikiniz de teknedesiniz.

function ago(ms: number) {
  const m = Math.floor(ms / MIN);
  if (m < 60) return `${Math.max(1, m)} dk`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} sa` : `${Math.floor(h / 24)} gün`;
}

type Fishing = { state: 'wait' | 'bite' | 'miss' | 'early' | 'done' | 'saving'; fish: FishId; bite: number };

export default function SeaScreen() {
  const insets = useSafeAreaInsets();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [now, setNow] = useState(Date.now());
  const [map, setMap] = useState({ w: 0, h: 0 });
  const [sel, setSel] = useState<string | null>(null); // ada id ya da 'boat' ya da 'mem'
  const [toast, setToast] = useState('');
  const [fishing, setFishing] = useState<Fishing | null>(null);
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Şamandıra: bekleyişte hafif sallanır, vurunca batıp çıkar.
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
    let t: ReturnType<typeof setTimeout>;
    if (fishing.state === 'wait')
      t = setTimeout(() => setFishing((f) => (f && f.state === 'wait' ? { ...f, state: 'bite' } : f)), fishing.bite);
    else t = setTimeout(() => setFishing((f) => (f && f.state === 'bite' ? { ...f, state: 'miss' } : f)), 900);
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
  const here = island(sea.at);
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2600);
  };

  async function act(x: SeaAction) {
    try {
      const r = await dreamAction(couple!.id, uid, myName, { w: 'sea', x });
      if (typeof r === 'string') return flash(r);
      if (x.a === 'sail')
        notifyPartner(partnerId!, r.text, 'Teknede ikiniz de varsınız. Varınca balık tutabilirsiniz.', { type: 'mood', url: '/dream/sea' });
      if (x.a === 'sunset' && r.started) notifyPartner(partnerId!, r.text, 'Gel, birlikte izleyelim.', { type: 'mood', url: '/dream/sea' });
      if (x.a === 'sunset' && r.joined)
        notifyPartner(partnerId!, `${myName} gün batımına geldi 🌅`, 'Anı defterinize yazıldı.', { type: 'mood', url: '/dream/sea' });
      if (x.a === 'boat' || x.a === 'camp') notifyPartner(partnerId!, r.text, 'Mavi Yolculuk', { type: 'mood', url: '/dream/sea' });
      if (x.a !== 'fish') flash(r.text);
      return r;
    } catch {
      flash('Olmadı, tekrar dene');
    }
  }

  function startFishing() {
    if (castsLeft(sea, uid) <= 0) return flash('Bugünkü olta hakkın bitti.');
    const pool = here.fish;
    const fish: FishId = Math.random() < 0.1 ? 'ahtapot' : pool[Math.floor(Math.random() * pool.length)];
    setFishing({ state: 'wait', fish, bite: 1200 + Math.random() * 2600 });
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
      if (fishing.fish === 'ahtapot')
        notifyPartner(partnerId!, `${myName} ahtapot tuttu! 🐙`, 'Akşama ızgara?', { type: 'mood', url: '/dream/sea' });
      return;
    }
    if (fishing.state === 'miss') await act({ a: 'fish', fish: null });
    setFishing(null);
    startFishing();
  }

  // harita koordinatları
  const xy = (id: string) => {
    const i = island(id);
    return { x: i.x * map.w, y: i.y * map.h };
  };
  const B = BOATS[sea.boat];
  let bp = { x: 0, y: 0, flip: false, k: 1 };
  if (map.w) {
    if (sea.trip) {
      const k = Math.min(1, (now - sea.trip.start) / (sea.trip.end - sea.trip.start));
      const a = xy(sea.trip.from);
      const b = xy(sea.trip.to);
      bp = { x: a.x + (b.x - a.x) * k + 26, y: a.y + (b.y - a.y) * k + 40, flip: b.x < a.x, k };
    } else {
      const p = xy(sea.at);
      bp = { x: p.x + 46, y: p.y + 44, flip: false, k: 1 };
    }
  }

  const today = dayKey();
  const sun = sea.sunset && sea.sunset.day === today && sea.sunset.at === here.id ? sea.sunset : null;
  const casts = castsLeft(sea, uid);

  let sheet: React.ReactNode;
  if (sel === 'boat') {
    sheet = (
      <>
        <Head img={DART[sea.boat].src} title={`Tekneniz: ${B.name}`} onClose={() => setSel(null)} />
        <Shop
          list={(Object.keys(BOATS) as BoatId[]).map((id) => {
            const b = BOATS[id];
            const own = B.rank >= b.rank;
            return {
              id,
              img: DART[id].src,
              name: b.name,
              price: own ? 'Sizin' : `${b.cost} altın`,
              sub: `${b.speed}× hız`,
              off: own || b.rank !== B.rank + 1 || farm.coins < b.cost,
              onPress: () => act({ a: 'boat', boat: id }).then(() => setSel(null)),
            };
          })}
        />
        <Note>Büyük tekne uzak koylara gider ve yolu kısaltır. Altın üç dünyada ortak.</Note>
      </>
    );
  } else if (sel === 'mem') {
    sheet = (
      <>
        <Head img={DART.sandik.src} title="Anı defteri" onClose={() => setSel(null)} />
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          {(Object.keys(FISH) as FishId[]).map((f) => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Image source={DART[f].src} style={{ width: 38, height: 24 }} resizeMode="contain" />
              <Text style={{ fontWeight: '800', color: '#2B1D22' }}>{sea.catch[f] ?? 0}</Text>
            </View>
          ))}
        </View>
        <View style={{ gap: 6, maxHeight: 170 }}>
          {sea.mem.length === 0 && <Note>İlk anınız ilk koyda yazılacak.</Note>}
          {sea.mem.slice(0, 6).map((m, k) => (
            <View
              key={k}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FFF8F0', borderRadius: 12, padding: 6 }}
            >
              <Image source={(DART[m.art] ?? DART.sandik).src} style={{ width: 40, height: 34 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 13, color: '#2B1D22' }}>{m.t}</Text>
                <Text style={{ fontSize: 11, color: '#8A7479' }}>{ago(now - m.at)} önce</Text>
              </View>
            </View>
          ))}
        </View>
      </>
    );
  } else if (sea.trip) {
    sheet = (
      <>
        <Note center>
          {island(sea.trip.to).name} yolundasınız ⛵ {timeLeft(sea.trip.end - now)} kaldı. {partnerName} de teknede.
        </Note>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E3EEF4', overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(bp.k * 100)}%`, height: 8, backgroundColor: '#2B8CC0' }} />
        </View>
      </>
    );
  } else if (sel && sel !== sea.at) {
    const t = island(sel);
    const ok = B.rank >= t.need;
    const need = Object.values(BOATS).find((b) => b.rank === t.need)!;
    sheet = (
      <>
        <Head img={DART[t.art].src} title={t.name} onClose={() => setSel(null)} />
        <Note>
          {t.line}
          {sea.visited[t.id] ? ' Daha önce geldiniz.' : ''}
        </Note>
        {ok ? (
          <Btn
            kind="sea"
            label={`Yola çık · ${timeLeft(tripMins(sea, sea.at, t.id) * MIN)}`}
            onPress={() => act({ a: 'sail', to: t.id }).then(() => setSel(null))}
          />
        ) : (
          <Btn kind="soft" label={`Bu koy için ${need.name} lazım`} onPress={() => setSel('boat')} />
        )}
      </>
    );
  } else {
    sheet = (
      <>
        <Head img={DART[here.art].src} title={here.name} />
        <Note>{here.line}</Note>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <ActTile img={DART.olta.src} title="Balık tut" sub={`${casts} olta hakkı`} onPress={startFishing} off={casts <= 0} />
          {here.camp && (
            <ActTile
              img={DART.cadir.src}
              title="Kamp kur"
              sub={sea.camps[here.id] ? 'Kuruldu' : `${CAMP_COST} altın`}
              onPress={() => act({ a: 'camp' })}
              off={!!sea.camps[here.id]}
            />
          )}
          <ActTile
            img={DART.gunbatimi.src}
            title="Gün batımı"
            sub={sun?.joined ? 'İzlediniz' : sun && sun.by !== uid ? `${partnerName} çağırıyor` : sun ? 'Bekleniyor' : 'İkiniz birlikte'}
            onPress={() => act({ a: 'sunset' })}
            off={!!sun?.joined || (sun?.by === uid && !sun.joined)}
          />
          <ActTile img={DART.sandik.src} title="Anı defteri" sub={`${sea.mem.length} anı`} onPress={() => setSel('mem')} />
        </View>
        <Note center>Haritada bir koya dokun: oraya yelken açın. Tekneye dokun: tekneyi büyütün.</Note>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#3FA4D2' }}>
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
        style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 44, bottom: 240 + insets.bottom }}
        onLayout={(e) => setMap({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {map.w > 0 && sea.trip && (
          <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={map.w} height={map.h}>
            <Path
              d={`M${xy(sea.trip.from).x + 26},${xy(sea.trip.from).y + 40} L${xy(sea.trip.to).x + 26},${xy(sea.trip.to).y + 40}`}
              stroke="#fff"
              strokeWidth={3}
              strokeDasharray="2 8"
              strokeLinecap="round"
              opacity={0.85}
            />
          </Svg>
        )}
        {map.w > 0 &&
          ISLANDS.map((i) => {
            const p = xy(i.id);
            const lock = B.rank < i.need;
            const on = sel === i.id;
            return (
              <Pressable
                key={i.id}
                onPress={() => setSel(on || i.id === sea.at ? null : i.id)}
                style={{ position: 'absolute', left: p.x - i.w / 2, top: p.y - i.w / 2, width: i.w, alignItems: 'center' }}
              >
                <Image source={DART[i.art].src} style={{ width: i.w, height: i.w * DART[i.art].h, opacity: lock ? 0.8 : 1 }} />
                {sea.camps[i.id] && (
                  <Image
                    source={DART.cadir.src}
                    style={{ position: 'absolute', left: i.w * 0.46, top: i.w * 0.2, width: i.w * 0.38, height: i.w * 0.3 }}
                  />
                )}
                <Text
                  style={{
                    marginTop: -6,
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: 11,
                    backgroundColor: on ? '#2B8CC0' : 'rgba(20,60,90,0.55)',
                    paddingHorizontal: 7,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  {i.name}
                  {lock ? ' 🔒' : ''}
                </Text>
              </Pressable>
            );
          })}
        {map.w > 0 && (
          <Pressable
            onPress={() => setSel('boat')}
            style={{ position: 'absolute', left: bp.x - B.w / 2, top: bp.y - B.w * 0.5, width: B.w }}
          >
            <Image
              source={DART[sea.boat].src}
              style={{ width: B.w, height: B.w * DART[sea.boat].h, transform: [{ scaleX: bp.flip ? -1 : 1 }] }}
            />
            <View style={{ position: 'absolute', left: B.w * 0.3, top: -6, flexDirection: 'row' }}>
              <Avatar p={profile} name={myName} size={24} showMood={false} />
              <View style={{ marginLeft: -6 }}>
                <Avatar p={partnerProfile} name={partnerName} size={24} showMood={false} />
              </View>
            </View>
          </Pressable>
        )}
      </View>

      <DreamHud
        title={B.name}
        sub={`${Object.keys(sea.visited).length}/${ISLANDS.length} koy`}
        coins={farm.coins}
        left={<Avatar p={profile} name={myName} size={30} showMood={false} />}
      />
      <DreamToast text={toast} />

      {fishing ? (
        <DreamSheet>
          {fishing.state === 'done' ? (
            <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
              <Image source={DART[fishing.fish].src} style={{ width: 150, height: 150 * DART[fishing.fish].h }} />
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#2B1D22' }}>{FISH[fishing.fish].name}!</Text>
              <Text style={{ fontWeight: '900', color: '#7A5A00' }}>+{FISH[fishing.fish].sell} altın</Text>
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
          <Text style={{ textAlign: 'center', fontWeight: '800', color: '#2B1D22' }}>
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
        </DreamSheet>
      ) : (
        <DreamSheet>{sheet}</DreamSheet>
      )}
    </View>
  );
}
