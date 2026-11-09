import { Fragment } from 'react';
import { Image, View, type ViewStyle } from 'react-native';
import { artLayers, type ArtOpts, type MoodKey } from '../lib/avatar';
import { ART_H, ART_W } from '../lib/avatarAssets';
import { ART_IMG } from '../lib/avatarImages';

// Çizgi avatar: katmanlar üst üste aynı canvas'a oturur (600x573). Renklendirilebilir katman = beyaz maske (tintColor) + artık.
// Üç kırpma: bust (tüm canvas, omuzlara kadar), head (yalnızca baş; dünya karakteri), circle (yuvarlak profil).
// Canvas'ta yüz: merkez x 300, baş üstü ~y 40, çene ~y 387.
const FACE_CX = 300;
const FACE_CY = 215;
const HEAD_BOX = { x: 100, y: 0, w: 400, h: 400 };

export function ArtAvatar({
  opts,
  size,
  mood = null,
  variant = 'bust',
  style,
}: {
  opts: ArtOpts;
  size: number; // bust: genişlik; head/circle: kare kenar
  mood?: MoodKey | null;
  variant?: 'bust' | 'head' | 'circle';
  style?: ViewStyle;
}) {
  const layers = artLayers(opts, mood, variant !== 'head');
  // canvas → görünüm ölçeği ve kaydırma
  let scale: number;
  let ox = 0;
  let oy = 0;
  let w: number;
  let h: number;
  if (variant === 'bust') {
    scale = size / ART_W;
    w = size;
    h = (ART_H * scale) | 0;
  } else if (variant === 'head') {
    scale = size / HEAD_BOX.w;
    ox = -HEAD_BOX.x * scale;
    oy = -HEAD_BOX.y * scale;
    w = h = size;
  } else {
    // daire: yüz merkezde, çap ≈ 460 canvas px
    scale = size / 460;
    ox = size / 2 - FACE_CX * scale;
    oy = size / 2 - FACE_CY * scale;
    w = h = size;
  }
  const cw = ART_W * scale;
  const ch = ART_H * scale;
  return (
    <View
      style={[
        { width: w, height: h, overflow: 'hidden' },
        variant === 'circle' ? { borderRadius: size / 2, backgroundColor: opts.bg } : null,
        style,
      ]}
    >
      {layers.map((l, i) => {
        const im = ART_IMG[l.name];
        const pos = { position: 'absolute' as const, left: ox, top: oy, width: cw, height: ch };
        return l.tint && im.res ? (
          <Fragment key={i}>
            <Image source={im.img} style={[pos, { tintColor: l.tint }]} resizeMode="stretch" />
            <Image source={im.res} style={pos} resizeMode="stretch" />
          </Fragment>
        ) : (
          <Image key={i} source={im.img} style={pos} resizeMode="stretch" />
        );
      })}
    </View>
  );
}
