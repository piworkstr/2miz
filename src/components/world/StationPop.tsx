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
import { UI } from '../../lib/farmUiArt';
import { GText } from './FarmUI';

// Atölye ekranı: çiftlik kararır, atölye parlak kalır. Ürünler atölyenin üstünde yay hâlinde, altın çerçeveli madalyonlarda
// durur; istenen ürün atölyenin üstüne sürüklenir. Ürüne dokununca parşömen balonda adı, süresi ve malzemeleri görünür.
// Atölyenin adı altındaki kurdelede, sıradaki işler onun altındaki madalyonlardadır.
// Ekran açıkken çiftlik kaydırılamaz (karartı dokunuşu alır): parçalar hep aynı yerde durur.
const M = 52; // ürün madalyonunun çapı
const M_ON = 60; // seçili madalyon
const R = 138; // yayın yarıçapı
const STEP = 30; // madalyonlar arası açı
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

// Madalyon: çerçeve çizimi + içine oturan ürün. Ürün, çerçevenin krem iç alanının ölçüsündedir (taşmaz).
function Medal({ id, size, state, on }: { id: string; size: number; state: St; on: boolean }) {
  const art = state === 'locked' ? UI.med_lock : on ? UI.med_on : UI.med;
  const h = Math.round((size * art.h) / art.w);
  return (
    <View style={{ width: size, height: h, alignItems: 'center' }}>
      <Image source={art.src} style={{ position: 'absolute', width: size, height: h }} resizeMode="stretch" />
      <View style={{ height: size, alignItems: 'center', justifyContent: 'center', opacity: state === 'locked' ? 0.5 : 1 }}>
        <Icon k={id} size={Math.round(size * 0.62)} />
      </View>
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
  api,
}: {
  id: RecipeId;
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
  const size = picked ? M_ON : M;
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
        <GText light size={11} style={{ marginTop: 2, width: 90, textAlign: 'center' }}>
          {`Seviye ${r.lvl}`}
        </GText>
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
            backgroundColor: '#D8455C',
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
    .sort((a, b) => RECIPES[a].lvl - RECIPES[b].lvl)
    // Açılmış tarifler ve sıradaki tek kilitli tarif (ne geleceği görünsün).
    .filter((id, _k, all) => RECIPES[id].lvl <= level || all.filter((q) => RECIPES[q].lvl > level).indexOf(id) < 1)
    .slice(0, 6);
  const stateOf = (id: RecipeId): St =>
    level < RECIPES[id].lvl ? 'locked' : full ? 'full' : hasAll(farm, RECIPES[id].needs) ? 'ok' : 'missing';

  const [pick, setPick] = useState<RecipeId | null>(null);
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
  const tot = (n - 1) * STEP;
  const half = R * Math.sin((Math.min(180, tot) / 2) * (Math.PI / 180)) + M_ON / 2 + 6;
  const BAL_W = 214;
  const BAL_H = Math.round((BAL_W * UI.balloon.h) / UI.balloon.w);
  const cx = Math.min(box.w - half, Math.max(half, mcx));
  const cy = Math.min(box.h - bottom - mh / 2 - 150, Math.max(top + BAL_H + R + M_ON / 2 - 8, mcy - mh * 0.18));
  const pos = list.map((_id, k) => {
    const a = (-90 - tot / 2 + k * STEP) * (Math.PI / 180);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const near = (x: number, y: number) => Math.hypot(x - mcx, y - mcy) < DROP;

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
  const balLeft = pAt ? Math.min(box.w - BAL_W - 6, Math.max(6, pAt.x - BAL_W * 0.47)) : 0;
  const balTop = pAt ? pAt.y - M_ON / 2 - BAL_H + 6 : 0;
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

  const RIB_W = 150;
  const RIB_H = Math.round((RIB_W * UI.ribbon2.h) / UI.ribbon2.w);
  const ribTop = Math.min(box.h - bottom - RIB_H - 96, mcy + mh / 2 - 6);
  const Q = 36; // sıra madalyonu
  const QR = 46; // hazır olanın çelengi
  const rowW = slots * (Q + 6) - 6 + (QR - Q);
  const rowTop = ribTop + RIB_H + 2;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 46 }}>
      {/* Karartı: çiftliğe dokunuşu keser (kaydırma yok), dokununca ekran kapanır. */}
      <Pressable
        accessibilityLabel="Atölyeyi kapat"
        onPress={onClose}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,12,4,0.5)' }}
      />
      {/* Atölye karartının üstünde, ışık içinde yeniden çizilir. Hazır ürün varsa dokununca toplanır. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: mcx - mw * 0.75,
          top: mcy - mh * 0.75,
          width: mw * 1.5,
          height: mh * 1.5,
          borderRadius: mw,
          backgroundColor: drag ? (over ? 'rgba(139,224,78,0.42)' : 'rgba(255,236,170,0.34)') : 'rgba(255,236,170,0.2)',
        }}
      />
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
        <RecipeMedal key={id} id={id} x={pos[k].x} y={pos[k].y} state={stateOf(id)} picked={pk === id} hidden={drag === id} api={api} />
      ))}
      {/* Seçili ürünün parşömen balonu: ad + süre, malzemeler, tek satır yönerge. İçerik parşömenin iç alanına ortalanır. */}
      {pr && pk && pAt && !drag && (
        <View pointerEvents="none" style={{ position: 'absolute', left: balLeft, top: balTop, width: BAL_W, height: BAL_H }}>
          <Image source={UI.balloon.src} style={{ position: 'absolute', width: BAL_W, height: BAL_H }} resizeMode="stretch" />
          <View
            style={{
              position: 'absolute',
              left: BAL_W * 0.09,
              right: BAL_W * 0.09,
              top: BAL_H * 0.1,
              height: BAL_H * 0.62,
              justifyContent: 'space-evenly',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
              <GText size={15} style={{ flexShrink: 1 }}>
                {pr.name}
              </GText>
              <GText size={12} color="#8A6A45">
                {timeLeft(pr.mins * MIN)}
              </GText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', alignSelf: 'stretch' }}>
              {needs.slice(0, 4).map(([k, q]) => {
                const have = farm.stock[k] ?? 0;
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Icon k={k} size={22} />
                    <GText size={14} color={have >= q ? GREEN_INK : RED_INK}>{`${Math.min(have, q)}/${q}`}</GText>
                  </View>
                );
              })}
            </View>
            <GText size={11} color={pState === 'ok' ? '#8A6A45' : RED_INK}>
              {hint}
            </GText>
          </View>
        </View>
      )}
      {/* Kurdele: atölyenin adı. Yazı kurdelenin düz orta kısmına sığar. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: mcx - RIB_W / 2, top: ribTop, width: RIB_W, height: RIB_H }}>
        <Image source={UI.ribbon2.src} style={{ position: 'absolute', width: RIB_W, height: RIB_H }} resizeMode="stretch" />
        <View
          style={{
            position: 'absolute',
            left: RIB_W * 0.2,
            right: RIB_W * 0.2,
            top: RIB_H * 0.2,
            height: RIB_H * 0.46,
            justifyContent: 'center',
          }}
        >
          <GText light size={d.name.length > 13 ? 11 : 13} style={{ textAlign: 'center' }}>
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
          const art = done ? UI.wreath : UI.med;
          const h = Math.round((w * art.h) / art.w);
          return (
            <View key={k} style={{ width: w, alignItems: 'center', marginTop: done ? 0 : (QR - Q) / 2 }}>
              <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={art.src} style={{ position: 'absolute', width: w, height: h, opacity: j ? 1 : 0.9 }} resizeMode="stretch" />
                {j && <Icon k={j.recipe} size={Math.round(w * (done ? 0.46 : 0.6))} />}
              </View>
              {j &&
                (done ? (
                  <View
                    style={{
                      marginTop: 1,
                      backgroundColor: '#62AA34',
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
                  <GText light size={10} style={{ marginTop: 1 }}>
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
          style={{ position: 'absolute', left: mcx - 60, width: 120, top: rowTop + QR + 22, alignItems: 'center' }}
        >
          <GText light size={11} style={{ textDecorationLine: 'underline' }}>
            Atölyeyi kaldır
          </GText>
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
