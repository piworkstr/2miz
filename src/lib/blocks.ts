// Birlikte Blok: Block Blast oynanışı, ortak tahta ve puan. Üç parçalık set sırayla gelir:
// biri üç parçasını koyar, sonraki set partnere geçer. Saf oyun mantığı; Firestore tarafı games.ts'de.

export const SIZE = 8;

type Cells = [number, number][];
const row = (n: number): Cells => Array.from({ length: n }, (_, i) => [0, i]);
const col = (n: number): Cells => Array.from({ length: n }, (_, i) => [i, 0]);

// Parçalar ve ağırlıkları (dönmüş halleri ayrı parça).
export const SHAPES: { cells: Cells; w: number }[] = [
  { cells: [[0, 0]], w: 2 },
  { cells: row(2), w: 2 },
  { cells: col(2), w: 2 },
  { cells: row(3), w: 2 },
  { cells: col(3), w: 2 },
  { cells: row(4), w: 2 },
  { cells: col(4), w: 2 },
  { cells: row(5), w: 1 },
  { cells: col(5), w: 1 },
  {
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    w: 3,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    w: 1,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    w: 1,
  },
  {
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
    ],
    w: 1,
  },
  // küçük köşeler
  ...(
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    ] as Cells[]
  ).map((cells) => ({ cells, w: 2 })),
  // büyük L (3x3 köşe)
  ...(
    [
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
        [2, 2],
      ],
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ],
      [
        [0, 2],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
      ],
    ] as Cells[]
  ).map((cells) => ({ cells, w: 1 })),
  // L ve J
  ...(
    [
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
      ],
      [
        [0, 1],
        [1, 1],
        [2, 1],
        [2, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
      ],
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 2],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
    ] as Cells[]
  ).map((cells) => ({ cells, w: 1 })),
  // T, S, Z
  ...(
    [
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 1],
      ],
      [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 0],
      ],
      [
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 0],
      ],
    ] as Cells[]
  ).map((cells) => ({ cells, w: 1 })),
];

export const COLORS = ['#F2545B', '#F7A23B', '#F6D03F', '#5BC95A', '#3EC3E6', '#4C7CF0', '#A86BF0', '#F06BB4'];

export type Piece = { s: number; col: number } | null; // col: COLORS indeksi

export type BlocksState = {
  board: number[]; // 64 hücre: 0 boş, yoksa COLORS indeksi + 1
  tray: Piece[]; // eldeki 3 parça; kullanılan null
  turn: string; // sıradaki set kimin
  score: number;
  lines: number;
  combo: number;
  sets: number;
  over: boolean;
  last?: { by: string; cells: number[] };
};

export const shapeSize = (s: number) => {
  const cs = SHAPES[s].cells;
  return { rows: Math.max(...cs.map((c) => c[0])) + 1, cols: Math.max(...cs.map((c) => c[1])) + 1 };
};

export function fits(board: number[], cells: Cells, r: number, c: number) {
  return cells.every(([dr, dc]) => r + dr >= 0 && r + dr < SIZE && c + dc >= 0 && c + dc < SIZE && !board[(r + dr) * SIZE + c + dc]);
}
export function fitsAnywhere(board: number[], s: number) {
  const cells = SHAPES[s].cells;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (fits(board, cells, r, c)) return true;
  return false;
}
export const anyFits = (board: number[], tray: Piece[]) => tray.some((p) => p && fitsAnywhere(board, p.s));

function placeCells(board: number[], cells: Cells, r: number, c: number, v: number) {
  const n = [...board];
  cells.forEach(([dr, dc]) => (n[(r + dr) * SIZE + c + dc] = v));
  return n;
}
export function fullLines(board: number[]) {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let k = 0; k < SIZE; k++) {
    let fr = true;
    let fc = true;
    for (let j = 0; j < SIZE; j++) {
      if (!board[k * SIZE + j]) fr = false;
      if (!board[j * SIZE + k]) fc = false;
    }
    if (fr) rows.push(k);
    if (fc) cols.push(k);
  }
  return { rows, cols };
}
export function clearLines(board: number[], f: { rows: number[]; cols: number[] }) {
  const n = [...board];
  f.rows.forEach((k) => {
    for (let j = 0; j < SIZE; j++) n[k * SIZE + j] = 0;
  });
  f.cols.forEach((k) => {
    for (let j = 0; j < SIZE; j++) n[j * SIZE + k] = 0;
  });
  return n;
}
export const clearedCells = (f: { rows: number[]; cols: number[] }) => {
  const ids = new Set<number>();
  f.rows.forEach((k) => {
    for (let j = 0; j < SIZE; j++) ids.add(k * SIZE + j);
  });
  f.cols.forEach((k) => {
    for (let j = 0; j < SIZE; j++) ids.add(j * SIZE + k);
  });
  return [...ids];
};

