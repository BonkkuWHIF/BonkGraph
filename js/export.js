// export/import JSON (ข้อ 9), export PNG (ข้อ 10) + gimmick popup

import { avatarBadgeUrl } from './data.js';
import { t } from './i18n.js';

// ---------- JSON ----------
export function exportJSON(state) {
  const snap = {
    app: 'BonkGraph',
    version: 1,
    title: state.title,
    template: state.template,
    origin: state.origin,
    placements: state.placements,
    customCharacters: state.customCharacters || [],
  };
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  download(blob, safeName(state.title || 'bonkgraph') + '.json');
}

export function importJSON(onLoad) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/json,.json';
  inp.addEventListener('change', () => {
    const file = inp.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snap = JSON.parse(reader.result);
        onLoad(snap);
      } catch (err) {
        alert(t('invalidFile') + err.message);
      }
    };
    reader.readAsText(file);
  });
  inp.click();
}

// ---------- PNG ----------
export function exportPNG(state, board, { onClearBoard }) {
  showGimmick(
    () => renderCanvasAndDownload(state, board),   // ตอบ "ใช่" -> โหลดภาพ
    () => { onClearBoard?.(); showTantrum(); }      // ตอบ "ไม่" -> เคลียร์กระดาน + popup อาละวาด
  );
}

const CFONT = '"Anuphan","Hiragino Sans","Yu Gothic","Malgun Gothic","Microsoft JhengHei",system-ui,sans-serif';

async function renderCanvasAndDownload(state, board) {
  // รอให้ฟอนต์ Anuphan โหลดก่อน ไม่งั้น canvas จะ render ด้วยฟอนต์ระบบ
  try {
    await Promise.all([
      document.fonts.load('700 40px "Anuphan"'),
      document.fonts.load('600 26px "Anuphan"'),
      document.fonts.load('500 22px "Anuphan"'),
    ]);
    await document.fonts.ready;
  } catch (_) {}

  const { origin, template, placements, characters } = state;
  const q = template.quadrants;

  // ---- เลย์เอาต์: กราฟอยู่กลาง มีพื้นดำรอบ (title บน, brand ซ้ายบน, url ขวาล่าง) ----
  const W = 1600;
  const sidePad = 48;
  const bs = W - sidePad * 2;                 // ขนาดกราฟ (สี่เหลี่ยมจัตุรัส)
  const titlePx = Math.round((state.titleScale || 3.2) / 100 * W);
  const brandTop = 34, logoSize = 56;
  const titleY = brandTop + logoSize + 26;
  const topPad = titleY + titlePx + 28;
  const bottomPad = 70;
  const bx = sidePad, by = topPad;            // มุมบนซ้ายของกราฟ
  const H = topPad + bs + bottomPad;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // พื้นหลังดำ + พื้นกราฟ
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0f0d1a'; ctx.fillRect(bx, by, bs, bs);

  const ox = bx + origin.x * bs, oy = by + origin.y * bs;

  // quadrant + แกน (clip อยู่ในกราฟ)
  ctx.save();
  ctx.beginPath(); ctx.rect(bx, by, bs, bs); ctx.clip();
  ctx.globalAlpha = 0.85;
  fillRect(ctx, bx, by, ox - bx, oy - by, q.topLeft.color);
  fillRect(ctx, ox, by, bx + bs - ox, oy - by, q.topRight.color);
  fillRect(ctx, bx, oy, ox - bx, by + bs - oy, q.bottomLeft.color);
  fillRect(ctx, ox, oy, bx + bs - ox, by + bs - oy, q.bottomRight.color);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
  line(ctx, ox, by, ox, by + bs);
  line(ctx, bx, oy, bx + bs, oy);
  ctx.restore();

  // badges
  const placed = characters.filter((c) => placements[c.id]);
  const imgs = await Promise.all(placed.map((c) => loadImg(avatarBadgeUrl(c.avatarUrl, 104))));
  const R = Math.round(bs * 0.033 * (state.badgeScale || 1));
  placed.forEach((c, i) => {
    const p = placements[c.id];
    drawBadge(ctx, imgs[i], c, bx + p.x * bs, by + p.y * bs, R);
  });

  // ป้าย quadrant (มุมกราฟ)
  ctx.font = `600 26px ${CFONT}`;
  drawCorner(ctx, q.topLeft.label, bx + 16, by + 16, 'left', 'top');
  drawCorner(ctx, q.topRight.label, bx + bs - 16, by + 16, 'right', 'top');
  drawCorner(ctx, q.bottomLeft.label, bx + 16, by + bs - 16, 'left', 'bottom');
  drawCorner(ctx, q.bottomRight.label, bx + bs - 16, by + bs - 16, 'right', 'bottom');

  // ป้ายปลายแกน
  ctx.font = `500 22px ${CFONT}`;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  textAt(ctx, template.axis.x.right, bx + bs - 14, oy, 'right', 'middle');
  textAt(ctx, template.axis.x.left, bx + 14, oy, 'left', 'middle');
  textAt(ctx, template.axis.y.top, ox, by + 14, 'center', 'top');
  textAt(ctx, template.axis.y.bottom, ox, by + bs - 14, 'center', 'bottom');

  // ---- brand ซ้ายบน (ark_logo วงกลม + ข้อความ) ----
  try {
    const logo = await loadImg('assets/ark_logo.png');
    if (logo) circleImage(ctx, logo, sidePad + logoSize / 2, brandTop + logoSize / 2, logoSize / 2);
  } catch (_) {}
  ctx.font = `600 26px ${CFONT}`;
  ctx.fillStyle = '#fff';
  textAt(ctx, 'BonkGraph by Bonkku for WHIF', sidePad + logoSize + 16, brandTop + logoSize / 2, 'left', 'middle');

  // ---- title (กลางบน, สี/ขนาดปรับได้) ----
  let title = state.title || "Character's Flag";
  let tp = titlePx;
  ctx.font = `700 ${tp}px ${CFONT}`;
  const titleMaxW = W - sidePad * 2;
  while (tp > 16 && ctx.measureText(title).width > titleMaxW) {
    tp -= 2; ctx.font = `700 ${tp}px ${CFONT}`;
  }
  ctx.fillStyle = state.titleColor || '#ffffff';
  textAt(ctx, title, W / 2, titleY + (titlePx - tp) / 2, 'center', 'top');

  // ---- url ขวาล่าง ----
  if (state.url) {
    ctx.font = `500 22px ${CFONT}`;
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    textAt(ctx, state.url, W - sidePad, H - 34, 'right', 'middle');
  }

  canvas.toBlob((blob) => {
    if (!blob) { alert(t('failPng')); return; }
    download(blob, safeName(state.title || 'bonkgraph') + '.png');
  }, 'image/png');
}

