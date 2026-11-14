// Çit ve taş duvar: resim yerine çizim. Komşu karedeki aynı türle kendiliğinden birleşir, böylece her iki yönde de
// boşluk bırakmadan ve üst üste binmeden sıra, köşe, T ve artı yapılabilir.
// Kutu: genişlik 64 (bir kare), yükseklik 72; zemindeki kare merkezi (32, 56).
export type WallKind = 'cit' | 'duvar';
export type Shape = { d: string; fill?: string; stroke?: string; sw?: number };
export const WALL_BOX = { w: 64, h: 72, cx: 32, cy: 56 };
// Bit sırası: 1 = arka sağ (satır-1), 2 = ön sağ (sütun+1), 4 = ön sol (satır+1), 8 = arka sol (sütun-1)
const DIRS: [number, number, number][] = [
  [1, 16, -8],
  [2, 16, 8],
  [4, -16, 8],
  [8, -16, -8],
];

function fenceArm(dx: number, dy: number): Shape[] {
  const { cx, cy } = WALL_BOX;
  const out: Shape[] = [];
  // iki yatay lata
  for (const h of [8, 17]) {
    out.push({ d: `M${cx},${cy - h} L${cx + dx},${cy + dy - h}`, stroke: '#B79E78', sw: 4.6 });
    out.push({ d: `M${cx},${cy - h} L${cx + dx},${cy + dy - h}`, stroke: '#E9DCC2', sw: 3 });
  }
  // aradaki ince tahtalar
  for (const t of [0.34, 0.67, 1]) out.push(picket(cx + dx * t, cy + dy * t, 2));
  return out;
}
const picket = (x: number, y: number, w: number): Shape => ({
  d: `M${x - w},${y - 3} L${x - w},${y - 22} L${x},${y - 25.5} L${x + w},${y - 22} L${x + w},${y - 3} Z`,
  fill: '#F3E8D2',
  stroke: '#B79E78',
  sw: 0.9,
});

function stoneArm(dx: number, dy: number): Shape[] {
  const { cx, cy } = WALL_BOX;
  const H = 17;
  const T = 4; // üst yüzün yarı kalınlığı
  const x1 = cx + dx;
  const y1 = cy + dy;
  // kalınlık, kolun yönüne dik (izometrik) eksende
  const px = dx > 0 === dy > 0 ? -T : T;
  const py = T / 2;
  const side = `M${cx + px},${cy + py} L${x1 + px},${y1 + py} L${x1 + px},${y1 + py - H} L${cx + px},${cy + py - H} Z`;
  const top = `M${cx - px},${cy - py - H} L${x1 - px},${y1 - py - H} L${x1 + px},${y1 + py - H} L${cx + px},${cy + py - H} Z`;
  const j = (t: number, a: number, b: number) =>
    `M${cx + px + dx * t},${cy + py + dy * t - a} L${cx + px + dx * t},${cy + py + dy * t - b}`;
  const row = (h: number) => `M${cx + px},${cy + py - h} L${x1 + px},${y1 + py - h}`;
  return [
    { d: side, fill: '#A9A39A', stroke: '#7E786F', sw: 1 },
    { d: `${row(6)} ${row(12)} ${j(0.5, 0, 6)} ${j(0.25, 6, 12)} ${j(0.75, 6, 12)} ${j(0.5, 12, H)}`, stroke: '#7E786F', sw: 0.8 },
    { d: top, fill: '#D2CCC2', stroke: '#8F897F', sw: 1 },
  ];
}

