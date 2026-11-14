import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

// Karekod çizimi (mekanın kasa kartı için). Baskıda okunabilsin diye hep siyah-beyaz.
export function QR({ value, size = 200 }: { value: string; size?: number }) {
  const { d, n } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(value);
    q.make();
    const count = q.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (q.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { d: path, n: count };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`}>
      <Rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#FFFFFF" />
      <Path d={d} fill="#000000" />
    </Svg>
  );
}
