import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Button, Card, Muted, Screen, T } from '../components/ui';
import {
  ANIMALS,
  COLS,
  CROPS,
  DECOR,
  farmAction,
  farmOf,
  farmSummary,
  levelOf,
  timeLeft,
  unlockCost,
  type Action,
  type AnimalId,
  type CropId,
  type DecorId,
  type Tile,
} from '../lib/farm';
import { notifyPartner } from '../lib/push';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

// Çiftlik kendi renkleriyle: çimen ve toprak her temada aynı.
const GRASS = '#8BC34A';
const GRASS_DARK = '#689F38';
const LOCKED = '#5D7A3A';
const SOIL = '#8D6E63';
const SOIL_DARK = '#6D4C41';

type Shop = 'crop' | 'animal' | 'decor';

export default function GardenScreen() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const [now, setNow] = useState(Date.now());
  const [sel, setSel] = useState<number | null>(null);
  const [shop, setShop] = useState<Shop>('crop');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (!user || !couple || !partnerId) return null;
  const uid = user.uid;
  const myName = profile?.name ?? 'Partnerin';
  const farm = farmOf(couple);
  const lv = levelOf(farm.xp);
  const sum = farmSummary(farm, uid, now);
  const tile = sel !== null ? farm.tiles[sel] : null;

  const W = Math.min(width - 40, 420);
  const gap = 4;
  const size = (W - 12 - gap * (COLS - 1)) / COLS;

  async function act(a: Action) {
    if (busy || !couple) return;
    setBusy(true);
    setMsg('');
    try {
      const target = a.i >= 0 ? farm.tiles[a.i] : null;
      const r = await farmAction(couple.id, uid, myName, a);
      if (typeof r === 'string') setMsg(r);
      else {
        setMsg(r.gained ? `+${r.gained} altın` : '');
        if (a.a === 'plant') {
          const c = CROPS[a.crop];
          notifyPartner(partnerId!, `${myName} bahçeye ${c.art} ${c.name.toLowerCase()} ekti`, 'Sen sularsan iki kat hızlı büyür 💧', {
            type: 'mood',
            url: '/garden',
          });
        }
        if (a.a === 'water' && target?.k === 'crop') {
          notifyPartner(target.by, `${myName} ektiğin ${CROPS[target.crop].art} ürünü suladı 💧`, 'İki kat hızlı büyüyor.', {
            type: 'mood',
            url: '/garden',
          });
        }
        if (a.a !== 'water') setSel(null);
      }
    } catch {
      setMsg('Olmadı, tekrar dene.');
    }
    setBusy(false);
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={t.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, color: t.colors.text, fontSize: 22, fontWeight: '700', fontFamily: t.fonts.display }}>Bizim Bahçe</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: '#FFF3C4',
          }}
        >
          <Text style={{ fontSize: 16 }}>🪙</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#7A5A00' }}>{farm.coins}</Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T style={{ fontWeight: '700' }}>Seviye {lv.level}</T>
          <Muted style={{ fontSize: 12 }}>
            {farm.xp - lv.from} / {lv.to - lv.from} tecrübe
          </Muted>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.border, overflow: 'hidden' }}>
          <View
            style={{ width: `${Math.round(((farm.xp - lv.from) / (lv.to - lv.from)) * 100)}%`, height: 8, backgroundColor: GRASS_DARK }}
          />
        </View>
      </View>

      <View
        style={{
          width: W,
          alignSelf: 'center',
          padding: 6,
          borderRadius: 16,
          backgroundColor: GRASS,
          borderWidth: 3,
          borderColor: GRASS_DARK,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap,
        }}
      >
        {farm.tiles.map((tl, i) => (
          <TileView key={i} tile={tl} size={size} now={now} uid={uid} selected={sel === i} onPress={() => setSel(sel === i ? null : i)} />
        ))}
      </View>

      {(sum.ready > 0 || msg) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {msg ? (
            <Text style={{ flex: 1, color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.body }}>{msg}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {sum.ready > 0 && <Button label={`Hepsini topla (${sum.ready})`} busy={busy} onPress={() => act({ a: 'all', i: -1 })} />}
        </View>
      )}

      {tile && sel !== null ? (
        <Card style={{ gap: 10 }}>
          <Panel
            tile={tile}
            i={sel}
            uid={uid}
            now={now}
            level={lv.level}
            coins={farm.coins}
            unlock={unlockCost(farm)}
            partnerName={partnerName}
            shop={shop}
            setShop={setShop}
            busy={busy}
            act={act}
          />
        </Card>
      ) : (
        <Muted style={{ textAlign: 'center' }}>
          Bir kareye dokun: ek, sula, hasat et, hayvan al ya da süsle. {partnerName}’in ektiğini sen sularsan iki kat hızlı büyür.
        </Muted>
      )}

      {farm.log.length > 0 && (
        <Card style={{ gap: 6 }}>
          <T style={{ fontWeight: '700' }}>Bahçede neler oldu</T>
          {farm.log.slice(0, 6).map((l, k) => (
            <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
              <Muted style={{ fontSize: 12, width: 52 }}>{ago(now - l.at)}</Muted>
              <T style={{ flex: 1, fontSize: 14 }}>{l.text}</T>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function ago(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} sa` : `${Math.floor(h / 24)} gün`;
}

function TileView({
  tile,
  size,
  now,
  uid,
  selected,
  onPress,
}: {
  tile: Tile;
  size: number;
  now: number;
  uid: string;
  selected: boolean;
  onPress: () => void;
}) {
  let bg = GRASS;
  let art = '';
  let artSize = size * 0.55;
  let badge = '';
  let ring: string | null = null;
  let progress: number | null = null;

  if (tile.k === 'locked') {
    bg = LOCKED;
    art = '🔒';
    artSize = size * 0.3;
  } else if (tile.k === 'soil') bg = SOIL;
  else if (tile.k === 'crop') {
    bg = SOIL;
    const p = Math.min(1, (now - tile.at) / Math.max(1, tile.ready - tile.at));
    if (now >= tile.ready) {
      art = CROPS[tile.crop].art;
      artSize = size * 0.62;
      badge = '✨';
    } else {
      art = p < 0.4 ? '🌱' : '🌿';
      artSize = size * (0.3 + p * 0.25);
      progress = p;
      if (tile.watered) badge = '💧';
      else if (tile.by !== uid) ring = '#4FC3F7';
    }
  } else if (tile.k === 'animal') {
    art = ANIMALS[tile.item].art;
    if (now >= tile.last + ANIMALS[tile.item].mins * 60000) badge = ANIMALS[tile.item].product;
  } else {
    art = DECOR[tile.item].art;
    artSize = size * 0.62;
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 3 : ring ? 2 : bg === SOIL ? 2 : 0,
        borderColor: selected ? '#FFFFFF' : (ring ?? SOIL_DARK),
        opacity: tile.k === 'locked' ? 0.85 : 1,
      }}
    >
      {bg === SOIL && (
        <View style={{ position: 'absolute', left: 6, right: 6, top: size * 0.3, gap: size * 0.18 }}>
          {[0, 1, 2].map((k) => (
            <View key={k} style={{ height: 2, borderRadius: 1, backgroundColor: SOIL_DARK, opacity: 0.6 }} />
          ))}
        </View>
      )}
      {!!art && <Text style={{ fontSize: artSize }}>{art}</Text>}
      {!!badge && (
        <View style={{ position: 'absolute', top: -4, right: -4, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 3 }}>
          <Text style={{ fontSize: size * 0.24 }}>{badge}</Text>
        </View>
      )}
      {progress !== null && (
        <View
          style={{ position: 'absolute', left: 6, right: 6, bottom: 5, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.25)' }}
        >
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 4, borderRadius: 2, backgroundColor: '#FFEB3B' }} />
        </View>
      )}
    </Pressable>
  );
}

type PanelProps = {
  tile: Tile;
  i: number;
  uid: string;
  now: number;
  level: number;
  coins: number;
  unlock: number;
  partnerName: string;
  shop: Shop;
  setShop: (s: Shop) => void;
  busy: boolean;
  act: (a: Action) => void;
};

function Panel({ tile, i, uid, now, level, coins, unlock, partnerName, shop, setShop, busy, act }: PanelProps) {
  const t = useTheme();

  if (tile.k === 'locked') {
    return (
      <>
        <T style={{ fontWeight: '700', fontSize: 17 }}>Yeni arazi</T>
        <Muted>Bu araziyi açıp ekin, hayvan ya da süs koyabilirsiniz.</Muted>
        <Button label={`Arazi aç · ${unlock} 🪙`} busy={busy} onPress={() => act({ a: 'unlock', i })} />
      </>
    );
  }

  if (tile.k === 'crop') {
    const c = CROPS[tile.crop];
    const done = now >= tile.ready;
    const mine = tile.by === uid;
    return (
      <>
        <T style={{ fontWeight: '700', fontSize: 17 }}>
          {c.art} {c.name}
        </T>
        <Muted>
          {done
            ? `Hasada hazır: +${c.sell} altın, +${c.xp} tecrübe`
            : `${timeLeft(tile.ready - now)} kaldı · ${mine ? 'sen ektin' : `${partnerName} ekti`}${tile.watered ? ' · sulandı 💧' : ''}`}
        </Muted>
        {done && <Button label="Hasat et" busy={busy} onPress={() => act({ a: 'harvest', i })} />}
        {!done && !mine && !tile.watered && <Button label="Sula 💧 (iki kat hız)" busy={busy} onPress={() => act({ a: 'water', i })} />}
        {!done && mine && !tile.watered && <Muted style={{ fontSize: 12 }}>{partnerName} sularsa kalan süre yarıya iner.</Muted>}
      </>
    );
  }

  if (tile.k === 'animal') {
    const an = ANIMALS[tile.item];
    const at = tile.last + an.mins * 60000;
    const done = now >= at;
    return (
      <>
        <T style={{ fontWeight: '700', fontSize: 17 }}>
          {an.art} {an.name}
        </T>
        <Muted>{done ? `${an.product} hazır: +${an.sell} altın` : `${an.product} için ${timeLeft(at - now)} kaldı`}</Muted>
        {done && <Button label={`${an.product} topla`} busy={busy} onPress={() => act({ a: 'collect', i })} />}
        <Pressable onPress={() => act({ a: 'remove', i })} style={{ alignItems: 'center', padding: 4 }}>
          <Text style={{ color: t.colors.muted, fontSize: 13 }}>Sat (+{Math.floor(an.cost / 2)} 🪙)</Text>
        </Pressable>
      </>
    );
  }

  if (tile.k === 'decor') {
    const d = DECOR[tile.item];
    return (
      <>
        <T style={{ fontWeight: '700', fontSize: 17 }}>
          {d.art} {d.name}
        </T>
        <Muted>Bahçenizi güzelleştiriyor.</Muted>
        <Pressable onPress={() => act({ a: 'remove', i })} style={{ alignItems: 'center', padding: 4 }}>
          <Text style={{ color: t.colors.muted, fontSize: 13 }}>Kaldır (+{Math.floor(d.cost / 2)} 🪙)</Text>
        </Pressable>
      </>
    );
  }

  // Boş toprak: dükkân
  const items =
    shop === 'crop'
      ? (Object.keys(CROPS) as CropId[]).map((id) => ({
          id,
          ...CROPS[id],
          sub: `${timeLeft(CROPS[id].mins * 60000)} · ${CROPS[id].sell} 🪙`,
          go: () => act({ a: 'plant', i, crop: id }),
        }))
      : shop === 'animal'
        ? (Object.keys(ANIMALS) as AnimalId[]).map((id) => ({
            id,
            ...ANIMALS[id],
            sub: `${ANIMALS[id].product} ${timeLeft(ANIMALS[id].mins * 60000)}de`,
            go: () => act({ a: 'animal', i, item: id }),
          }))
        : (Object.keys(DECOR) as DecorId[]).map((id) => ({
            id,
            ...DECOR[id],
            sub: `+${DECOR[id].xp} tecrübe`,
            go: () => act({ a: 'decor', i, item: id }),
          }));

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(
          [
            ['crop', 'Tohum'],
            ['animal', 'Hayvan'],
            ['decor', 'Süs'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setShop(k)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 999,
              alignItems: 'center',
              backgroundColor: shop === k ? t.colors.primary : t.colors.card,
              borderWidth: 1,
              borderColor: shop === k ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: shop === k ? t.colors.onPrimary : t.colors.text, fontWeight: '600', fontFamily: t.fonts.button }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {items.map((it) => {
          const lockedLv = level < it.lvl;
          const poor = coins < it.cost;
          return (
            <Pressable
              key={it.id}
              disabled={busy || lockedLv || poor}
              onPress={it.go}
              style={({ pressed }) => ({
                width: 96,
                padding: 8,
                borderRadius: 12,
                alignItems: 'center',
                gap: 2,
                borderWidth: 1.5,
                borderColor: pressed ? t.colors.primary : t.colors.border,
                backgroundColor: pressed ? t.colors.primarySoft : t.colors.card,
                opacity: lockedLv || poor ? 0.45 : 1,
              })}
            >
              <Text style={{ fontSize: 32 }}>{it.art}</Text>
              <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 13, fontFamily: t.fonts.body }} numberOfLines={1}>
                {it.name}
              </Text>
              <Text style={{ color: '#7A5A00', fontWeight: '700', fontSize: 12 }}>{lockedLv ? `Seviye ${it.lvl}` : `${it.cost} 🪙`}</Text>
              <Muted style={{ fontSize: 10, textAlign: 'center' }}>
                {it.sub}
              </Muted>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}
