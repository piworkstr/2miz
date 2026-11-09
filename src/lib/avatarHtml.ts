import { Asset } from 'expo-asset';
import * as FS from 'expo-file-system/legacy';
import { artAvatarHtml, artLayers, type ArtOpts } from './avatarArt';
import { ART_IMG } from './avatarImages';
import { ART_META } from './avatarAssets';

// Çizgi avatarın HTML'i (albüm önizlemesi için): kullanılan katman dosyaları base64 data URI olarak gömülür.
const cache = new Map<string, string>();

async function dataUri(mod: number): Promise<string> {
  const key = String(mod);
  const hit = cache.get(key);
  if (hit) return hit;
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const b64 = await FS.readAsStringAsync(asset.localUri ?? asset.uri, { encoding: 'base64' });
  const uri = `data:image/webp;base64,${b64}`;
  cache.set(key, uri);
  return uri;
}

export async function artAvatarHtmlAsync(o: ArtOpts): Promise<string> {
  const files = new Map<string, string>();
  for (const l of artLayers(o, null, true)) {
    const im = ART_IMG[l.name];
    files.set(l.name + '.webp', await dataUri(im.img));
    if (ART_META[l.name].tint && im.res) files.set(l.name + '_r.webp', await dataUri(im.res));
  }
  return artAvatarHtml(o, (f) => files.get(f) ?? '');
}
