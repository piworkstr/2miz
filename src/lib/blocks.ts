// "Birlikte Blok": ortak 8x8 tahta, sırayla parça koyulur, dolan satır ve sütunlar silinir.
// Saf oyun mantığı; Firestore tarafı games.ts'de.

export const SIZE = 8;

// Her parça [satır, sütun] hücrelerinden oluşur; sol üst köşe (0,0).
export const PIECES: [number, number][][] = [
  [[0, 0]],
  [
    [0, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 0],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
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
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
  ],
  [
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
];

export type BlocksState = {
  board: number[]; // 64 hücre: 0 boş, 1 daveti gönderen, 2 davet edilen koydu
  hand: number[]; // ortak eldeki 3 parça; kullanılan -1
  turn: string;
  score: number;
  moves: number;
  lines: number;
  combo: number; // üst üste satır silen hamle sayısı
  over: boolean;
  last?: { by: string; cells: number[]; cleared: number[] };
};

export function fits(board: number[], piece: number, r: number, c: number) {
  return PIECES[piece].every(([dr, dc]) => {
    const rr = r + dr;
    const cc = c + dc;
    return rr < SIZE && cc < SIZE && board[rr * SIZE + cc] === 0;
  });
}

export function fitsAnywhere(board: number[], piece: number) {
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (fits(board, piece, r, c)) return true;
  return false;
}

export function canContinue(board: number[], hand: number[]) {
  return hand.some((p) => p >= 0 && fitsAnywhere(board, p));
}

// 3x3 kare nadir gelsin.
function randomPiece() {
  return Math.random() < 0.06 ? 15 : Math.floor(Math.random() * 15);
}

// Yeni el: mümkünse en az bir parçası tahtaya sığan bir el seçilir.
export function deal(board: number[]): number[] {
  let hand = [randomPiece(), randomPiece(), randomPiece()];
  for (let i = 0; i < 12 && !canContinue(board, hand); i++) hand = [randomPiece(), randomPiece(), randomPiece()];
  return hand;
}

export function newBlocks(firstTurn: string): BlocksState {
  const board = Array(SIZE * SIZE).fill(0);
  return { board, hand: deal(board), turn: firstTurn, score: 0, moves: 0, lines: 0, combo: 0, over: false };
}

// Hamleyi uygular; geçersizse null döner.
export function applyMove(s: BlocksState, slot: number, r: number, c: number, mark: number, by: string, next: string) {
  const piece = s.hand[slot];
  if (piece === undefined || piece < 0 || s.over || !fits(s.board, piece, r, c)) return null;
  const board = [...s.board];
  const cells = PIECES[piece].map(([dr, dc]) => (r + dr) * SIZE + (c + dc));
  for (const i of cells) board[i] = mark;

  const full = new Set<number>();
  let lines = 0;
  for (let k = 0; k < SIZE; k++) {
    const row = Array.from({ length: SIZE }, (_, j) => k * SIZE + j);
    const col = Array.from({ length: SIZE }, (_, j) => j * SIZE + k);
    if (row.every((i) => board[i] !== 0)) {
      lines++;
      row.forEach((i) => full.add(i));
    }
    if (col.every((i) => board[i] !== 0)) {
      lines++;
      col.forEach((i) => full.add(i));
    }
  }
  for (const i of full) board[i] = 0;

  const combo = lines > 0 ? s.combo + 1 : 0;
  const gained = cells.length + lines * lines * 10 + (lines > 0 ? (combo - 1) * 5 : 0);

  let hand = s.hand.map((p, i) => (i === slot ? -1 : p));
  if (hand.every((p) => p < 0)) hand = deal(board);
  const over = !canContinue(board, hand);

  const state: BlocksState = {
    board,
    hand,
    turn: next,
    score: s.score + gained,
    moves: s.moves + 1,
    lines: s.lines + lines,
    combo,
    over,
    last: { by, cells, cleared: [...full] },
  };
  return { state, gained, lines };
}
