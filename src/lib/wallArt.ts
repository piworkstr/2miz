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

// Dipteki çiçek öbeği: yaprak, sap ve üç çiçek. h: sap boyu (arkadakiler duvarın üstünden görünsün diye uzun).
const COLORS = ['#FF8FB1', '#FFD45C', '#FFFFFF', '#C59BFF'];
function flower(x: number, y: number, h: number, k: number): Shape[] {
  const c = (n: number) => COLORS[(k + n) % COLORS.length];
  const dot = (px: number, py: number, r: number, fill: string): Shape => ({
    d: `M${px - r},${py} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`,
    fill,
    stroke: 'rgba(120,70,60,0.35)',
    sw: 0.5,
  });
  return [
    { d: `M${x - 6},${y} a6,3 0 1,0 12,0 a6,3 0 1,0 -12,0`, fill: '#5FA84A' },
    {
      d: `M${x - 3},${y} L${x - 4},${y - h + 1} M${x + 3},${y} L${x + 4},${y - h} M${x},${y} L${x},${y - h - 3}`,
      stroke: '#4C9440',
      sw: 1.2,
    },
    dot(x - 4, y - h + 1, 2.7, c(0)),
    dot(x + 4, y - h, 2.7, c(1)),
    dot(x, y - h - 3, 2.9, c(2)),
    dot(x - 4, y - h + 1, 0.9, '#F2A33A'),
    dot(x + 4, y - h, 0.9, '#F2A33A'),
    dot(x, y - h - 3, 0.9, '#F2A33A'),
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
  // Çiçekli tür: her kolun iki yanında, karenin boş kalan yarısında çiçek öbekleri.
  const beds = flowers
    ? arms.map(([b, dx, dy]) => {
        const px = dx > 0 === dy > 0 ? -12 : 12;
        return { b, x: cx + dx * 0.6, y: cy + dy * 0.6, px, py: 6 };
      })
    : [];
  beds.forEach((q) => out.push(...flower(q.x - q.px, q.y - q.py, kind === 'cit' ? 12 : 21, q.b)));
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
  beds.forEach((q) => out.push(...flower(q.x + q.px, q.y + q.py, 7, q.b + 1)));
  return out;
}