function drawBadge(ctx, img, char, x, y, R) {
  ctx.save();
  // วงกลม avatar
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const s = Math.max((2 * R) / img.width, (2 * R) / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  } else {
    // fallback: วงกลมสีธง + อักษรย่อ (เผื่อ CORS โหลดรูปไม่ได้)
    ctx.fillStyle = char.color;
    ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${R}px ${CFONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((char.name || '?').slice(0, 1), x, y);
  }
  ctx.restore();

  // ขอบบางสีขาว
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  // ชื่อใต้ badge
  ctx.font = `600 18px ${CFONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const name = char.name;
  const tw = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  roundRect(ctx, x - tw / 2 - 6, y + R + 4, tw + 12, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(name, x, y + R + 8);
}

// ---------- gimmick popup ----------
function showGimmick(onYes, onNo) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <div class="modal-title">${t('gimmickCute')}</div>
      <div class="modal-actions">
        <button class="btn-yes">${t('gimmickYes')}</button>
        <button class="btn-no">${t('gimmickNo')}</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelector('.btn-yes').addEventListener('click', () => { close(); onYes(); });
  back.querySelector('.btn-no').addEventListener('click', () => { close(); onNo(); });
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
}

// popup ตอนตอบ No — น้องอาร์คอาละวาด (ภาษาที่เลือก)
function showTantrum() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <div class="modal-title">${t('tantrumTitle')}</div>
      <div class="modal-sub"><div>${t('tantrumMsg')}</div></div>
      <div class="modal-actions">
        <button class="btn-ok">${t('gimmickOk')}</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelector('.btn-ok').addEventListener('click', close);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
}

// ---------- canvas helpers ----------
function fillRect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function textAt(ctx, t, x, y, align, base) {
  if (!t) return;
  ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(t, x, y);
}
function drawCorner(ctx, t, x, y, align, base) {
  if (!t) return;
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6;
  textAt(ctx, t, x, y, align, base);
  ctx.shadowBlur = 0;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function roundImage(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}
function circleImage(ctx, img, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  const s = Math.max((2 * r) / img.width, (2 * r) / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}
function loadImg(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // โหลดไม่ได้ -> null (ใช้ fallback)
    img.src = url;
  });
}

// ---------- misc ----------
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeName(s) {
  return String(s).replace(/[^\w฀-๿.-]+/g, '_').slice(0, 60) || 'bonkgraph';
}
