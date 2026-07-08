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

async function renderCanvasAndDownload(state, board) {
  // รอให้ฟอนต์ไทย (Anuphan) โหลดเสร็จก่อน ไม่งั้น canvas จะ render ด้วยฟอนต์ระบบ
  try {
    await Promise.all([
      document.fonts.load('700 36px "Anuphan"'),
      document.fonts.load('600 26px "Anuphan"'),
      document.fonts.load('500 22px "Anuphan"'),
    ]);
    await document.fonts.ready;
  } catch (_) {}

  const br = board.getBoundingClientRect();
  const W = 1600;
  const H = Math.round(W * (br.height / br.width));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // พื้นหลัง
  ctx.fillStyle = '#0f0d1a';
  ctx.fillRect(0, 0, W, H);

  const { origin, template, placements, characters } = state;
  const ox = origin.x * W, oy = origin.y * H;
  const q = template.quadrants;
  const headerPad = 20;
  const logoSize = 44;

  // 4 quadrant (alpha ให้เท่ากับหน้าจอ)
  ctx.globalAlpha = 0.85;
  fillRect(ctx, 0, 0, ox, oy, q.topLeft.color);
  fillRect(ctx, ox, 0, W - ox, oy, q.topRight.color);
  fillRect(ctx, 0, oy, ox, H - oy, q.bottomLeft.color);
  fillRect(ctx, ox, oy, W - ox, H - oy, q.bottomRight.color);
  ctx.globalAlpha = 1;

  // แกน
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 2;
  line(ctx, ox, 0, ox, H);
  line(ctx, 0, oy, W, oy);

  // badges
  const placed = characters.filter((c) => placements[c.id]);
  const imgs = await Promise.all(placed.map((c) => loadImg(avatarBadgeUrl(c.avatarUrl, 104))));
  const R = Math.round(W * 0.033);
  placed.forEach((c, i) => {
    const p = placements[c.id];
    drawBadge(ctx, imgs[i], c, p.x * W, p.y * H, R);
  });

  // header แถวบน: logo+brand ซ้าย | แถวล่าง: ชื่อกราฟกลาง (ไม่ทับกัน)
  const brandGap = 16;
  const brandBottom = headerPad + logoSize;

  try {
    const logo = await loadImg('assets/whif_logo.jpg');
    if (logo) {
      const logoY = headerPad;
      roundImage(ctx, logo, headerPad, logoY, logoSize, logoSize, 10);
      const textX = headerPad + logoSize + brandGap;
      const textY = logoY + logoSize / 2;
      ctx.font = '700 22px "Anuphan", system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 6;
      textAt(ctx, 'BonkGraph', textX, textY - 10, 'left', 'middle');
      ctx.font = '500 17px "Anuphan", system-ui, sans-serif';
      textAt(ctx, 'by Bonkku', textX, textY + 12, 'left', 'middle');
      ctx.shadowBlur = 0;
    }
  } catch (_) {}

  const title = state.title || "Character's Flag";
  const titleY = brandBottom + 20;
  const titleSidePad = 32;
  const titleMaxW = W - titleSidePad * 2;
  let titleFont = 36;
  ctx.font = `700 ${titleFont}px "Anuphan", system-ui, sans-serif`;
  while (titleFont > 20 && ctx.measureText(title).width > titleMaxW) {
    titleFont -= 2;
    ctx.font = `700 ${titleFont}px "Anuphan", system-ui, sans-serif`;
  }
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8;
  textAt(ctx, title, W / 2, titleY, 'center', 'top');
  ctx.shadowBlur = 0;

  const headerBottom = titleY + titleFont + 16;

  // ป้าย quadrant (ใต้ header)
  ctx.font = '600 26px "Anuphan", system-ui, sans-serif';
  drawCorner(ctx, q.topLeft.label, 20, headerBottom, 'left', 'top');
  drawCorner(ctx, q.topRight.label, W - 20, headerBottom, 'right', 'top');
  drawCorner(ctx, q.bottomLeft.label, 20, H - 20, 'left', 'bottom');
  drawCorner(ctx, q.bottomRight.label, W - 20, H - 20, 'right', 'bottom');

  // ป้ายปลายแกน
  const axisTopY = headerBottom + 4;
  ctx.font = '500 22px "Anuphan", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  textAt(ctx, template.axis.x.right, W - 14, oy, 'right', 'middle');
  textAt(ctx, template.axis.x.left, 14, oy, 'left', 'middle');
  textAt(ctx, template.axis.y.top, ox, axisTopY, 'center', 'top');
  textAt(ctx, template.axis.y.bottom, ox, H - 14, 'center', 'bottom');

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
    ctx.font = `700 ${R}px "Anuphan", system-ui, sans-serif`;
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
  ctx.font = '600 18px "Anuphan", system-ui, sans-serif';
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
      <div class="modal-title">Is Ark-chan cute? 🥺</div>
      <div class="modal-sub">
        <div>น้องอาร์คน่ารักไหม?</div>
        <div>アークちゃんは可愛い？</div>
        <div>아크짱 귀엽지?</div>
        <div>阿克醬可愛嗎？</div>
      </div>
      <div class="modal-actions">
        <button class="btn-yes">Yes 💖</button>
        <button class="btn-no">No</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelector('.btn-yes').addEventListener('click', () => { close(); onYes(); });
  back.querySelector('.btn-no').addEventListener('click', () => { close(); onNo(); });
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
}

// popup ตอนตอบ No — น้องอาร์คอาละวาด (หลายภาษา)
function showTantrum() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal">
      <div class="modal-title">😾 Ark-chan threw a tantrum!</div>
      <div class="modal-sub">
        <div>Your data bounced right back to where it was...</div>
        <div>น้องอาร์คอาละวาด! ข้อมูลของคุณเด้งกลับไปอยู่ที่เดิม...</div>
        <div>アークちゃんが大暴れ！データは元の場所に戻っちゃった…</div>
        <div>아크짱이 난동을 부렸어요! 데이터가 원래 자리로 되돌아갔어요…</div>
        <div>阿克醬大鬧脾氣！你的資料被彈回原本的位置了…</div>
      </div>
      <div class="modal-actions">
        <button class="btn-ok">OK</button>
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
