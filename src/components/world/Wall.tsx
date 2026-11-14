import Svg, { Path } from 'react-native-svg';

import { WALL_BOX, wallShapes, type WallKind } from '../../lib/wallArt';

// Çit / taş duvar parçası. mask: hangi komşularla birleşeceği (wallArt.ts).
export function Wall({ kind, mask, scale = 1, flowers }: { kind: WallKind; mask: number; scale?: number; flowers?: boolean }) {
  return (
    <Svg width={WALL_BOX.w * scale} height={WALL_BOX.h * scale} viewBox={`0 0 ${WALL_BOX.w} ${WALL_BOX.h}`}>
      {wallShapes(kind, mask, flowers).map((s, k) => (
        <Path
          key={k}
          d={s.d}
          fill={s.fill ?? 'none'}
          stroke={s.stroke ?? 'none'}
          strokeWidth={s.sw ?? 0}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}
