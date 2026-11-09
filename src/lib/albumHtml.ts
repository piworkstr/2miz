// Albüm sayfalarının görünümü (saf TypeScript, HTML üretir).
// Önizleme: telefonda WebView içinde, kaydırılabilir şerit; indirme/paylaşma yok, köşede önizleme damgası.
// Baskı: Baskı Merkezi bu HTML'i 300 dpi PDF'e çevirir (her kenarda 3 mm taşma payı).
import type { AlbumInput, AlbumPage, AlbumPlan, AlbumSize } from './albumLayout';
import { avatarSvg } from './avatarArt';

export const TRIM_MM: Record<AlbumSize, [number, number]> = { '21x21': [210, 210], A4: [210, 297] };
export const BLEED_MM = 3;

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pretty = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const span = (a: string, b: string) => {
  const [y1, m1] = a.split('-').map(Number);
  const [y2, m2] = b.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${MONTHS[m1 - 1]} – ${MONTHS[m2 - 1]} ${y1}`;
  return `${MONTHS[m1 - 1]} ${y1} – ${MONTHS[m2 - 1]} ${y2}`;
};
const tripDates = (a: string, b: string) => (a === b ? pretty(a) : `${pretty(a)} – ${pretty(b)}`);

// Polaroid Klasik teması
const CSS = `
:root{--paper:#FBF7F2;--ink:#2B1D22;--quiet:#9C8C87;--rose:#E8516A;--kraft:#EADCC4;--kraftInk:#6E5A43}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#EFE7E1;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
img{pointer-events:none;-webkit-user-drag:none;display:block}
.page{position:relative;overflow:hidden;background:var(--paper);container-type:inline-size;color:var(--ink);font-family:'Baloo 2',sans-serif}
.safe{position:absolute;inset:8cqw;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
.hand{font-family:'Caveat',cursive}
.label{font-size:2.4cqw;letter-spacing:.35cqw;text-transform:uppercase;color:var(--quiet);font-weight:500}
.title{font-family:'Caveat',cursive;font-weight:700;font-size:6.2cqw;line-height:1.05;text-align:center}
.pol{background:#fff;padding:2cqw 2cqw 1.4cqw;box-shadow:0 .5cqw 1.4cqw rgba(60,30,30,.16)}
.pol .ph{width:100%;overflow:hidden;background:#eee}
.pol .ph img{width:100%;height:100%;object-fit:cover}
.pol .cap{font-family:'Caveat',cursive;font-weight:500;font-size:4cqw;line-height:1.08;text-align:center;margin-top:1.2cqw;min-height:4.4cqw}
.pol .who{font-size:2cqw;color:var(--quiet);text-align:center;margin-top:.3cqw}
.row{display:flex;gap:4cqw;align-items:flex-start;justify-content:center}
.kraft{background:var(--kraft)}
.kraft .label,.kraft .who{color:var(--kraftInk)}
.stamp{position:absolute;top:8cqw;right:8cqw;width:16cqw;height:16cqw;border-radius:50%;border:.5cqw dashed #C0566A;color:#C0566A;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-14deg);font-size:2cqw;font-weight:700;letter-spacing:.2cqw}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:3cqw;width:100%}
.stat{background:#fff;border-radius:2cqw;padding:3cqw;text-align:center}
.stat b{display:block;font-size:9cqw;line-height:1;color:var(--rose)}
.stat span{font-size:2.6cqw;color:var(--quiet)}
.lines{width:100%;flex:1;margin-top:3cqw;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 7.6cqw,#D9CBC4 7.6cqw,#D9CBC4 7.8cqw)}
.av{width:20cqw;height:20cqw;border-radius:50%;overflow:hidden;border:1cqw solid #fff;background:#fff;box-shadow:0 .4cqw 1cqw rgba(0,0,0,.12)}
.av svg,.av img{width:100%;height:100%}
.av.art>div{width:150%;margin-left:-25%;margin-top:-6%}
.mark{position:absolute;right:3cqw;bottom:2.4cqw;font-size:2cqw;color:rgba(43,29,34,.28);letter-spacing:.2cqw}
`;

function pol(p: { src: string; note: string; who: string }, width: number, aspect: string, tilt: number, extra = '') {
  return `<div class="pol" style="width:${width}cqw;transform:rotate(${tilt}deg);${extra}"><div class="ph" style="aspect-ratio:${aspect}"><img src="${esc(p.src)}"/></div><div class="cap">${esc(p.note || ' ')}</div>${p.who ? `<div class="who">${esc(p.who)}</div>` : ''}</div>`;
}

function avatar(person: AlbumInput['people'][number]) {
  const a = person.avatar;
  if (a?.kind === 'art' && person.avatarHtml) return `<div class="av art">${person.avatarHtml}</div>`;
  if (a?.kind === 'drawn') return `<div class="av">${avatarSvg(a.opts, null, true)}</div>`;
  if (a?.kind === 'photo') return `<div class="av"><img src="data:image/jpeg;base64,${a.photo}"/></div>`;
  return `<div class="av" style="display:flex;align-items:center;justify-content:center;background:#FFD5DC;font-size:9cqw;color:#E8516A;font-weight:700">${esc(person.name.slice(0, 1).toLocaleUpperCase('tr-TR'))}</div>`;
}

function pageBody(p: AlbumPage, input: AlbumInput, plan: AlbumPlan, a4: boolean): { html: string; cls?: string } {
  const [me, partner] = input.people;
  switch (p.kind) {
    case 'opening':
      return {
        html: `<div class="safe" style="justify-content:center;gap:4cqw"><div style="display:flex">${avatar(me)}<div style="margin-left:-5cqw">${avatar(partner)}</div></div><div class="title" style="font-size:11cqw">${esc(me.name)} &amp; ${esc(partner.name)}</div><div class="label">Bizim hikayemiz</div><div style="font-size:3.2cqw;color:var(--quiet)">${esc(span(plan.from, plan.to))}</div></div>`,
      };
    case 'stats': {
      const s = p.stats;
      const cells = [
        s.daysTogether ? [s.daysTogether, 'gündür birlikte'] : null,
        [s.tasks, 'birlikte görev'],
        [s.dates, 'date günü'],
        [s.photos, 'fotoğraf'],
        [s.moments, 'anı'],
        [s.trips, 'seyahat'],
      ].filter(Boolean) as [number, string][];
      return {
        html: `<div class="safe" style="justify-content:center;gap:5cqw"><div class="title" style="font-size:8cqw">Hikayemiz rakamlarla</div><div class="stats">${cells.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div></div>`,
      };
    }
    case 'task': {
      const [x, y] = p.photos;
      const w = a4 ? 50 : 38;
      const pics = y
        ? a4
          ? `<div style="width:100%;display:flex;flex-direction:column;gap:4cqw">${pol(x, w, '1', -3, 'align-self:flex-start')}${pol(y, w, '1', 2.5, 'align-self:flex-end;margin-top:-14cqw')}</div>`
          : `<div class="row">${pol(x, w, '1', -3)}${pol(y, w, '1', 2.5, 'margin-top:4cqw')}</div>`
        : `<div class="row">${pol(x, a4 ? 62 : 48, '1', -2)}</div>`;
      return {
        html: `<div class="safe"><div class="label">${esc(pretty(p.day))}</div>${pics}<div class="title">${esc(p.title)}</div></div>`,
      };
    }
    case 'date':
      return {
        html: `<div class="safe"><div class="title" style="color:var(--rose);font-size:7cqw">Date günü</div>${pol(p.photo, a4 ? 80 : 72, '4/3', -1.5)}<div class="label">${esc(pretty(p.day))}</div></div>`,
      };
    case 'moment':
      return {
        html: `<div class="safe"><div class="title" style="color:#5E8C7A;font-size:6cqw">Bir anı</div>${pol({ ...p.photo, who: p.photo.who ? `${p.photo.who} çekti` : '' }, a4 ? 62 : 46, '3/4', 1.5)}<div class="label">${esc(pretty(p.day))}</div></div>`,
      };
    case 'tripCover':
      return {
        cls: 'kraft',
        html: `<div class="stamp"><span style="font-size:5cqw">✈</span>2MİZ</div><div class="safe" style="justify-content:center;gap:3cqw;align-items:flex-start"><div class="label">Seyahat</div><div class="title" style="font-size:13cqw;text-align:left">${esc(p.name)}</div><div style="font-size:3.4cqw;color:var(--kraftInk)">${esc([p.place, tripDates(p.start, p.end)].filter(Boolean).join(' · '))}</div></div>`,
      };
    case 'tripPhotos': {
      const tilts = [-3, 2.5, 1.5, -2];
      const w = a4 ? 39 : 36;
      return {
        cls: 'kraft',
        html: `<div class="safe" style="justify-content:flex-start;gap:3cqw"><div class="label">${esc(p.name)}</div><div style="flex:1;display:flex;align-items:center"><div style="display:grid;grid-template-columns:1fr 1fr;gap:${a4 ? 6 : 3}cqw 4cqw;justify-items:center">${p.photos.map((ph, i) => pol(ph, w, '1', tilts[i % 4], i % 2 ? 'margin-top:2cqw' : '')).join('')}</div></div></div>`,
      };
    }
    case 'notes':
      return {
        html: `<div class="safe" style="justify-content:flex-start;align-items:stretch"><div class="title" style="font-size:7cqw">Birbirimize notlar</div><div class="hand" style="font-size:4cqw;color:var(--quiet);text-align:center;margin-top:1cqw">${esc(me.name)} ve ${esc(partner.name)} için</div><div class="lines"></div></div>`,
      };
    case 'end':
      return {
        html: `<div class="safe" style="justify-content:center;gap:3cqw"><div class="title" style="font-size:9cqw">Devamı gelecek…</div><div style="font-size:3cqw;color:var(--quiet);letter-spacing:.3cqw">2miz</div></div>`,
      };
  }
}

function coverBody(input: AlbumInput, plan: AlbumPlan, a4: boolean) {
  const [me, partner] = input.people;
  // Kapakta en güzel ihtimal: ilk date fotoğrafı, yoksa ilk seyahat ya da görev fotoğrafı.
  const pick =
    plan.pages.find((p) => p.kind === 'date') ??
    plan.pages.find((p) => p.kind === 'tripPhotos') ??
    plan.pages.find((p) => p.kind === 'task');
  const photo = pick && (pick.kind === 'date' ? pick.photo : pick.kind === 'task' || pick.kind === 'tripPhotos' ? pick.photos[0] : null);
  return `<div class="safe" style="justify-content:center;gap:5cqw">${photo ? pol({ ...photo, who: '' }, a4 ? 64 : 54, '1', -2.5) : ''}<div class="title" style="color:#fff;font-size:11cqw">${esc(me.name)} &amp; ${esc(partner.name)}</div><div style="font-size:3.4cqw;color:#FFE3E8;letter-spacing:.3cqw;text-transform:uppercase">${esc(span(plan.from, plan.to))}</div></div>`;
}

// Yazı tipleri: önizlemede Google Fonts; Baskı Merkezi dosyaları gömülü @font-face olarak verir (fonts parametresi).
const GOOGLE_FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700&family=Caveat:wght@500;700&display=swap" rel="stylesheet">';

// Önizleme: kapak + bütün sayfalar yatay kaydırılır; bir sayfaya dokununca uygulamaya haber verir.
export function albumPreviewHtml(plan: AlbumPlan, input: AlbumInput, size: AlbumSize, fonts = GOOGLE_FONTS) {
  const [w, h] = TRIM_MM[size];
  const a4 = size === 'A4';
  const ratio = `${w}/${h}`;
  const pages = plan.pages
    .map((p, i) => {
      const { html, cls } = pageBody(p, input, plan, a4);
      return `<div class="slot"><div class="page ${cls ?? ''}" style="aspect-ratio:${ratio}" data-id="${p.id}">${html}<div class="mark">2miz önizleme · ${i + 1}</div></div></div>`;
    })
    .join('');
  const cover = `<div class="slot"><div class="page" style="aspect-ratio:${ratio};background:#E8516A" data-id="cover">${coverBody(input, plan, a4)}<div class="mark" style="color:rgba(255,255,255,.5)">Kapak</div></div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">${fonts}<style>${CSS}
body{overflow:hidden}
.strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;height:100vh;align-items:center;-webkit-overflow-scrolling:touch}
.slot{flex:0 0 100vw;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;padding:16px}
.slot .page{width:${a4 ? 'min(calc(100vw - 32px), calc((100vh - 32px) * 0.707))' : 'min(calc(100vw - 32px), calc(100vh - 32px))'};box-shadow:0 6px 20px rgba(0,0,0,.18);border-radius:2px}
</style></head><body><div class="strip" id="s">${cover}${pages}</div><script>
var s=document.getElementById('s');
s.addEventListener('click',function(e){var p=e.target.closest('.page');if(p&&window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'tap',id:p.dataset.id}));});
var t;s.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(function(){var i=Math.round(s.scrollLeft/window.innerWidth);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'page',index:i}));},120);});
document.addEventListener('contextmenu',function(e){e.preventDefault();});
</script></body></html>`;
}

// Baskı: her sayfa taşma payıyla tam boy; iç sayfalar ve kapak ayrı dosya.
export function albumPrintHtml(plan: AlbumPlan, input: AlbumInput, size: AlbumSize, part: 'interior' | 'cover', fonts = GOOGLE_FONTS) {
  const [w, h] = TRIM_MM[size];
  const pw = w + 2 * BLEED_MM;
  const ph = h + 2 * BLEED_MM;
  const a4 = size === 'A4';
  const body =
    part === 'cover'
      ? `<div class="page" style="width:${pw}mm;height:${ph}mm;background:#E8516A">${coverBody(input, plan, a4)}</div>`
      : plan.pages
          .map((p) => {
            const { html, cls } = pageBody(p, input, plan, a4);
            return `<div class="page ${cls ?? ''}" style="width:${pw}mm;height:${ph}mm">${html}</div>`;
          })
          .join('');
  return `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${CSS}
@page{size:${pw}mm ${ph}mm;margin:0}
html,body{background:#fff}
.page{break-after:page;page-break-after:always}
.pol{box-shadow:0 .35cqw .9cqw rgba(60,30,30,.14)}
</style></head><body>${body}</body></html>`;
}
