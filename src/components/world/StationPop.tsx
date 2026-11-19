import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, Text, View } from 'react-native';
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
import { ART, stockArt } from '../../lib/farmArt';
import { UI } from '../../lib/farmUiArt';
import { GText, WOOD_INK, WoodButton, WoodPanel } from './FarmUI';

// Atölye, liste penceresiyle değil çiftliğin içinde açılır: ürünler makinenin üstünde yay hâlinde dizilir,
// istenen ürün makinenin üstüne sürüklenir (ya da dokunup "Başlat" denir); sıradaki işler makinenin altındaki kutularda görünür.
const B = 62; // ürün balonunun çapı
const DROP = 84; // makineye bırakma yarıçapı

function Icon({ k, size }: { k: string; size: number }) {
  const a = stockArt(k);
  if (a) return <Image source={a.src} style={{ width: size, height: size }} resizeMode="contain" />;
  return (
    <Text maxFontSizeMultiplier={1.0} style={{ fontSize: Math.round(size * 0.72), lineHeight: size, height: size }}>
      {STOCK_EMOJI[k] ?? '📦'}
    </Text>
  );
}

type DragApi = {
  start: (id: RecipeId, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (id: RecipeId, x: number, y: number, moved: boolean) => void;
};

function RecipeBubble({
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
  state: 'ok' | 'missing' | 'full' | 'locked';
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
  const r = RECIPES[id];
  return (
    <View
      {...pr.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={r.name}
      style={{
        position: 'absolute',
        left: x - B / 2,
        top: y - B / 2,
        width: B,
        height: B,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: hidden ? 0.25 : 1,
        transform: [{ scale: picked ? 1.12 : 1 }],
      }}
    >
      <Image source={UI.round.src} style={{ position: 'absolute', width: B, height: B }} resizeMode="stretch" />
      <View style={{ opacity: state === 'ok' ? 1 : state === 'locked' ? 0.35 : 0.6 }}>
        <Icon k={id} size={36} />
      </View>
      {state === 'locked' && (
        <View style={{ position: 'absolute', bottom: -4, backgroundColor: '#5A3A1C', borderRadius: 9, paddingHorizontal: 6 }}>
          <GText size={10} color="#FFE9B8" style={{ lineHeight: 15 }}>
            {`Sv ${r.lvl}`}
          </GText>
        </View>
      )}
      {state === 'missing' && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#D8455C',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#fff',
          }}
        >
          <GText size={11} color="#fff" style={{ lineHeight: 14 }}>
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
  sx: number; // makinenin ekrandaki yeri
  sy: number;
  box: { w: number; h: number };
  top: number; // üstte ve altta boş bırakılacak pay (gösterge, güvenli alan)
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
    .slice(0, 7);
  const stateOf = (id: RecipeId) =>
    level < RECIPES[id].lvl ? 'locked' : full ? 'full' : hasAll(farm, RECIPES[id].needs) ? 'ok' : 'missing';

  const [pick, setPick] = useState<RecipeId | null>(null);
  const [drag, setDrag] = useState<RecipeId | null>(null);
  const [over, setOver] = useState(false);
  const xy = useRef(new Animated.ValueXY()).current;
  const overRef = useRef(false);

  // Yerleşim: yayın merkezi makinedir; makine ekranın kenarındaysa yay ekranda kalacak kadar kayar.
  const n = list.length;
  const step = n > 5 ? 30 : 37;
  const R = n > 5 ? 142 : 116;
  const tot = (n - 1) * step;
  const half = R * Math.sin((Math.min(180, tot) / 2) * (Math.PI / 180)) + B / 2 + 6;
  const cardW = Math.min(310, box.w - 20);
  const cx = Math.min(box.w - Math.max(half, cardW / 2) - 4, Math.max(Math.max(half, cardW / 2) + 4, sx));
  const cy = Math.min(box.h - bottom - 236, Math.max(top + R + B / 2 + 6, sy));
  const pos = list.map((_id, k) => {
    const a = (-90 - tot / 2 + k * step) * (Math.PI / 180);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const near = (x: number, y: number) => Math.hypot(x - cx, y - cy) < DROP || Math.hypot(x - sx, y - sy) < DROP;

  const api = useRef<DragApi | null>(null);
  api.current = {
    start: (id, x, y) => {
      xy.setValue({ x: x - B / 2, y: y - B / 2 });
      overRef.current = false;
      setOver(false);
      setDrag(id);
      setPick(id);
      Haptics.selectionAsync().catch(() => {});
    },
    move: (x, y) => {
      xy.setValue({ x: x - B / 2, y: y - B / 2 });
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
      } else setPick(id); // neden olmadığı kartta yazar
    },
  };

  const pr = pick ? RECIPES[pick] : null;
  const pState = pick ? stateOf(pick) : null;
  const slotW = 46;
  const slotH = Math.round((slotW * UI.slot.h) / UI.slot.w);
  const rowW = slots * (slotW + 5) - 5;
  const rowTop = cy + 44;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 42 }}>
      {/* Bırakma hedefi: sürüklerken makinenin çevresinde halka */}
      {drag && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: sx - 54,
            top: sy - 54,
            width: 108,
            height: 108,
            borderRadius: 54,
            borderWidth: 4,
            borderColor: over ? '#8BE04E' : 'rgba(255,255,255,0.85)',
            backgroundColor: over ? 'rgba(139,224,78,0.28)' : 'rgba(255,255,255,0.16)',
          }}
        />
      )}
      {list.map((id, k) => (
        <RecipeBubble key={id} id={id} x={pos[k].x} y={pos[k].y} state={stateOf(id)} picked={pick === id} hidden={drag === id} api={api} />
      ))}
      {/* Sıra kutuları: hazır olan varsa dokununca toplanır */}
      <Pressable
        onPress={ready > 0 ? onCollect : undefined}
        accessibilityLabel={ready > 0 ? 'Hazır olanları topla' : 'Üretim sırası'}
        style={{ position: 'absolute', left: cx - rowW / 2, top: rowTop, flexDirection: 'row', gap: 5 }}
      >
        {Array.from({ length: slots }, (_, k) => {
          const j = jobs[k];
          const done = !!j && j.ready <= now;
          return (
            <View key={k} style={{ width: slotW, height: slotH, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={UI.slot.src}
                style={{ position: 'absolute', width: slotW, height: slotH, opacity: j ? 1 : 0.8 }}
                resizeMode="stretch"
              />
              {j && (
                <>
                  <Icon k={j.recipe} size={22} />
                  <GText size={9} color={done ? '#2F6E12' : WOOD_INK} style={{ lineHeight: 11 }}>
                    {done ? 'Hazır' : timeLeft(j.ready - now)}
                  </GText>
                </>
              )}
            </View>
          );
        })}
      </Pressable>
      {/* Bilgi kartı: seçilen ürünün malzemeleri; seçim yokken kısa yönerge */}
      {/* Karta dokunmak arkadaki çiftliğe geçmesin diye boş bir dokunma alanıdır. */}
      <Pressable onPress={() => {}} style={{ position: 'absolute', left: cx - cardW / 2, top: rowTop + slotH + 8, width: cardW }}>
        <WoodPanel cap={22}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {ART[d.sp] && <Image source={ART[d.sp].src} style={{ width: 26, height: 26 }} resizeMode="contain" />}
              <GText size={15} style={{ flex: 1 }}>
                {pr ? pr.name : d.name}
              </GText>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat">
                <Image source={UI.close.src} style={{ width: 26, height: 26 }} />
              </Pressable>
            </View>
            {ready > 0 && !pr && (
              <WoodButton kind="red" height={42} size={15} label={`Hazır olanları topla (${ready})`} onPress={onCollect} />
            )}
            {pr && pick ? (
              <>
                <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 12, fontWeight: '700', color: WOOD_INK }}>
                  {pState === 'locked'
                    ? `${pr.lvl}. seviyede açılır`
                    : `${timeLeft(pr.mins * MIN)} · satışı ${pr.sell} altın · +${pr.xp} tecrübe${(farm.stock[pick] ?? 0) > 0 ? ` · depoda ${farm.stock[pick]}` : ''}`}
                </Text>
                {pState !== 'locked' && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(pr.needs).map(([k, q]) => {
                      const have = farm.stock[k] ?? 0;
                      const enough = have >= q;
                      return (
                        <View
                          key={k}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderRadius: 11,
                            backgroundColor: enough ? '#E3F2D6' : '#FBDDE2',
                          }}
                        >
                          <Icon k={k} size={20} />
                          <Text
                            maxFontSizeMultiplier={1.0}
                            style={{ fontSize: 12, fontWeight: '800', color: enough ? '#2F6E12' : '#C7354F' }}
                          >
                            {PRODUCT_NAME[k]} {Math.min(have, q)}/{q}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {pState === 'missing' &&
                  Object.entries(pr.needs)
                    .filter(([k, q]) => (farm.stock[k] ?? 0) < q)
                    .map(([k, q]) => (
                      <Text key={k} maxFontSizeMultiplier={1.0} style={{ fontSize: 11, color: '#C7354F' }}>
                        {q - (farm.stock[k] ?? 0)} {PRODUCT_NAME[k].toLocaleLowerCase('tr-TR')} eksik · {sourceOf(k, farm)}
                      </Text>
                    ))}
                {pState === 'full' && (
                  <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 11, color: '#C7354F' }}>
                    Sıra dolu. Hazır olanı topla ya da bitmesini bekle.
                  </Text>
                )}
                {pState === 'ok' && (
                  <WoodButton
                    kind="green"
                    height={42}
                    size={15}
                    label="Başlat"
                    onPress={() => {
                      onCook(pick);
                      setPick(null);
                    }}
                  />
                )}
              </>
            ) : (
              <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 12, color: WOOD_INK }}>
                Ürünü makinenin üstüne sürükle; malzemesini görmek için dokun.
              </Text>
            )}
            {!pr && jobs.length === 0 && (
              <Pressable onPress={onRemove} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
                <Text
                  maxFontSizeMultiplier={1.0}
                  style={{ fontSize: 12, fontWeight: '800', color: '#9A5B2A', textDecorationLine: 'underline' }}
                >
                  {`Atölyeyi kaldır (+${Math.floor(d.cost / 2)} altın) · taşımak için basılı tutup sürükle`}
                </Text>
              </Pressable>
            )}
          </View>
        </WoodPanel>
      </Pressable>
      {/* Parmağın altındaki ürün */}
      {drag && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: B,
            height: B,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [...xy.getTranslateTransform(), { scale: 1.2 }],
          }}
        >
          <Image source={UI.round.src} style={{ position: 'absolute', width: B, height: B }} resizeMode="stretch" />
          <Icon k={drag} size={38} />
        </Animated.View>
      )}
    </View>
  );
}
