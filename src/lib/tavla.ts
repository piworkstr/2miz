// Tavla kuralları. Kayıtta tahta "gönderen" (a) açısından tutulur: a'nın pulları artı, b'ninkiler eksi.
// a 23'ten 0'a doğru, b 0'dan 23'e doğru ilerler. Hesaplar oyuncunun kendi açısında yapılır:
// "ben" artıyım, 23'ten 0'a giderim, evim 0-5, kırılan pulum 24'ten (bar) girer, toplanan pul -1'e gider.

export type Side = 'a' | 'b';

export type TavlaState = {
  pts: number[]; // 24 hane, a açısından
  bar: { a: number; b: number };
  off: { a: number; b: number };
  turn: string;
  rolled: number[]; // bu turun zarı; boşsa henüz atılmadı
  winner?: string;
  mars?: boolean;
  last?: { by: string; dice: number[]; moves: number };
};

export type View = { pts: number[]; barMe: number; barOpp: number; offMe: number; offOpp: number };
export type Move = { from: number; to: number; die: number }; // from 24 = bar, to -1 = toplama

export const BAR = 24;
export const OFF = -1;

export function newTavla(first: string): TavlaState {
  const pts = Array(24).fill(0);
  pts[23] = 2;
  pts[12] = 5;
  pts[7] = 3;
  pts[5] = 5;
  pts[0] = -2;
  pts[11] = -5;
  pts[16] = -3;
  pts[18] = -5;
  return { pts, bar: { a: 0, b: 0 }, off: { a: 0, b: 0 }, turn: first, rolled: [] };
}

export function toView(s: TavlaState, side: Side): View {
  if (side === 'a') return { pts: [...s.pts], barMe: s.bar.a, barOpp: s.bar.b, offMe: s.off.a, offOpp: s.off.b };
  return { pts: s.pts.map((_, i) => -s.pts[23 - i]), barMe: s.bar.b, barOpp: s.bar.a, offMe: s.off.b, offOpp: s.off.a };
}

export function fromView(v: View, side: Side): Pick<TavlaState, 'pts' | 'bar' | 'off'> {
  if (side === 'a') return { pts: [...v.pts], bar: { a: v.barMe, b: v.barOpp }, off: { a: v.offMe, b: v.offOpp } };
  return {
    pts: v.pts.map((_, i) => -v.pts[23 - i]),
    bar: { a: v.barOpp, b: v.barMe },
    off: { a: v.offOpp, b: v.offMe },
  };
}

export function diceOf(rolled: number[]) {
  return rolled.length === 2 && rolled[0] === rolled[1] ? [rolled[0], rolled[0], rolled[0], rolled[0]] : [...rolled];
}

const allHome = (v: View) => v.barMe === 0 && v.pts.every((n, i) => i < 6 || n <= 0);

// Tek zarla yapılabilecek hamleler.
export function singles(v: View, die: number): Move[] {
  const out: Move[] = [];
  if (v.barMe > 0) {
    const to = BAR - die;
    if (v.pts[to] >= -1) out.push({ from: BAR, to, die });
    return out;
  }
  const home = allHome(v);
  for (let from = 23; from >= 0; from--) {
    if (v.pts[from] <= 0) continue;
    const to = from - die;
    if (to >= 0) {
      if (v.pts[to] >= -1) out.push({ from, to, die });
    } else if (home) {
      // Tam zarla topla; zar büyükse yalnızca daha geride pul yoksa.
      const higher = v.pts.some((n, i) => i > from && n > 0);
      if (to === OFF || !higher) out.push({ from, to: OFF, die });
    }
  }
  return out;
}

export function apply(v: View, m: Move): View {
  const n: View = { ...v, pts: [...v.pts] };
  if (m.from === BAR) n.barMe--;
  else n.pts[m.from]--;
  if (m.to === OFF) n.offMe++;
  else {
    if (n.pts[m.to] === -1) {
      n.pts[m.to] = 0;
      n.barOpp++;
    }
    n.pts[m.to]++;
  }
  return n;
}

function without(dice: number[], die: number) {
  const i = dice.indexOf(die);
  return [...dice.slice(0, i), ...dice.slice(i + 1)];
}

// Kalan zarlarla en fazla kaç hamle yapılabilir.
function maxDepth(v: View, dice: number[]): number {
  if (dice.length === 0 || v.offMe === 15) return 0;
  let best = 0;
  for (const die of new Set(dice)) {
    for (const m of singles(v, die)) {
      best = Math.max(best, 1 + maxDepth(apply(v, m), without(dice, die)));
      if (best === dice.length) return best;
    }
  }
  return best;
}

// Kurala uygun hamleler: mümkün olan en çok zar kullanılmalı; tek zar oynanabiliyorsa büyüğü.
export function legalMoves(v: View, dice: number[]): Move[] {
  const max = maxDepth(v, dice);
  if (max === 0) return [];
  let moves: Move[] = [];
  for (const die of new Set(dice)) {
    for (const m of singles(v, die)) if (1 + maxDepth(apply(v, m), without(dice, die)) === max) moves.push(m);
  }
  if (max === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(...dice);
    if (moves.some((m) => m.die === big)) moves = moves.filter((m) => m.die === big);
  }
  return moves;
}

export function play(v: View, dice: number[], m: Move) {
  return { view: apply(v, m), dice: without(dice, m.die) };
}

export const pipCount = (v: View) => v.pts.reduce((s, n, i) => s + (n > 0 ? n * (i + 1) : 0), 0) + v.barMe * 25;
