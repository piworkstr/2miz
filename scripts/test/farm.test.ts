// Çiftlik kuralları ve date planlayıcı için otomatik testler.  Çalıştır: npm run test
import {
  applyAction,
  bigOrderOf,
  collectionOf,
  CROPS,
  depotCap,
  depotUsed,
  DEPOT_BASE,
  farmOf,
  levelOf,
  MIN,
  N,
  newFarm,
  type Action,
  type Farm,
} from '../../src/lib/farm';
import { BUDGETS, makePlan, swapStep } from '../../src/lib/datePlan';

// Küçük bir doğrulama yardımcısı (Node tip tanımlarına gerek kalmasın).
declare const process: { exitCode?: number };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const assert = {
  ok: (v: unknown, msg?: string) => {
    if (!v) throw new Error(msg ?? 'beklenen doğru değildi');
  },
  equal: (a: unknown, b: unknown, msg?: string) => {
    if (a !== b) throw new Error(msg ?? `beklenen ${String(b)}, gelen ${String(a)}`);
  },
  notEqual: (a: unknown, b: unknown, msg?: string) => {
    if (a === b) throw new Error(msg ?? `farklı olmalıydı: ${String(a)}`);
  },
  deepEqual: (a: unknown, b: unknown, msg?: string) => {
    if (!same(a, b)) throw new Error(msg ?? `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);
  },
  match: (s: string, re: RegExp, msg?: string) => {
    if (!re.test(s)) throw new Error(msg ?? `"${s}" ${re} ile eşleşmedi`);
  },
};

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  }
};
const NOW = Date.UTC(2026, 5, 15, 9, 0, 0); // yaz, hafta içi
const act = (f: Farm, a: Action, now = NOW, uid = 'u1') => applyAction(f, a, uid, () => 'kendi', 'Ali', now, null);
const ok = (f: Farm, a: Action, now = NOW, uid = 'u1') => {
  const r = act(f, a, now, uid);
  assert.equal(typeof r, 'object', `beklenmeyen ret: ${r}`);
  return r as Exclude<typeof r, string>;
};
const soil = (f: Farm) => f.tiles.findIndex((t) => t.k === 'soil');
const grass = (f: Farm) =>
  f.tiles.findIndex((t, i) => t.k === 'grass' && Math.floor(i / N) > 10 && Math.floor(i / N) < 17 && i % N > 10 && i % N < 17);

test('yeni çiftlik 28x28 ve 100 altınla başlar', () => {
  const f = newFarm();
  assert.equal(f.tiles.length, N * N);
  assert.equal(f.coins, 100);
  assert.equal(levelOf(f.xp).level, 1);
});

test('ek → bekle → topla: ürün depoya girer, tecrübe artar, tarla boşalır', () => {
  let f = newFarm();
  let i = soil(f);
  if (i < 0) {
    i = grass(f);
    f = ok(f, { a: 'till', i } as Action).farm;
  }
  const r1 = ok(f, { a: 'plant', i, crop: 'bugday' } as Action);
  assert.equal(r1.farm.tiles[i].k, 'crop');
  assert.ok(r1.farm.coins < f.coins || CROPS.bugday.cost === 0);
  assert.equal(typeof act(r1.farm, { a: 'harvest', i } as Action, NOW + MIN), 'string', 'olgunlaşmadan toplanmamalı');
  const r2 = ok(r1.farm, { a: 'harvest', i } as Action, NOW + CROPS.bugday.mins * MIN * 3);
  assert.equal(r2.farm.tiles[i].k, 'soil');
  assert.ok((r2.farm.stock.bugday ?? 0) >= 1);
  assert.ok(r2.farm.xp > f.xp);
  assert.ok(r2.farm.seen?.bugday, 'koleksiyona işlenmeli');
});

test('altın yetmezse ekim reddedilir', () => {
  const f = { ...newFarm(), coins: 0 };
  let i = soil(f);
  if (i < 0) return; // başlangıçta tarla yoksa bu sınama geçilir
  const pricey = (Object.keys(CROPS) as (keyof typeof CROPS)[]).find((k) => CROPS[k].cost > 0 && CROPS[k].lvl <= 1);
  if (!pricey) return;
  assert.equal(typeof act(f, { a: 'plant', i, crop: pricey } as Action), 'string');
});

test('hasat sürprizi aynı girdide hep aynı sonucu verir', () => {
  let f = newFarm();
  let i = soil(f);
  if (i < 0) {
    i = grass(f);
    f = ok(f, { a: 'till', i } as Action).farm;
  }
  const planted = ok(f, { a: 'plant', i, crop: 'bugday' } as Action).farm;
  const later = NOW + CROPS.bugday.mins * MIN * 3;
  const a = ok(planted, { a: 'harvest', i } as Action, later);
  const b = ok(planted, { a: 'harvest', i } as Action, later);
  assert.deepEqual(a.drop, b.drop);
  assert.equal(a.farm.coins, b.farm.coins);
});

test('haftalık büyük sipariş: iki kişi doldurunca ödül ve %25 fazlası gelir', () => {
  const f0 = newFarm();
  const o = bigOrderOf(f0, NOW);
  const keys = Object.keys(o.items);
  assert.ok(keys.length >= 1); // 1. seviyede açık ekin azdır; sipariş yalnızca yetiştirilebilen ekinleri ister
  const first = keys[0];
  let f: Farm = { ...f0, stock: { ...o.items, [first]: o.items[first] - 2 } };
  const r1 = ok(f, { a: 'bigGive', i: 0 }, NOW, 'u1');
  assert.ok(!r1.farm.big?.done);
  f = { ...r1.farm, stock: { [first]: 5 } };
  const r2 = ok(f, { a: 'bigGive', i: 0 }, NOW, 'u2');
  assert.ok(r2.farm.big?.done);
  assert.equal(r2.gained, Math.round(o.coins * 1.25));
  assert.equal(r2.farm.stock[first], 3, 'fazlası depoda kalmalı');
  assert.equal(typeof act(r2.farm, { a: 'bigGive', i: 0 }, NOW, 'u2'), 'string', 'tamamlanan sipariş yeniden doldurulamaz');
  // sonraki hafta yeni sipariş
  assert.notEqual(bigOrderOf(r2.farm, NOW + 8 * 24 * 60 * MIN).week, o.week);
});

test('depo sınırı: dolu depoya hasat girmez, büyütünce girer', () => {
  let f = newFarm();
  let i = soil(f);
  if (i < 0) {
    i = grass(f);
    f = ok(f, { a: 'till', i } as Action).farm;
  }
  f = ok(f, { a: 'plant', i, crop: 'bugday' } as Action).farm;
  f = { ...f, stock: { havuc: DEPOT_BASE }, coins: 5000 };
  assert.equal(depotUsed(f), depotCap(f));
  const later = NOW + CROPS.bugday.mins * MIN * 3;
  assert.match(String(act(f, { a: 'harvest', i } as Action, later)), /Depo dolu/);
  const up = ok(f, { a: 'depotUp', i: 0 }, later);
  assert.ok(depotCap(up.farm) > depotCap(f));
  assert.ok(up.farm.coins < f.coins);
  ok(up.farm, { a: 'harvest', i } as Action, later);
});

test('koleksiyon: her 5 üründe ödül, aynı basamak iki kez alınmaz', () => {
  const f: Farm = { ...newFarm(), seen: { bugday: 1, havuc: 1, egg: 1, sut: 1, domates: 1 } };
  const c = collectionOf(f);
  assert.ok(c.have >= 4, `en az 4 bekleniyordu: ${c.have}`);
  if (c.claimable > 0) {
    const r = ok(f, { a: 'colClaim', i: 0 });
    assert.ok(r.farm.coins > f.coins);
    if (collectionOf(r.farm).claimable === 0) assert.equal(typeof act(r.farm, { a: 'colClaim', i: 0 }), 'string');
  }
});

test('ad verme: çiftlik en az 3, köpek en az 2 harf', () => {
  const f = newFarm();
  assert.equal(typeof act(f, { a: 'rename', i: 0, name: 'ab' }), 'string');
  assert.equal(ok(f, { a: 'rename', i: 0, name: '  Papatya  ' }).farm.name, 'Papatya');
  assert.equal(typeof act(f, { a: 'nameDog', i: 0, name: 'a' }), 'string');
  assert.equal(ok(f, { a: 'nameDog', i: 0, name: 'Karabaş' }).farm.dog, 'Karabaş');
});

test('eski arazi (22x22) yeni araziye büyütülürken altın ve depo korunur', () => {
  const big = newFarm();
  const f = farmOf({ farm5: { ...big, coins: 777, stock: { bugday: 3 } } } as never);
  assert.equal(f.coins, 777);
  assert.equal(f.stock.bugday, 3);
  assert.equal(f.tiles.length, N * N);
});

test('date planı: bütçeyi aşmaz, adımlar yinelenmez, soru ve fotoğraf adımı vardır, türe uyar', () => {
  for (const type of ['romantik', 'eglenceli', 'macera', 'sakin'] as const)
    for (const dur of ['short', 'half', 'full'] as const)
      for (const b of [200, ...BUDGETS, 5000])
        for (let s = 1; s <= 60; s++) {
          const now = s % 2 ? Date.UTC(2026, 6, 1) : Date.UTC(2026, 11, 1);
          const p = makePlan(type, dur, b, s * 7919, now);
          assert.ok(p.total <= b, `${type}/${dur}/${b}: ${p.total}`);
          assert.equal(new Set(p.steps.map((x) => x.id)).size, p.steps.length);
          assert.ok(p.steps.some((x) => x.k === 'question') && p.steps.some((x) => x.k === 'photo'));
          assert.ok(p.steps.length >= 3);
          if (type === 'macera') assert.ok(!p.steps.some((x) => x.id === 'kahve' || x.id === 'tatli'), 'macerada kahve/tatlı çıkmamalı');
          if (now === Date.UTC(2026, 11, 1))
            assert.ok(!p.steps.some((x) => x.id === 'kano' || x.id === 'piknik'), 'kışın kano/piknik çıkmamalı');
          const q = swapStep(p, 1, s);
          assert.ok(q.total <= b);
        }
});

console.log(process.exitCode ? 'Bazı testler geçmedi.' : `${passed} test geçti.`);
