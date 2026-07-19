// export/import JSON (ข้อ 9), export PNG (ข้อ 10) + gimmick popup

import { avatarBadgeUrl } from './data.js';
import { isGridTemplate } from './templates.js';
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

  if (isGridTemplate(state.template)) return renderGridCanvasAndDownload(state, board);

  const { origin, template, placements, characters } = state;
  const q = template.quadrants;

  // ---- เลย์เอาต์: กราฟอยู่กลาง มีพื้นดำรอบ (title บน, เครดิต+url แถบล่าง) ----
  const W = 1600;
  const sidePad = 48;
  const bs = W - sidePad * 2;                 // ขนาดกราฟ (สี่เหลี่ยมจัตุรัส)
  const titlePx = Math.round((state.titleScale || 3.2) / 100 * W);
  const logoSize = 48, titleTop = 40, footerH = 84;
  const topPad = titleTop + titlePx + 26;
  const bx = sidePad, by = topPad;            // มุมบนซ้ายของกราฟ
  const H = topPad + bs + footerH;

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

  // ลอกการแสดงผลจาก DOM ที่ user เห็นจริง แล้วสเกลขึ้น -> export = สิ่งที่ user จัด (ตรงทุกจอ/มือถือ)
  const liveBoard = board ? board.getBoundingClientRect().width : 0;
  const scale = liveBoard ? bs / liveBoard : bs / 900;   // fallback ถ้าอ่านกระดานไม่ได้
  const nameEls = {};
  if (board) board.querySelectorAll('.badge.placed').forEach((b) => {
    nameEls[b.dataset.id] = b.querySelector('.badge-name-txt');
  });

  const R = Math.round(bs * 0.033 * (state.badgeScale || 1));
  placed.forEach((c, i) => {
    const p = placements[c.id];
    const txtEl = nameEls[c.id];
    // อ่านฟอนต์ + การตัดบรรทัดจริงจากจอ (รองรับผล clamp บนมือถือ); ไม่มี DOM ก็ fallback แบบสัดส่วน
    const fontPx = txtEl ? parseFloat(getComputedStyle(txtEl).fontSize) * scale : bs * 0.012;
    const lines = txtEl ? readNameLines(txtEl) : greedyWrap(ctx, c.name || '', bs * 0.12, fontPx);
    drawBadge(ctx, imgs[i], c, bx + p.x * bs, by + p.y * bs, R, lines, fontPx);
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

  // ---- title (กลางบน) + เครดิตซ้ายล่าง + url ขวาล่าง ----
  await drawFrameChrome(ctx, state, { W, H, sidePad, logoSize, titleTop, titlePx, footerH });

  canvas.toBlob((blob) => {
    if (!blob) { alert(t('failPng')); return; }
    download(blob, safeName(state.title || 'bonkgraph') + '.png');
  }, 'image/png');
}

// ---------- PNG: เลย์เอาต์ตาราง 16 type ----------
// ลอกตำแหน่ง/สีจาก DOM ที่ user เห็นจริงแล้วสเกลขึ้น -> PNG = สิ่งที่จัดบนจอ
async function renderGridCanvasAndDownload(state, board) {
  if (!board) { alert(t('failPng')); return; }
  const bRect = board.getBoundingClientRect();
  if (!bRect.width) { alert(t('failPng')); return; }

  const { placements, characters } = state;

  const W = 1600, sidePad = 48;
  const boardW = W - sidePad * 2;
  const s = boardW / bRect.width;                 // สัดส่วนสเกลจากจอ -> canvas
  const boardH = Math.round(bRect.height * s);
  const titlePx = Math.round((state.titleScale || 3.2) / 100 * W);
  const logoSize = 48, titleTop = 40, footerH = 84;
  const topPad = titleTop + titlePx + 26;
  const bx = sidePad, by = topPad;
  const H = topPad + boardH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0f0d1a';
  roundRect(ctx, bx, by, boardW, boardH, 16); ctx.fill();

  // แปลง rect บนจอ -> พิกัด canvas ในกรอบกระดาน
  const map = (r) => ({
    x: bx + (r.left - bRect.left) * s,
    y: by + (r.top - bRect.top) * s,
    w: r.width * s,
    h: r.height * s,
  });

  // การ์ด 16 ใบ (พื้น + ขอบ + โค้ด type) — อ่านสีจริงจาก CSS
  for (const card of board.querySelectorAll('.mbti-card')) {
    const m = map(card.getBoundingClientRect());
    const cs = getComputedStyle(card);
    const rad = (parseFloat(cs.borderTopLeftRadius) || 10) * s;
    ctx.fillStyle = cs.backgroundColor;
    roundRect(ctx, m.x, m.y, m.w, m.h, rad); ctx.fill();
    ctx.lineWidth = Math.max(1, (parseFloat(cs.borderTopWidth) || 1) * s);
    ctx.strokeStyle = cs.borderTopColor;
    roundRect(ctx, m.x, m.y, m.w, m.h, rad); ctx.stroke();

    const tl = card.querySelector('.mbti-card-type');
    if (tl) {
      const tr = map(tl.getBoundingClientRect());
      const ts = getComputedStyle(tl);
      ctx.font = `${ts.fontWeight || 700} ${parseFloat(ts.fontSize) * s}px ${CFONT}`;
      ctx.fillStyle = ts.color;
      textAt(ctx, tl.textContent, tr.x, tr.y + tr.h / 2, 'left', 'middle');
    }
  }

  // หัวคอลัมน์ (temperament)
  for (const head of board.querySelectorAll('.grid-col-head')) {
    const hr = map(head.getBoundingClientRect());
    const hs = getComputedStyle(head);
    ctx.font = `${hs.fontWeight || 700} ${parseFloat(hs.fontSize) * s}px ${CFONT}`;
    ctx.fillStyle = hs.color;
    textAt(ctx, head.textContent, hr.x, hr.y + hr.h / 2, 'left', 'middle');
  }

  // badge ในการ์ด
  const placed = characters.filter((c) => {
    const b = board.querySelector(`.badge.in-cell[data-id="${cssEsc(c.id)}"]`);
    return !!b;
  });
  const imgs = await Promise.all(placed.map((c) => loadImg(avatarBadgeUrl(c.avatarUrl, 104))));
  placed.forEach((c, i) => {
    const badge = board.querySelector(`.badge.in-cell[data-id="${cssEsc(c.id)}"]`);
    const imgEl = badge.querySelector('img');
    const avaRect = imgEl && imgEl.getBoundingClientRect().width
      ? imgEl.getBoundingClientRect()
      : badge.getBoundingClientRect();       // noimg -> ใช้กรอบ badge เป็นวงกลม fallback
    const cx = bx + (avaRect.left + avaRect.width / 2 - bRect.left) * s;
    const cy = by + (avaRect.top + avaRect.width / 2 - bRect.top) * s;
    const R = (avaRect.width / 2) * s;
    const txtEl = badge.querySelector('.badge-name-txt');
    const fontPx = txtEl ? parseFloat(getComputedStyle(txtEl).fontSize) * s : R * 0.5;
    const lines = txtEl ? readNameLines(txtEl) : [c.name || ''];
    drawBadge(ctx, imgs[i], c, cx, cy, R, lines, fontPx, false);
  });

  await drawFrameChrome(ctx, state, { W, H, sidePad, logoSize, titleTop, titlePx, footerH });

  canvas.toBlob((blob) => {
    if (!blob) { alert(t('failPng')); return; }
    download(blob, safeName(state.title || 'bonkgraph') + '.png');
  }, 'image/png');
}

// title กลางบน + เครดิตซ้ายล่าง (logo + ข้อความ) + url ขวาล่าง — ใช้ร่วมทุกเลย์เอาต์
async function drawFrameChrome(ctx, state, { W, H, sidePad, logoSize, titleTop, titlePx, footerH }) {
  // title (กลางบน, สี/ขนาดปรับได้)
  let title = state.title || "Character's Flag";
  let tp = titlePx;
  ctx.font = `700 ${tp}px ${CFONT}`;
  const titleMaxW = W - sidePad * 2;
  while (tp > 16 && ctx.measureText(title).width > titleMaxW) {
    tp -= 2; ctx.font = `700 ${tp}px ${CFONT}`;
  }
  ctx.fillStyle = state.titleColor || '#ffffff';
  textAt(ctx, title, W / 2, titleTop + (titlePx - tp) / 2, 'center', 'top');

  // แถบล่าง: เครดิตซ้าย (ark_logo วงกลม + ข้อความ) / url ขวา
  const cy = H - footerH / 2;
  try {
    const logo = await loadImg('assets/ark_logo.png');
    if (logo) circleImage(ctx, logo, sidePad + logoSize / 2, cy, logoSize / 2);
  } catch (_) {}
  ctx.font = `600 24px ${CFONT}`;
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  textAt(ctx, 'Create at bonkkuwhif.github.io/BonkGraph', sidePad + logoSize + 14, cy, 'left', 'middle');

  if (state.url) {
    ctx.font = `500 22px ${CFONT}`;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    textAt(ctx, state.url, W - sidePad, cy, 'right', 'middle');
  }
}

// escape id สำหรับ querySelector (id เรามีขีด/ตัวเลข ปลอดภัยไว้ก่อน)
function cssEsc(s) {
  return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
}

function drawBadge(ctx, img, char, x, y, R, lines = [char.name || ''], nameFontPx = 18, nameChip = true) {
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

  // ชื่อใต้ badge — วาดตามบรรทัดที่ตัดมาจากจอจริง + ชิปพื้นเข้มต่อบรรทัด (ตรงกับที่ user เห็น)
  ctx.font = `600 ${nameFontPx}px ${CFONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const padX = Math.round(nameFontPx * 0.5);
  const padY = Math.round(nameFontPx * 0.18);
  const lineH = Math.round(nameFontPx * 1.5);
  const rad = Math.round(nameFontPx * 0.4);
  let ly = y + R + Math.round(nameFontPx * 0.4) + 2;
  for (const ln of lines) {
    if (!ln) { ly += lineH; continue; }
    if (nameChip) {
      const tw = ctx.measureText(ln).width;
      ctx.fillStyle = 'rgba(12, 10, 22, .8)';
      roundRect(ctx, x - tw / 2 - padX, ly - padY, tw + padX * 2, nameFontPx + padY * 2, rad);
      ctx.fill();
    } else {
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 3;
    }
    ctx.fillStyle = '#fff';
    ctx.fillText(ln, x, ly);
    ctx.shadowBlur = 0;
    ly += lineH;
  }
}

// อ่านบรรทัดที่เบราว์เซอร์ตัดจริงจาก element ชื่อ (ตรวจการขึ้นบรรทัดจาก top ของแต่ละอักขระ)
function readNameLines(txtEl) {
  const node = txtEl && txtEl.firstChild;
  const text = node ? node.textContent : (txtEl ? txtEl.textContent : '') || '';
  if (!node || !text) return [text];
  const range = document.createRange();
  const lines = [];
  let cur = '', prevTop = null;
  for (let i = 0; i < text.length; i++) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    if (prevTop !== null && r.top - prevTop > 1 && cur) { lines.push(cur); cur = ''; }
    cur += text[i];
    prevTop = r.top;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

// fallback ตัดบรรทัดเอง (ใช้เมื่ออ่าน DOM ไม่ได้) — แบ่งทีละอักขระตามความกว้าง
function greedyWrap(ctx, text, maxW, fontPx) {
  ctx.save();
  ctx.font = `600 ${fontPx}px ${CFONT}`;
  const out = [];
  let line = '';
  for (const ch of Array.from(text)) {
    const test = line + ch;
    if (line && ctx.measureText(test).width > maxW) { out.push(line); line = ch; }
    else line = test;
  }
  if (line) out.push(line);
  ctx.restore();
  return out.length ? out : [''];
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