// Üç parça bir sırayla tahtaya sığıyor mu? (sınırlı arama, uzun sürerse sığıyor sayılır)
export function allFit(board: number[], pcs: Piece[]): boolean {
  let budget = 6000;
  const rec = (b: number[], rest: Piece[]): boolean => {
    const live = rest.filter(Boolean) as NonNullable<Piece>[];
    if (!live.length) return true;
    if (--budget < 0) return true;
    for (let k = 0; k < live.length; k++) {
      const cells = SHAPES[live[k].s].cells;
      const others = live.filter((_, j) => j !== k);
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
          if (fits(b, cells, r, c)) {
            const nb = placeCells(b, cells, r, c, 1);
            if (rec(clearLines(nb, fullLines(nb)), others)) return true;
          }
    }
    return false;
  };
  return rec(board, pcs);
}

function pickShape(rnd: () => number) {
  const tot = SHAPES.reduce((s, x) => s + x.w, 0);
  let x = rnd() * tot;
  for (let i = 0; i < SHAPES.length; i++) {
    x -= SHAPES[i].w;
    if (x < 0) return i;
  }
  return 0;
}
// Adil dağıtım: mümkünse üçü de sığan bir set; olmazsa küçük parçalardan dene.
export function deal(board: number[], rnd: () => number = Math.random): Piece[] {
  const mk = (s: number): Piece => ({ s, col: Math.floor(rnd() * COLORS.length) });
  let set: Piece[] = [];
  for (let t = 0; t < 30; t++) {
    set = [mk(pickShape(rnd)), mk(pickShape(rnd)), mk(pickShape(rnd))];
    if (allFit(board, set)) return set;
  }
  const small = [0, 1, 2, 13, 14];
  for (let t = 0; t < 30; t++) {
    set = [0, 1, 2].map(() => mk(small[Math.floor(rnd() * small.length)]));
    if (allFit(board, set)) return set;
  }
  return set;
}

export function newBlocks(firstTurn: string): BlocksState {
  const board = Array(SIZE * SIZE).fill(0);
  return { board, tray: deal(board), turn: firstTurn, score: 0, lines: 0, combo: 0, sets: 0, over: false };
}

export const scoreFor = (placed: number, cleared: number, combo: number) =>
  placed + (cleared ? cleared * cleared * 10 : 0) + (cleared && combo > 1 ? combo * 10 : 0);

// Hamleyi uygular; geçersizse null döner. Set bitince yeni set dağıtılır ve sıra partnere geçer.
export function applyMove(s: BlocksState, slot: number, r: number, c: number, by: string, next: string) {
  const p = s.tray[slot];
  if (!p || s.over) return null;
  const cells = SHAPES[p.s].cells;
  if (!fits(s.board, cells, r, c)) return null;
  let board = placeCells(s.board, cells, r, c, p.col + 1);
  const full = fullLines(board);
  const n = full.rows.length + full.cols.length;
  const combo = n ? s.combo + 1 : 0;
  const gained = scoreFor(cells.length, n, combo);
  board = clearLines(board, full);
  let tray = s.tray.map((x, i) => (i === slot ? null : x));
  let turn = s.turn;
  let sets = s.sets;
  if (tray.every((x) => !x)) {
    tray = deal(board);
    turn = next;
    sets += 1;
  }
  const over = !anyFits(board, tray);
  const state: BlocksState = {
    board,
    tray,
    turn,
    score: s.score + gained,
    lines: s.lines + n,
    combo,
    sets,
    over,
    last: { by, cells: cells.map(([dr, dc]) => (r + dr) * SIZE + c + dc) },
  };
  return { state, gained, lines: n, cleared: clearedCells(full), setEnded: turn !== s.turn };
}
