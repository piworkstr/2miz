import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';
import { Avatar } from '../../components/Avatar';
import { Btn, DreamHud, DreamSheet, DreamToast, Head, Note, Shop } from '../../components/world/DreamUI';
import { WorldChar } from '../../components/world/WorldChar';
import { DART } from '../../lib/dreamArt';
import { dreamAction, HITEMS, HN, homeOf, HOUSE_LV, ritualState, type HItemId, type HomeAction } from '../../lib/dreams';
import { farmOf } from '../../lib/farm';
import { notifyPartner } from '../../lib/push';
import { useSession } from '../../lib/session';

// Sahilde Ev: Ege kıyısında evinizi kurarsınız. Kalpli eşyalar günün güzel anlarıdır; ikiniz de gelince altın ve huzur kazanırsınız.

const TW = 64;
const TH = TW / 2;
const OX = (HN * TW) / 2 + TW * 3;
const OY = TW * 3.4;
const WW = HN * TW + TW * 6;
const WH = OY + HN * TH + TW * 5;
const center = (r: number, c: number) => ({ x: OX + ((c - r) * TW) / 2, y: OY + ((c + r) * TH) / 2 });
const rc = (i: number) => [Math.floor(i / HN), i % HN] as const;
function tileAt(px: number, py: number) {
  const dx = (px - OX) / (TW / 2);
  const dy = (py - OY) / (TH / 2);
  const c = Math.round((dy + dx) / 2);
  const r = Math.round((dy - dx) / 2);
  return r >= 0 && r < HN && c >= 0 && c < HN ? r * HN + c : -1;
}
const art = (item: HItemId) => DART[item] ?? DART.semsiye;