// Dipteki çiçek öbekleri: yaprak, sap ve üçer çiçek. h: sap boyu (arkadakiler duvarın üstünden görünsün diye uzun).
// Bir karede onlarca öbek olur; telefonda ağır olmasın diye hepsi birkaç yolda (yaprak, sap, renk başına bir) birleştirilir.
const COLORS = ['#FF8FB1', '#FFD45C', '#FFFFFF', '#C59BFF'];
type Bed = { x: number; y: number; h: number; k: number };
const n1 = (v: number) => Math.round(v * 10) / 10;
const circ = (x: number, y: number, r: number) => `M${n1(x - r)},${n1(y)} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
function flowerShapes(beds: Bed[]): Shape[] {
  if (!beds.length) return [];
  let leaves = '';
  let stems = '';
  let hearts = '';
  const petals = COLORS.map(() => '');
  for (const { x, y, h, k } of beds) {
    leaves += `M${n1(x - 7)},${n1(y)} a7,3.5 0 1,0 14,0 a7,3.5 0 1,0 -14,0`;
    const heads: [number, number][] = [
      [x - 4, y - h + 1],
      [x + 4, y - h],
      [x, y - h - 3],
    ];
    heads.forEach(([hx, hy], n) => {
      stems += `M${n1(hx * 0.75 + x * 0.25)},${n1(y)} L${n1(hx)},${n1(hy)}`;
      petals[(k + n) % COLORS.length] += circ(hx, hy, 2.8);
      hearts += circ(hx, hy, 0.9);
    });
  }
  return [
    { d: leaves, fill: '#5FA84A' },
    { d: stems, stroke: '#4C9440', sw: 1.2 },
    ...petals.flatMap((d, n) => (d ? [{ d, fill: COLORS[n], stroke: 'rgba(120,70,60,0.35)', sw: 0.5 }] : [])),
    { d: hearts, fill: '#F2A33A' },
  ];
}

export function wallShapes(kind: WallKind, mask: number, flowers = false): Shape[] {
  const { cx, cy } = WALL_BOX;
  const m = mask || 10; // tek başına: düz bir parça
  const arms = DIRS.filter(([b]) => m & b);
  const back = arms.filter(([, , dy]) => dy < 0);
  const front = arms.filter(([, , dy]) => dy > 0);
  const arm = kind === 'cit' ? fenceArm : stoneArm;
  const out: Shape[] = [{ d: `M${cx - 15},${cy + 1} a15,6 0 1,0 30,0 a15,6 0 1,0 -30,0`, fill: 'rgba(40,60,30,0.16)' }];
  // Çiçekli tür: her kolun iki yanında, karenin boş kalan yarısını dolduran sık çiçek öbekleri (kol boyunca 3, enine 2 sıra).
  const backBeds: Bed[] = [];
  const frontBeds: Bed[] = [];
  if (flowers)
    arms.forEach(([b, dx, dy]) => {
      const sx = dx > 0 === dy > 0 ? -16 : 16; // kola dik eksen: karenin kenarına doğru (16, 8)
      [0.18, 0.52, 0.86].forEach((t, a) =>
        [0.4, 0.74].forEach((u, r) => {
          const x = cx + dx * t;
          const y = cy + dy * t;
          const k = b + a * 2 + r;
          frontBeds.push({ x: x + sx * u, y: y + 8 * u, h: 6 + ((a + r) % 2) * 2, k });
          backBeds.push({ x: x - sx * u, y: y - 8 * u, h: (kind === 'cit' ? 11 : r ? 17 : 22) + (a % 2) * 2, k: k + 1 });
        }),
      );
    });
  const byY = (p: Bed, q: Bed) => p.y - q.y;
  out.push(...flowerShapes(backBeds.sort(byY)));
  back.forEach(([, dx, dy]) => out.push(...arm(dx, dy)));
  if (kind === 'cit') {
    front.forEach(([, dx, dy]) => out.push(...arm(dx, dy)));
    // orta direk
    out.push({
      d: `M${cx - 3.4},${cy + 1} L${cx - 3.4},${cy - 25} L${cx},${cy - 30} L${cx + 3.4},${cy - 25} L${cx + 3.4},${cy + 1} Z`,
      fill: '#F7EEDC',
      stroke: '#B79E78',
      sw: 1.2,
    });
  } else {
    // köşe taşı: kolların birleştiği yerde biraz yüksek bir blok
    out.push({
      d: `M${cx - 7},${cy} L${cx},${cy + 3.5} L${cx + 7},${cy} L${cx + 7},${cy - 20} L${cx},${cy - 16.5} L${cx - 7},${cy - 20} Z`,
      fill: '#9C968D',
      stroke: '#7E786F',
      sw: 1,
    });
    out.push({
      d: `M${cx - 7},${cy - 20} L${cx},${cy - 23.5} L${cx + 7},${cy - 20} L${cx},${cy - 16.5} Z`,
      fill: '#DAD4CA',
      stroke: '#8F897F',
      sw: 1,
    });
    out.push({ d: `M${cx},${cy + 3.5} L${cx},${cy - 16.5}`, stroke: '#7E786F', sw: 0.8 });
    front.forEach(([, dx, dy]) => out.push(...arm(dx, dy)));
  }
  out.push(...flowerShapes(frontBeds.sort(byY)));
  return out;
}
