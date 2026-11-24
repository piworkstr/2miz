import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, PanResponder, Pressable, View, type ImageSourcePropType } from 'react-native';
import {
  DECOR,
  hasAll,
  MIN,
  PRODUCT_NAME,
  RECIPES,
  sourceOf,
  stationJobs,
  stationOf,
  stationSlots,
  STOCK_EMOJI,
  timeLeft,
  type Farm,
  type RecipeId,
  type Station,
} from '../../lib/farm';
import { stockArt } from '../../lib/farmArt';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { GText } from './FarmUI';

// Atölye ekranı: çiftlik kararır, atölye parlak kalır. Ürünler atölyenin üstünde yay hâlinde, altın çerçeveli madalyonlarda
// durur; istenen ürün atölyenin üstüne sürüklenir. Ürüne dokununca parşömen balonda adı, süresi ve malzemeleri görünür.
// Atölyenin adı altındaki kurdelede, sıradaki işler onun altındaki madalyonlardadır.
// Ekran açıkken çiftlik kaydırılamaz (karartı dokunuşu alır): parçalar hep aynı yerde durur.
const M_BIG = 76; // ürün madalyonunun çapı
const M_ON_BIG = 86; // seçili madalyon
const R_MIN = 118; // yayın yarıçapı (az ürün)
const DROP = 92; // atölyeye bırakma yarıçapı
const GREEN_INK = '#2F6E12';
const RED_INK = '#C7354F';

function Icon({ k, size }: { k: string; size: number }) {
  const a = stockArt(k);
  if (a) return <Image source={a.src} style={{ width: size, height: size }} resizeMode="contain" />;
  return (
    <GText size={Math.round(size * 0.7)} style={{ lineHeight: size, height: size }}>
      {STOCK_EMOJI[k] ?? '📦'}
    </GText>
  );
}