export default function HouseScreen() {
  const insets = useSafeAreaInsets();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [sel, setSel] = useState<number | 'house' | null>(null);
  const [toast, setToast] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!user || !couple || !partnerId) return null;
  const uid = user.uid;
  const myName = profile?.name ?? 'Ben';
  const home = homeOf(couple);
  const farm = farmOf(couple);
  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 2600);
  };

  async function act(x: HomeAction) {
    try {
      const r = await dreamAction(couple!.id, uid, myName, { w: 'home', x });
      if (typeof r === 'string') return flash(r);
      flash(r.text);
      if (x.a === 'ritual' && r.started)
        notifyPartner(partnerId!, r.text, 'Sahilde Ev’de seni bekliyor.', { type: 'mood', url: '/dream/house' });
      if (x.a === 'ritual' && r.joined) notifyPartner(partnerId!, `${myName} geldi 💛`, r.text, { type: 'mood', url: '/dream/house' });
      if (x.a === 'upgrade') notifyPartner(partnerId!, r.text, 'Sahilde Ev', { type: 'mood', url: '/dream/house' });
    } catch {
      flash('Olmadı, tekrar dene');
    }
  }

  // kamera: arsa ekranı doldursun
  const top = insets.top + 46;
  const bottom = 190 + insets.bottom;
  const s = box.w ? Math.min(1.25, box.w / (HN * TW + TW * 0.9), (box.h - top - bottom) / (HN * TH + TW * 2.6)) : 0.6;
  const tx = box.w / 2 - OX * s;
  const ty = top + (box.h - top - bottom) / 2 - (OY + HN * TH * 0.5 - TW * 0.7) * s;

  const pts = (r: number, c: number) => {
    const { x, y } = center(r, c);
    return `${x},${y - TH / 2} ${x + TW / 2},${y} ${x},${y + TH / 2} ${x - TW / 2},${y}`;
  };
  const T = center(0, 0);
  const L = center(HN - 1, 0);
  const R = center(0, HN - 1);
  const Bc = center(HN - 1, HN - 1);
  const lv = HOUSE_LV[home.lvl - 1];

  type Spr = { key: string; src: (typeof DART)[string]; x: number; y: number; w: number; z: number };
  const sprs: Spr[] = [];
  const put = (key: string, a: (typeof DART)[string], x: number, y: number, w: number, z: number) => sprs.push({ key, src: a, x, y, w, z });
  const ha = center(1, 1);
  const hb = center(0, 0);
  put('house', DART[lv.art], (ha.x + hb.x) / 2, ha.y + TH * 0.55, TW * 2.15, 26);
  const hearts: { key: string; x: number; y: number; z: number; waiting: boolean }[] = [];
  home.tiles.forEach((t, i) => {
    if (t.k !== 'item') return;
    const [r, c] = rc(i);
    const { x, y } = center(r, c);
    const it = HITEMS[t.item];
    put(`i${i}`, art(t.item), x, y + TH * 0.32, TW * it.w, (r + c) * 10 + 6);
    if (it.rit) {
      const by = ritualState(home, i);
      if (by.length < 2)
        hearts.push({ key: `h${i}`, x, y: y - TW * 0.85, z: (r + c) * 10 + 409, waiting: by.length === 1 && !by.includes(uid) });
    }
  });
  put('n1', DART.ev2, L.x - TW * 1.2, L.y - TW * 0.3, TW * 1.4, 1);
  put('n2', DART.zeytin, L.x - TW * 0.4, L.y + TW * 0.9, TW * 0.8, 2000);
  put('n3', DART.ev1, R.x + TW * 1.3, R.y + TW * 0.9, TW * 1.3, 2000);
  put('n4', DART.zeytin, Bc.x - TW * 1.6, Bc.y + TW * 1.2, TW * 0.8, 2000);
  put('n5', DART.pergola, Bc.x + TW * 1.4, Bc.y + TW * 1.0, TW * 0.9, 2000);
  put('n6', DART.semsiye, R.x + TW * 1.6, R.y - TW * 0.7, TW * 0.9, 1);
  put('n7', DART.sandal, R.x + TW * 0.2, R.y - TW * 2.2, TW * 1.0, 1);
  put('n8', DART.marti, R.x + TW * 2.6, R.y - TW * 1.4, TW * 0.45, 1);
  sprs.sort((a, b) => a.z - b.z);

  const myTile = home.pos[uid] ?? 2 * HN + 1;
  const pTile = home.pos[partnerId] ?? 2 * HN + 4;
  const at = (i: number, side: number) => {
    const { x, y } = center(...rc(i));
    return { x: x + side * TW * 0.35, y: y + TH * 0.4, z: (rc(i)[0] + rc(i)[1]) * 10 + 8 };
  };
  const me = at(myTile, -1);
  const pp = at(pTile, 1);

  let sheet: React.ReactNode;
  if (sel === 'house') {
    const next = HOUSE_LV[home.lvl];
    sheet = (
      <>
        <Head img={DART[lv.art].src} title={lv.name} onClose={() => setSel(null)} />
        {next ? (
          <>
            <Note>Sırada: {next.name}. Büyük ev yeni eşyaların (mangal, bisiklet, kedi, havuz) kilidini açar.</Note>
            <Btn
              label={`${next.name} · ${next.cost} altın`}
              onPress={() => act({ a: 'upgrade' }).then(() => setSel(null))}
              disabled={farm.coins < next.cost}
            />
          </>
        ) : (
          <Note>Hayalinizdeki villadasınız 🌸</Note>
        )}
      </>
    );
  } else if (typeof sel === 'number') {
    const t = home.tiles[sel];
    if (t.k === 'item') {
      const it = HITEMS[t.item];
      const by = ritualState(home, sel);
      const done = by.length >= 2;
      const mine = by.includes(uid);
      sheet = (
        <>
          <Head img={art(t.item).src} title={it.name} onClose={() => setSel(null)} />
          {it.rit ? (
            <>
              <Note>
                {done
                  ? `Bugün “${it.rit.toLowerCase()}” yaptınız 💛`
                  : mine
                    ? `${partnerName}’in gelmesini bekliyorsun. Gelince ikinize de +${it.gain} altın.`
                    : by.length
                      ? `${partnerName} seni bekliyor! Gel, birlikte ${it.rit.toLowerCase()}.`
                      : `${it.rit}: ikiniz birlikte. +${it.gain} altın, +1 huzur.`}
              </Note>
              <Btn
                kind="accent"
                label={by.length && !mine ? `Katıl: ${it.rit}` : it.rit}
                onPress={() => act({ a: 'ritual', i: sel }).then(() => setSel(null))}
                disabled={done || mine}
              />
            </>
          ) : (
            <Note>Evinizi güzelleştiriyor.</Note>
          )}
          <Btn
            kind="soft"
            label={`Kaldır (+${Math.floor(it.cost / 2)})`}
            onPress={() => act({ a: 'remove', i: sel }).then(() => setSel(null))}
          />
        </>
      );
    } else if (t.k === 'fixed') {
      sheet = null;
    } else {
      sheet = (
        <>
          <Head title={t.k === 'terrace' ? 'Boş teras' : 'Boş bahçe'} onClose={() => setSel(null)} />
          <Shop
            list={(Object.keys(HITEMS) as HItemId[]).map((id) => {
              const it = HITEMS[id];
              const lock = home.lvl < it.lvl;
              return {
                id,
                img: art(id).src,
                name: it.name,
                price: lock ? HOUSE_LV[it.lvl - 1].name : `${it.cost} altın`,
                sub: it.rit ?? 'süs',
                off: lock || farm.coins < it.cost,
                onPress: () => act({ a: 'place', i: sel, item: id }).then(() => setSel(null)),
              };
            })}
          />
        </>
      );
    }
  }
  if (sel === null || sheet === null) {
    const waiting = home.tiles.filter(
      (t, i) => t.k === 'item' && HITEMS[t.item].rit && ritualState(home, i).length === 1 && !ritualState(home, i).includes(uid),
    ).length;
    const open = home.tiles.filter((t, i) => t.k === 'item' && HITEMS[t.item].rit && ritualState(home, i).length < 2).length;
    sheet = (
      <>
        <Note center>
          {waiting
            ? `${partnerName} seni ${waiting} güzel an için bekliyor 💛 Kalpli eşyaya dokun.`
            : open
              ? `Bugün ${open} güzel an sizi bekliyor 💛 Eşyaya dokun, ikiniz birlikte yapın.`
              : 'Bugünkü anları yaşadınız. Yarın yine 💛'}
        </Note>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Note>
            {lv.name} · {home.huzur} huzur
          </Note>
          <View style={{ flex: 1 }} />
          <Btn kind="soft" label="Evi büyüt" onPress={() => setSel('house')} />
        </View>
      </>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: '#B8D88A' }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: WW,
            height: WH,
            transformOrigin: 'left top',
            transform: [{ translateX: tx }, { translateY: ty }, { scale: s }],
          }}
        >
          <Svg width={WW} height={WH} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Rect x={0} y={0} width={WW} height={WH} fill="#B8D88A" />
            <Rect x={0} y={0} width={WW} height={T.y + TW * 0.2} fill="#4FB3DE" />
            {Array.from({ length: 40 }, (_, k) => (
              <Path
                key={k}
                d={`M${(k * 89) % WW},${(k * 61) % (T.y - TW)} q6,-4 12,0 q6,4 12,0`}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={2}
                fill="none"
              />
            ))}
            <Path d={`M0,${T.y - TW * 0.4} L${WW},${T.y - TW * 2.6} L${WW},${WH} L0,${WH} Z`} fill="#F2DDA9" />
            <Path d={`M0,${T.y + TW * 0.6} L${WW},${T.y - TW * 1.6} L${WW},${WH} L0,${WH} Z`} fill="#B8D88A" />
            <Path
              d={`M${Bc.x - TW * 0.3},${Bc.y + TH / 2 + 16} C${Bc.x - TW * 0.4},${Bc.y + TW * 1.2} ${Bc.x + TW * 0.5},${Bc.y + TW * 1.8} ${Bc.x + TW * 0.3},${WH} L${Bc.x + TW * 1.1},${WH} C${Bc.x + TW * 1.2},${Bc.y + TW * 1.8} ${Bc.x + TW * 0.3},${Bc.y + TW * 1.2} ${Bc.x + TW * 0.3},${Bc.y + TH / 2 + 16} Z`}
              fill="#EFE6D6"
              stroke="#D9CBB3"
            />
            <Polygon
              points={`${L.x - TW / 2},${L.y} ${Bc.x},${Bc.y + TH / 2} ${Bc.x},${Bc.y + TH / 2 + 16} ${L.x - TW / 2},${L.y + 16}`}
              fill="#D7CBB6"
            />
            <Polygon
              points={`${Bc.x},${Bc.y + TH / 2} ${R.x + TW / 2},${R.y} ${R.x + TW / 2},${R.y + 16} ${Bc.x},${Bc.y + TH / 2 + 16}`}
              fill="#BFB29C"
            />
            {home.tiles.map((t, i) => {
              const [r, c] = rc(i);
              const fill =
                t.k === 'terrace' || (t.k === 'item' && (r === 2 || c === 2))
                  ? (r + c) % 2
                    ? '#EFE6D6'
                    : '#E6DBC7'
                  : (r + c) % 2
                    ? '#9DCE62'
                    : '#94C75A';
              return <Polygon key={i} points={pts(r, c)} fill={fill} stroke="rgba(255,255,255,0.12)" />;
            })}
            {typeof sel === 'number' && <Polygon points={pts(...rc(sel))} fill="rgba(255,255,255,0.3)" stroke="#fff" strokeWidth={3} />}
          </Svg>
          {sprs.map((p) => (
            <Image
              key={p.key}
              source={p.src.src}
              style={{
                position: 'absolute',
                left: p.x - p.w / 2,
                top: p.y - p.w * p.src.h,
                width: p.w,
                height: p.w * p.src.h,
                zIndex: p.z,
              }}
            />
          ))}
          {hearts.map((h) => (
            <View
              key={h.key}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: h.x - 15,
                top: h.y - 15,
                width: 30,
                height: 30,
                borderRadius: 15,
                zIndex: h.z,
                backgroundColor: h.waiting ? '#E8516A' : '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                elevation: 3,
              }}
            >
              {h.waiting ? <Avatar p={partnerProfile} name={partnerName} size={24} showMood={false} /> : <Heart />}
            </View>
          ))}
          <WorldChar profile={partnerProfile} name={partnerName} x={pp.x} y={pp.y} z={pp.z} tag={partnerName} />
          <WorldChar profile={profile} name={myName} x={me.x} y={me.y} z={me.z + 1} />
        </View>
      )}
      <Pressable
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        onPress={(e) => {
          const i = tileAt((e.nativeEvent.locationX - tx) / s, (e.nativeEvent.locationY - ty) / s);
          if (i < 0) return setSel(null);
          if (home.tiles[i].k === 'fixed') return setSel('house');
          setSel(sel === i ? null : i);
        }}
      />
      <DreamHud
        title={lv.name}
        sub={`${home.huzur} huzur`}
        coins={farm.coins}
        left={<Avatar p={profile} name={myName} size={30} showMood={false} />}
      />
      <DreamToast text={toast} />
      <DreamSheet>{sheet}</DreamSheet>
    </View>
  );
}

function Heart() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2 0 3.6 1.1 5.3 3 1.7-1.9 3.3-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"
        fill="#E8516A"
      />
    </Svg>
  );
}
