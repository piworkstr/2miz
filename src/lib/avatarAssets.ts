// Otomatik üretildi (scratchpad/av/encode.py). Çizgi avatar katmanları: 600x573 canvas, WebP (assets/avatar).
// Renklendirilebilir katman iki dosyadır: maske (tintColor ile boyanır) ve artık (_r: gölge, doku, sabit renkler).
// Bu dosya saf veridir; Baskı Merkezi (Node) de kullanır. Görsel require'ları avatarImages.ts'te.
export const ART_W = 600;
export const ART_H = 573;

export type ArtLayerName =
  | 'base'
  | 'f_notr'
  | 'f_mutlu'
  | 'f_asik'
  | 'f_heyecanli'
  | 'f_uzgun'
  | 'f_ozledim'
  | 'f_sinirli'
  | 'f_yorgun'
  | 'f_uykulu'
  | 'f_hasta'
  | 'f_ac'
  | 'f_goz'
  | 'f_kadin'
  | 'f_erkek'
  | 'f_nazik'
  | 'h_yanayrik'
  | 'h_dalgali'
  | 'h_sifir'
  | 'h_kivircik'
  | 'h_kakul'
  | 'h_geri'
  | 'h_omuz'
  | 'h_topuz_e'
  | 'h_uzunduz'
  | 'h_uzundalga'
  | 'h_kare'
  | 'h_atkuyrugu'
  | 'h_topuz'
  | 'h_uzunkivircik'
  | 'h_pixie'
  | 'h_orgu'
  | 's_kirli'
  | 's_sakal'
  | 's_biyik'
  | 's_keci'
  | 'g_yuvarlak'
  | 'g_kare'
  | 'k_basortu'
  | 'k_sapka'
  | 't_tisort'
  | 't_kapson'
  | 't_gomlek'
  | 't_kazak'
  | 't_ceket'
  | 't_vyaka'
  | 't_kot'
  | 't_bluz'
  | 't_tulum';

export const ART_META: Record<ArtLayerName, { tint?: 'skin' | 'hair' | 'cloth'; base?: string }> = {
  base: { tint: 'skin', base: '#fce2c4' },
  f_notr: {},
  f_mutlu: {},
  f_asik: {},
  f_heyecanli: {},
  f_uzgun: {},
  f_ozledim: {},
  f_sinirli: {},
  f_yorgun: {},
  f_uykulu: {},
  f_hasta: {},
  f_ac: {},
  f_goz: {},
  f_kadin: {},
  f_erkek: {},
  f_nazik: {},
  h_yanayrik: { tint: 'hair', base: '#795640' },
  h_dalgali: { tint: 'hair', base: '#795640' },
  h_sifir: { tint: 'hair', base: '#795640' },
  h_kivircik: { tint: 'hair', base: '#795640' },
  h_kakul: { tint: 'hair', base: '#795640' },
  h_geri: { tint: 'hair', base: '#795640' },
  h_omuz: { tint: 'hair', base: '#795640' },
  h_topuz_e: { tint: 'hair', base: '#795640' },
  h_uzunduz: { tint: 'hair', base: '#795640' },
  h_uzundalga: { tint: 'hair', base: '#795640' },
  h_kare: { tint: 'hair', base: '#795640' },
  h_atkuyrugu: { tint: 'hair', base: '#795640' },
  h_topuz: { tint: 'hair', base: '#795640' },
  h_uzunkivircik: { tint: 'hair', base: '#795640' },
  h_pixie: { tint: 'hair', base: '#795640' },
  h_orgu: { tint: 'hair', base: '#795640' },
  s_kirli: { tint: 'hair', base: '#795640' },
  s_sakal: { tint: 'hair', base: '#795640' },
  s_biyik: { tint: 'hair', base: '#795640' },
  s_keci: { tint: 'hair', base: '#795640' },
  g_yuvarlak: {},
  g_kare: {},
  k_basortu: { tint: 'cloth', base: '#a9bb89' },
  k_sapka: { tint: 'cloth', base: '#d45748' },
  t_tisort: { tint: 'cloth', base: '#f7f2ea' },
  t_kapson: { tint: 'cloth', base: '#9eb7cd' },
  t_gomlek: { tint: 'cloth', base: '#9db6cd' },
  t_kazak: { tint: 'cloth', base: '#9db4cb' },
  t_ceket: { tint: 'cloth', base: '#8fa9c2' },
  t_vyaka: { tint: 'cloth', base: '#9db5cc' },
  t_kot: { tint: 'cloth', base: '#8fa9c1' },
  t_bluz: { tint: 'cloth', base: '#9eb6cd' },
  t_tulum: { tint: 'cloth', base: '#8da4ba' },
};