type St = 'ok' | 'missing' | 'full' | 'locked';
type DragApi = {
  start: (id: RecipeId, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (id: RecipeId, x: number, y: number, moved: boolean) => void;
};

// Ürün dairesi: beyaz, yumuşak gölgeli. Seçiliyken yeşil kenarlık, kilitliyken gri zemin ve küçük kilit.
const SH = { shadowColor: '#32200A', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 } as const;
function Medal({ id, size, state, on }: { id: string; size: number; state: St; on: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: state === 'locked' ? '#EFEAE2' : '#FFFFFF',
        borderWidth: on ? 3 : 1.5,
        borderColor: on ? '#76BA48' : '#F0E4D0',
        alignItems: 'center',
        justifyContent: 'center',
        ...SH,
      }}
    >
      <View style={{ opacity: state === 'locked' ? 0.4 : 1 }}>
        <Icon k={id} size={Math.round(size * 0.72)} />
      </View>
      {state === 'locked' && (
        <View
          style={{
            position: 'absolute',
            bottom: -5,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#8C6E54',
            borderWidth: 1.5,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="lock-closed" size={10} color="#fff" />
        </View>
      )}
    </View>
  );
}

function RecipeMedal({
  id,
  x,
  y,
  state,
  picked,
  hidden,
  stock,
  m,
  mOn,
  api,
}: {
  id: RecipeId;
  m: number;
  mOn: number;
  stock: number; // depoda bu üründen kaç tane var
  x: number;
  y: number;
  state: St;
  picked: boolean;
  hidden: boolean;
  api: React.RefObject<DragApi | null>;
}) {
  const at = useRef({ x, y });
  at.current = { x, y };
  const moved = useRef(false);
  const pr = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          moved.current = false;
        },
        onPanResponderMove: (_e, g) => {
          if (!moved.current && Math.hypot(g.dx, g.dy) > 7) {
            moved.current = true;
            api.current?.start(id, at.current.x + g.dx, at.current.y + g.dy);
          }
          if (moved.current) api.current?.move(at.current.x + g.dx, at.current.y + g.dy);
        },
        onPanResponderRelease: (_e, g) => api.current?.end(id, at.current.x + g.dx, at.current.y + g.dy, moved.current),
        onPanResponderTerminate: (_e, g) => api.current?.end(id, at.current.x + g.dx, at.current.y + g.dy, false),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  const size = picked ? mOn : m;
  const r = RECIPES[id];
  return (
    <View
      {...pr.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={r.name}
      style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, alignItems: 'center', opacity: hidden ? 0.3 : 1 }}
    >
      <Medal id={id} size={size} state={state} on={picked} />
      {state === 'locked' && (
        <GText light size={11} style={{ marginTop: 6, width: 90, textAlign: 'center' }}>
          {`Seviye ${r.lvl}`}
        </GText>
      )}
      {/* Depoda bu üründen kaç tane olduğu: dairenin sol üstünde küçük etiket. */}
      {state !== 'locked' && (
        <View
          style={{
            position: 'absolute',
            left: -6,
            top: -6,
            minWidth: 24,
            height: 22,
            borderRadius: 11,
            paddingHorizontal: 6,
            backgroundColor: '#4A2E1C',
            borderWidth: 1.5,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GText size={12} color="#fff" style={{ lineHeight: 16 }}>
            {stock > 999 ? '999+' : stock}
          </GText>
        </View>
      )}
      {(state === 'missing' || state === 'full') && (
        <View
          style={{
            position: 'absolute',
            right: -3,
            top: -3,
            width: 17,
            height: 17,
            borderRadius: 9,
            backgroundColor: '#E8604C',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#fff',
          }}
        >
          <GText size={10} color="#fff" style={{ lineHeight: 13 }}>
            !
          </GText>
        </View>
      )}
    </View>
  );
}

export function StationPop({
  farm,
  i,
  now,
  level,
  sx,
  sy,
  spr,
  box,
  top,
  bottom,
  onCook,
  onCollect,
  onRemove,
  onClose,
}: {
  farm: Farm;
  i: number;
  now: number;
  level: number;
  sx: number; // atölyenin ekrandaki yeri (çizim yoksa)
  sy: number;
  spr: { src: ImageSourcePropType; left: number; top: number; w: number; h: number } | null; // atölye çiziminin ekrandaki yeri
  box: { w: number; h: number };
  top: number; // üstte ve altta boş bırakılacak pay (güvenli alan)
  bottom: number;
  onCook: (r: RecipeId) => void;
  onCollect: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = farm.tiles[i];
  const st = (t && t.k === 'decor' ? t.item : 'firin') as Station;
  const d = DECOR[st as keyof typeof DECOR];
  const jobs = stationJobs(farm, st);
  const slots = Math.max(stationSlots(st, level), jobs.length);
  const full = jobs.length >= slots;
  const ready = jobs.filter((j) => j.ready <= now).length;
  const list = (Object.keys(RECIPES) as RecipeId[])
    .filter((id) => stationOf(id, farm) === st)
    // Soldan sağa: önce açılan önce gelir; aynı seviyede açılanlarda ucuz (basit) olan solda durur. Sıra hiç değişmez.
    .sort((a, b) => RECIPES[a].lvl - RECIPES[b].lvl || RECIPES[a].sell - RECIPES[b].sell || a.localeCompare(b))
    // Açılmış tarifler ve sıradaki tek kilitli tarif (ne geleceği görünsün).
    .filter((id, _k, all) => RECIPES[id].lvl <= level || all.filter((q) => RECIPES[q].lvl > level).indexOf(id) < 1)
    .slice(0, 6);
  const stateOf = (id: RecipeId): St =>
    level < RECIPES[id].lvl ? 'locked' : full ? 'full' : hasAll(farm, RECIPES[id].needs) ? 'ok' : 'missing';

  // Ekran açılınca yapılabilen ilk ürün seçili gelir: balon boş kalmaz, ne gerektiği hemen görünür.
  const [pick, setPick] = useState<RecipeId | null>(() => list.find((id) => stateOf(id) === 'ok') ?? list[0] ?? null);
  const [drag, setDrag] = useState<RecipeId | null>(null);
  const [over, setOver] = useState(false);
  const xy = useRef(new Animated.ValueXY()).current;
  const overRef = useRef(false);

  // Atölyenin ekrandaki kutusu: çizim varsa o, yoksa kare merkezinin çevresi. Atölye çok küçük ya da çok büyük
  // görünüyorsa (uzak / yakın kamera) yerleşim makul bir ölçüye göre yapılır.
  const mw = Math.min(190, Math.max(96, spr?.w ?? 120));
  const mcx = spr ? spr.left + spr.w / 2 : sx;
  const mcy = spr ? spr.top + spr.h / 2 : sy;
  const mh = Math.min(190, Math.max(96, spr?.h ?? 120));
  // Yayın merkezi atölyenin biraz üstüdür; ekran kenarına yakınsa ekranda kalacak kadar kayar.
  const n = list.length;
  // Ürün çoksa daireler küçülür: altı ürünlü atölyede yay ekranın kenarına taşmasın.
  const M = n >= 6 ? 62 : n === 5 ? 70 : M_BIG;
  const M_ON = n >= 6 ? 72 : n === 5 ? 80 : M_ON_BIG;
  // Yay atölyenin hemen üstünü sarar: yarıçap atölyenin yarı boyundan biraz büyüktür; ürün çoksa yay genişler.
  const R = Math.max(R_MIN, mh * 0.5 + M_ON * 0.62) + (n > 4 ? 22 : 0);
  const STEP = Math.min(44, (Math.asin(Math.min(1, (M + 12) / 2 / R)) * 2 * 180) / Math.PI + 2);
  const tot = (n - 1) * STEP;
  const half = R * Math.sin((Math.min(180, tot) / 2) * (Math.PI / 180)) + M_ON / 2 + 6;
  const BAL_W = 230;
  const BAL_H = 112;
  const cx = Math.min(box.w - half, Math.max(half, mcx));
  const cy = Math.min(box.h - bottom - mh / 2 - 170, Math.max(top + BAL_H + R + M_ON / 2 - 8, mcy));
  const pos = list.map((_id, k) => {
    const a = (-90 - tot / 2 + k * STEP) * (Math.PI / 180);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const RIB_W = 180;
  const RIB_H = 38;
  const ribTop = Math.min(box.h - bottom - RIB_H - 96, mcy + mh / 2 - 6);
  const Q = 48; // sıra madalyonu
  const QR = 56; // hazır olanın çelengi
  const rowW = slots * (Q + 6) - 6 + (QR - Q);
  const rowTop = ribTop + RIB_H + 2;

  // Bırakma alanı: atölyenin kendisi, adı ve altındaki sıra. (Ürünü sıraya doğru sürükleyip bırakmak da üretimi başlatır.)
  const near = (x: number, y: number) =>
    Math.hypot(x - mcx, y - mcy) < DROP || (Math.abs(x - mcx) < Math.max(DROP, rowW / 2 + 24) && y > mcy && y < rowTop + QR + 40);

  const api = useRef<DragApi | null>(null);
  api.current = {
    start: (id, x, y) => {
      xy.setValue({ x: x - M_ON / 2, y: y - M_ON / 2 });
      overRef.current = false;
      setOver(false);
      setDrag(id);
      setPick(id);
      Haptics.selectionAsync().catch(() => {});
    },
    move: (x, y) => {
      xy.setValue({ x: x - M_ON / 2, y: y - M_ON / 2 });
      const o = near(x, y);
      if (o !== overRef.current) {
        overRef.current = o;
        setOver(o);
        if (o) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    end: (id, x, y, moved) => {
      setDrag(null);
      setOver(false);
      if (!moved) {
        setPick((p) => (p === id ? null : id));
        return;
      }
      if (!near(x, y)) return;
      if (stateOf(id) === 'ok') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onCook(id);
        setPick(null);
      } else setPick(id); // neden olmadığı balonda yazar
    },
  };

  const pk = pick && list.includes(pick) ? pick : null;
  const pr = pk ? RECIPES[pk] : null;
  const pState = pk ? stateOf(pk) : null;
  const pAt = pk ? pos[list.indexOf(pk)] : null;
  // Balonun kuyruğu çizimin alt kenarında, soldan %47'dedir: kuyruk seçili madalyonun üstüne gelir.
  const balLeft = pAt ? Math.min(box.w - BAL_W - 8, Math.max(8, pAt.x - BAL_W / 2)) : 0;
  const balTop = pAt ? pAt.y - M_ON / 2 - BAL_H - 2 : 0;
  const needs = pr ? Object.entries(pr.needs) : [];
  const hint =
    pState === 'locked'
      ? `${pr?.lvl}. seviyede açılır`
      : pState === 'full'
        ? 'Sıra dolu'
        : pState === 'missing'
          ? needs
              .filter(([k, q]) => (farm.stock[k] ?? 0) < q)
              .map(([k, q]) => `${q - (farm.stock[k] ?? 0)} ${PRODUCT_NAME[k].toLocaleLowerCase('tr-TR')}`)
              .join(', ') + ' eksik'
          : 'Atölyenin üstüne sürükle';

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 46 }}>
      {/* Karartı: çiftliğe dokunuşu keser (kaydırma yok), dokununca ekran kapanır. */}
      <Pressable
        accessibilityLabel="Atölyeyi kapat"
        onPress={onClose}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,12,4,0.62)' }}
      />
      {/* Atölye karartının üstünde, ışık içinde yeniden çizilir. Hazır ürün varsa dokununca toplanır. */}
      <Svg
        pointerEvents="none"
        width={mw * 2.6}
        height={mw * 2.6}
        style={{ position: 'absolute', left: mcx - mw * 1.3, top: mcy - mw * 1.3 }}
      >
        <Defs>
          <RadialGradient id="stGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={drag && over ? '#B6F27A' : '#FFE9A8'} stopOpacity={drag ? 0.75 : 0.55} />
            <Stop offset="0.55" stopColor={drag && over ? '#B6F27A' : '#FFE9A8'} stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FFE9A8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={mw * 1.3} cy={mw * 1.3} r={mw * 1.3} fill="url(#stGlow)" />
      </Svg>
      {spr && (
        <Pressable
          onPress={ready > 0 ? onCollect : undefined}
          accessibilityLabel={d.name}
          style={{ position: 'absolute', left: spr.left, top: spr.top, width: spr.w, height: spr.h }}
        >
          <Image source={spr.src} style={{ width: spr.w, height: spr.h }} />
        </Pressable>
      )}
      {list.map((id, k) => (
        <RecipeMedal
          key={id}
          id={id}
          x={pos[k].x}
          y={pos[k].y}
          state={stateOf(id)}
          picked={pk === id}
          hidden={drag === id}
          stock={farm.stock[id] ?? 0}
          m={M}
          mOn={M_ON}
          api={api}
        />
      ))}
      {/* Seçili ürünün kartı: ad + süre, malzemeler, tek satır yönerge. Altındaki küçük ok seçili ürünü gösterir. */}
      {pr && pk && pAt && !drag && (
        <View pointerEvents="none" style={{ position: 'absolute', left: balLeft, top: balTop, width: BAL_W, height: BAL_H }}>
          <View
            style={{
              position: 'absolute',
              left: Math.min(BAL_W - 30, Math.max(14, pAt.x - balLeft - 8)),
              bottom: 6,
              width: 16,
              height: 16,
              backgroundColor: '#FFFAF0',
              transform: [{ rotate: '45deg' }],
            }}
          />
          <View
            style={{
              height: BAL_H - 14,
              borderRadius: 18,
              backgroundColor: '#FFFAF0',
              paddingHorizontal: 12,
              paddingVertical: 8,
              justifyContent: 'space-between',
              alignItems: 'center',
              ...SH,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <GText size={17} color="#4A2E1C" style={{ flexShrink: 1 }}>
                {pr.name}
              </GText>
              <GText size={12} color="#8C6E54">
                {timeLeft(pr.mins * MIN)}
              </GText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', alignSelf: 'stretch' }}>
              {needs.slice(0, 4).map(([k, q]) => {
                const have = farm.stock[k] ?? 0;
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icon k={k} size={28} />
                    <GText size={16} color={have >= q ? GREEN_INK : RED_INK}>{`${have.toLocaleString('tr-TR')}/${q}`}</GText>
                  </View>
                );
              })}
            </View>
            <GText size={12} color={pState === 'ok' ? '#8C6E54' : RED_INK}>
              {hint}
            </GText>
          </View>
        </View>
      )}
      {/* Atölyenin adı: beyaz hap etiket. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: mcx - RIB_W / 2, top: ribTop + 6, width: RIB_W, alignItems: 'center' }}
      >
        <View style={{ backgroundColor: '#FFFAF0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 3, ...SH }}>
          <GText size={15} color="#4A2E1C">
            {d.name}
          </GText>
        </View>
      </View>
      {/* Sıra: boş yerler küçük madalyon; iş varsa ürün ve kalan süre; hazır olan çelenkli (dokununca toplanır). */}
      <Pressable
        onPress={ready > 0 ? onCollect : undefined}
        accessibilityLabel={ready > 0 ? 'Hazır olanları topla' : 'Üretim sırası'}
        style={{ position: 'absolute', left: mcx - rowW / 2, top: rowTop, flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}
      >
        {Array.from({ length: slots }, (_, k) => {
          const j = jobs[k];
          const done = !!j && j.ready <= now;
          const w = done ? QR : Q;
          return (
            <View key={k} style={{ width: w, alignItems: 'center', marginTop: done ? 0 : (QR - Q) / 2 }}>
              <View
                style={{
                  width: w,
                  height: w,
                  borderRadius: w / 2,
                  backgroundColor: j ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                  borderWidth: done ? 3 : 1.5,
                  borderColor: done ? '#76BA48' : 'rgba(255,255,255,0.8)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {j ? (
                  <Icon k={j.recipe} size={Math.round(w * 0.7)} />
                ) : (
                  <GText light size={11}>
                    Boş
                  </GText>
                )}
              </View>
              {j &&
                (done ? (
                  <View
                    style={{
                      marginTop: 1,
                      backgroundColor: '#76BA48',
                      borderRadius: 9,
                      borderWidth: 1.5,
                      borderColor: '#fff',
                      paddingHorizontal: 6,
                    }}
                  >
                    <GText size={10} color="#fff" style={{ lineHeight: 14 }}>
                      Hazır
                    </GText>
                  </View>
                ) : (
                  <GText light size={11} style={{ marginTop: 1, width: 70, textAlign: 'center' }}>
                    {timeLeft(j.ready - now)}
                  </GText>
                ))}
            </View>
          );
        })}
      </Pressable>
      {/* Atölye boşken kaldırılabilir (onay sorulur). Taşımak için ekran kapatılıp atölye basılı tutularak sürüklenir. */}
      {jobs.length === 0 && (
        <Pressable
          onPress={() =>
            Alert.alert(d.name, `Atölye kaldırılsın mı? ${Math.floor(d.cost / 2)} altın geri gelir.`, [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Kaldır', style: 'destructive', onPress: onRemove },
            ])
          }
          hitSlop={8}
          accessibilityLabel="Atölyeyi kaldır"
          style={{
            position: 'absolute',
            right: 14,
            bottom: bottom + 10,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', ...SH }} />
          <Ionicons name="trash-outline" size={18} color="#4A2E1C" />
        </Pressable>
      )}
      {/* Parmağın altındaki ürün */}
      {drag && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, width: M_ON, transform: [...xy.getTranslateTransform(), { scale: 1.15 }] }}
        >
          <Medal id={drag} size={M_ON} state="ok" on />
        </Animated.View>
      )}
    </View>
  );
}
