import { loadCharacters, avatarBadgeUrl } from './data.js';
import { cloneTemplate, TEMPLATES, QUADRANT_KEYS } from './templates.js';
import { exportJSON, importJSON, exportPNG } from './export.js';
import { t, setLang, getLang, applyI18n, LANGS } from './i18n.js';

// ---------- STATE ----------
// พิกัดทุกอย่างเก็บเป็น "สัดส่วน 0..1" ของกระดาน เพื่อ resize ได้โดยไม่เพี้ยน
const state = {
  title: '',
  template: cloneTemplate('flag'),
  origin: { x: 0.5, y: 0.5 },      // จุด (0,0) ของกราฟ — ลากได้
  characters: [],                   // pool ทั้งหมด = defaults + custom (ใช้ render)
  customCharacters: [],             // ตัวที่ user เพิ่มเอง (อัปโหลด/วาง JSON) — persist ได้
  placements: {},                   // { charId: {x, y} } เฉพาะตัวที่วางบนกระดาน
  // การแสดงผล
  titleColor: '#ffffff',
  titleScale: 3.2,                  // ขนาดชื่อ = % ของความกว้าง frame
  badgeScale: 1,                    // ตัวคูณขนาด badge บนกระดาน
  url: 'https://www.whif.io/',      // ข้อความมุมขวาล่างนอกกราฟ
};

let defaultCharacters = [];         // ตัวละคร default จาก characters.json

// ประกอบ pool = defaults + custom
function rebuildPool() {
  state.characters = [...defaultCharacters, ...state.customCharacters];
}

// เผยแพร่ให้ export.js เข้าถึง
export function getState() { return state; }

// ---------- DOM refs ----------
const el = {};
function cacheDom() {
  el.board = document.getElementById('board');
  el.stage = document.getElementById('stage');
  el.tray = document.getElementById('tray');
  el.trayCount = document.getElementById('tray-count');
  el.title = document.getElementById('graph-title');
  el.url = document.getElementById('frame-url');
}

// อัปเดต CSS variables ของการแสดงผล (title สี/ขนาด, badge ขนาด)
function applyDisplayVars() {
  el.stage.style.setProperty('--title-color', state.titleColor);
  el.stage.style.setProperty('--title-scale', state.titleScale);
  el.stage.style.setProperty('--badge-scale', state.badgeScale);
}

// ---------- RENDER: กราฟ (quadrant + แกน + ป้าย + origin) ----------
const QUAD_KEYS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

function originPercents() {
  const { origin } = state;
  return {
    ox: (origin.x * 100).toFixed(2) + '%',
    oy: (origin.y * 100).toFixed(2) + '%',
    rx: ((1 - origin.x) * 100).toFixed(2) + '%',
    ry: ((1 - origin.y) * 100).toFixed(2) + '%',
  };
}

function syncGraphGeometry() {
  const { template } = state;
  const { ox, oy, rx, ry } = originPercents();
  const q = template.quadrants;
  const quadStyles = [
    `left:0;top:0;width:${ox};height:${oy}`,
    `left:${ox};top:0;width:${rx};height:${oy}`,
    `left:0;top:${oy};width:${ox};height:${ry}`,
    `left:${ox};top:${oy};width:${rx};height:${ry}`,
  ];

  el.board.querySelectorAll('.gfx.quadrant').forEach((node, i) => {
    node.style.cssText = quadStyles[i];
    node.style.background = q[QUAD_KEYS[i]].color;
  });

  const vLine = el.board.querySelector('.gfx.axis-v');
  const hLine = el.board.querySelector('.gfx.axis-h');
  if (vLine) vLine.style.left = ox;
  if (hLine) hLine.style.top = oy;

  const ax = template.axis;
  const axisStyles = {
    'x-right': `right:6px;top:${oy};transform:translateY(-50%)`,
    'x-left': `left:6px;top:${oy};transform:translateY(-50%)`,
    'y-top': `top:4px;left:${ox};transform:translateX(-50%)`,
    'y-bottom': `bottom:4px;left:${ox};transform:translateX(-50%)`,
  };
  const axisText = {
    'x-right': ax.x.right,
    'x-left': ax.x.left,
    'y-top': ax.y.top,
    'y-bottom': ax.y.bottom,
  };
  el.board.querySelectorAll('.gfx.axis-label').forEach((node) => {
    const key = node.dataset.axis;
    if (!key || !axisText[key]) return;
    node.style.cssText = axisStyles[key];
    node.textContent = axisText[key];
  });

  const oh = el.board.querySelector('.origin-handle');
  if (oh) {
    oh.style.left = ox;
    oh.style.top = oy;
  }
}

function ensureOriginHandle() {
  let oh = el.board.querySelector('.origin-handle');
  if (oh) return oh;
  oh = document.createElement('div');
  oh.className = 'origin-handle';
  oh.title = t('origin');
  oh.setAttribute('aria-label', t('origin'));
  oh.addEventListener('pointerdown', startOriginDrag);
  el.board.appendChild(oh);
  return oh;
}

function renderGraph() {
  const { template } = state;
  const { ox, oy, rx, ry } = originPercents();

  // ลบ gfx เดิม (เก็บ badge + origin handle ไว้)
  el.board.querySelectorAll('.gfx').forEach((n) => n.remove());

  const q = template.quadrants;
  const quads = [
    ['topLeft', `left:0;top:0;width:${ox};height:${oy}`],
    ['topRight', `left:${ox};top:0;width:${rx};height:${oy}`],
    ['bottomLeft', `left:0;top:${oy};width:${ox};height:${ry}`],
    ['bottomRight', `left:${ox};top:${oy};width:${rx};height:${ry}`],
  ];
  const labelPos = {
    topLeft: 'top:8px;left:8px;text-align:left',
    topRight: 'top:8px;right:8px;text-align:right',
    bottomLeft: 'bottom:8px;left:8px;text-align:left',
    bottomRight: 'bottom:8px;right:8px;text-align:right',
  };

  const frag = document.createDocumentFragment();

  for (const [key, style] of quads) {
    const d = document.createElement('div');
    d.className = 'gfx quadrant';
    d.style.cssText = style;
    d.style.background = q[key].color;
    frag.appendChild(d);

    if (q[key].label) {
      const lab = document.createElement('div');
      lab.className = 'gfx quad-label';
      lab.style.cssText = labelPos[key];
      lab.textContent = q[key].label;
      frag.appendChild(lab);
    }
  }

  const vLine = document.createElement('div');
  vLine.className = 'gfx axis axis-v';
  vLine.style.left = ox;
  const hLine = document.createElement('div');
  hLine.className = 'gfx axis axis-h';
  hLine.style.top = oy;
  frag.appendChild(vLine);
  frag.appendChild(hLine);

  const ax = template.axis;
  const axisLabels = [
    ['x-right', ax.x.right, `right:6px;top:${oy};transform:translateY(-50%)`],
    ['x-left', ax.x.left, `left:6px;top:${oy};transform:translateY(-50%)`],
    ['y-top', ax.y.top, `top:4px;left:${ox};transform:translateX(-50%)`],
    ['y-bottom', ax.y.bottom, `bottom:4px;left:${ox};transform:translateX(-50%)`],
  ];
  for (const [key, text, style] of axisLabels) {
    if (!text) continue;
    const a = document.createElement('div');
    a.className = 'gfx axis-label';
    a.dataset.axis = key;
    a.style.cssText = style;
    a.textContent = text;
    frag.appendChild(a);
  }

  el.board.appendChild(frag);
  ensureOriginHandle();
  syncGraphGeometry();
}

// ---------- RENDER: badge ----------
function badgeEl(char, placed) {
  const b = document.createElement('div');
  b.className = 'badge' + (placed ? ' placed' : '');
  b.dataset.id = char.id;
  b.dataset.initial = (char.name || '?').slice(0, 1);
  b.style.setProperty('--flag', char.color);

  const img = document.createElement('img');
  img.src = avatarBadgeUrl(char.avatarUrl, placed ? 104 : 88);
  img.alt = char.name;
  img.crossOrigin = 'anonymous';       // เผื่อ export PNG (ข้อ 10)
  img.loading = 'lazy';
  img.draggable = false;
  img.addEventListener('error', () => b.classList.add('noimg'));
  b.appendChild(img);

  const name = document.createElement('span');
  name.className = 'badge-name';
  const nameTxt = document.createElement('span');   // inner span รับ chip พื้นหลัง (หุ้มพอดีแต่ละบรรทัด)
  nameTxt.className = 'badge-name-txt';
  nameTxt.textContent = char.name;
  name.appendChild(nameTxt);
  b.appendChild(name);

  b.addEventListener('pointerdown', (e) => startBadgeDrag(e, char));
  return b;
}

function renderBadges() {
  // ลบ badge เก่าทั้งหมด แล้วสร้างใหม่จาก state
  el.board.querySelectorAll('.badge').forEach((n) => n.remove());
  el.tray.querySelectorAll('.badge').forEach((n) => n.remove());

  let trayN = 0;
  for (const c of state.characters) {
    const p = state.placements[c.id];
    if (p) {
      const b = badgeEl(c, true);
      b.style.left = p.x * 100 + '%';
      b.style.top = p.y * 100 + '%';
      el.board.appendChild(b);
    } else {
      el.tray.appendChild(badgeEl(c, false));
      trayN++;
    }
  }
  el.trayCount.textContent = trayN;
}

export function renderAll() {
  renderGraph();
  renderBadges();
  const oh = el.board.querySelector('.origin-handle');
  if (oh) el.board.appendChild(oh);
  el.title.value = state.title;
  el.url.value = state.url;
  applyDisplayVars();
  syncDisplayControls();
  document.title = (state.title || 'BonkGraph') + ' — BonkGraph';
}

// เซ็ตค่าใน panel การแสดงผลให้ตรงกับ state
function syncDisplayControls() {
  const c = document.getElementById('ctl-title-color');
  const s = document.getElementById('ctl-title-size');
  const b = document.getElementById('ctl-badge-size');
  if (c) c.value = state.titleColor;
  if (s) s.value = state.titleScale;
  if (b) b.value = state.badgeScale;
}

// ---------- board point (วางตรงจุดที่ปล่อย ไม่มี snap) ----------
function boardPointFromClient(cx, cy) {
  const br = el.board.getBoundingClientRect();
  const inside =
    cx >= br.left && cx <= br.right &&
    cy >= br.top && cy <= br.bottom;
  if (!inside) return { inside: false };
  const x = clamp((cx - br.left) / br.width, 0, 1);
  const y = clamp((cy - br.top) / br.height, 0, 1);
  return {
    inside: true,
    x,
    y,
    clientX: br.left + x * br.width,
    clientY: br.top + y * br.height,
  };
}

// ---------- DRAG: badge ----------
let drag = null;
function startBadgeDrag(e, char) {
  e.preventDefault();
  const b = e.currentTarget;
  const r = b.getBoundingClientRect();
  drag = {
    char,
    el: b,
    dx: e.clientX - (r.left + r.width / 2),
    dy: e.clientY - (r.top + r.height / 2),
    moved: false,
  };
  try { b.setPointerCapture(e.pointerId); } catch (_) {}
  b.classList.add('dragging');
  b.style.position = 'fixed';
  b.style.zIndex = 9999;
  moveDragTo(e.clientX, e.clientY);
  b.addEventListener('pointermove', onBadgeMove);
  b.addEventListener('pointerup', onBadgeUp);
  b.addEventListener('pointercancel', onBadgeUp);
}
function moveDragTo(cx, cy) {
  drag.el.style.left = cx - drag.dx + 'px';
  drag.el.style.top = cy - drag.dy + 'px';
  drag.el.style.transform = 'translate(-50%, -50%)';
}
function onBadgeMove(e) {
  if (!drag) return;
  drag.moved = true;
  const pt = boardPointFromClient(e.clientX, e.clientY);
  if (pt.inside) moveDragTo(pt.clientX, pt.clientY);
  else moveDragTo(e.clientX, e.clientY);
}
function onBadgeUp(e) {
  if (!drag) return;
  const b = drag.el;
  b.releasePointerCapture?.(e.pointerId);
  b.removeEventListener('pointermove', onBadgeMove);
  b.removeEventListener('pointerup', onBadgeUp);
  b.removeEventListener('pointercancel', onBadgeUp);

  const pt = boardPointFromClient(e.clientX, e.clientY);

  if (pt.inside) {
    state.placements[drag.char.id] = { x: pt.x, y: pt.y };
  } else {
    // ปล่อยนอกกระดาน = เอากลับลงถาด
    delete state.placements[drag.char.id];
  }
  drag = null;
  renderBadges();
  saveLocal();
}

// ---------- DRAG: origin ----------
let originDrag = false;

function moveOriginTo(clientX, clientY) {
  const br = el.board.getBoundingClientRect();
  state.origin.x = clamp((clientX - br.left) / br.width, 0.01, 0.99);
  state.origin.y = clamp((clientY - br.top) / br.height, 0.01, 0.99);
  syncGraphGeometry();
}

function startOriginDrag(e) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  e.preventDefault();
  e.stopPropagation();
  originDrag = true;
  const h = e.currentTarget;
  h.classList.add('dragging');
  moveOriginTo(e.clientX, e.clientY);

  const move = (ev) => {
    if (!originDrag) return;
    ev.preventDefault();
    moveOriginTo(ev.clientX, ev.clientY);
  };
  const end = () => {
    if (!originDrag) return;
    originDrag = false;
    h.classList.remove('dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    saveLocal();
  };

  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

// ---------- utils ----------
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------- persistence (ข้อ 9 - เก็บกันงานหาย) ----------
const LS_KEY = 'bonkgraph_state_v1';
export function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      title: state.title,
      template: state.template,
      origin: state.origin,
      placements: state.placements,
      customCharacters: state.customCharacters,
      titleColor: state.titleColor,
      titleScale: state.titleScale,
      badgeScale: state.badgeScale,
      url: state.url,
    }));
  } catch (_) {
    // localStorage เต็ม (รูป data URL ใหญ่) — ข้ามไป ยังใช้งานใน session ได้
  }
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    applySnapshot(JSON.parse(raw));
    return true;
  } catch (_) { return false; }
}

// นำ snapshot (จาก localStorage หรือ import) มาใส่ state
export function applySnapshot(s) {
  if (s.title != null) state.title = s.title;
  if (s.template) state.template = s.template;
  if (s.origin) state.origin = s.origin;
  if (s.placements) state.placements = s.placements;
  if (Array.isArray(s.customCharacters)) {
    state.customCharacters = s.customCharacters.map(normalizeCustom);
  }
  if (s.titleColor) state.titleColor = s.titleColor;
  if (s.titleScale != null) state.titleScale = s.titleScale;
  if (s.badgeScale != null) state.badgeScale = s.badgeScale;
  if (s.url != null) state.url = s.url;
  rebuildPool();
}

// ---------- custom characters (ข้อ: manual json + สร้างเอง) ----------
const DEFAULT_FLAG = '#94a3b8';

function genId() {
  return 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

// รับ object อิสระ -> character ที่ใช้ได้ (ต้องมีอย่างน้อย name หรือ avatarUrl)
function normalizeCustom(o) {
  return {
    id: o.id || genId(),
    name: (o.name || '').toString().trim() || 'Unnamed',
    avatarUrl: (o.avatarUrl || o.avatar || o.image || o.imageUrl || '').toString().trim(),
    color: o.color || DEFAULT_FLAG,
    custom: true,
  };
}

function addCustomCharacter(data) {
  const c = normalizeCustom(data);
  state.customCharacters.push(c);
  rebuildPool();
  renderBadges();
  saveLocal();
  return c;
}

// วาง JSON: รับ array [{name, avatarUrl}] หรือ {characters:[...]} — ใช้แค่ name/avatarUrl
function addCharactersFromJsonText(text) {
  let data = JSON.parse(text);
  if (data && Array.isArray(data.characters)) data = data.characters;
  if (!Array.isArray(data)) throw new Error(t('errNotArray'));
  const valid = data.filter((o) => o && (o.name || o.avatarUrl || o.image || o.imageUrl || o.avatar));
  if (!valid.length) throw new Error(t('errNoChar'));
  valid.forEach((o) => state.customCharacters.push(normalizeCustom(o)));
  rebuildPool();
  renderBadges();
  saveLocal();
  return valid.length;
}

function clearCustomCharacters() {
  if (!state.customCharacters.length) {
    alert(t('noCustom'));
    return;
  }
  if (!confirm(t('confirmRemoveCustom', { n: state.customCharacters.length }))) return;
  // เอา placement ของ custom ออกด้วย
  for (const c of state.customCharacters) delete state.placements[c.id];
  state.customCharacters = [];
  rebuildPool();
  renderBadges();
  saveLocal();
}

// ย่อรูป + crop เป็นสี่เหลี่ยมจัตุรัส -> data URL (เล็กพอเก็บ localStorage + คมพอ export)
function fileToSquareDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('File is not an image'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Cannot read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Broken image'));
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// modal เพิ่มตัวละคร (2 โหมด: อัปโหลดรูป / วาง JSON)
function showAddCharModal() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal add-char-modal">
      <div class="modal-title">${t('addCharTitle')}</div>
      <div class="tabs">
        <button class="tab active" data-tab="upload">${t('tabUpload')}</button>
        <button class="tab" data-tab="json">${t('tabJson')}</button>
      </div>

      <div class="tab-body" data-body="upload">
        <label class="drop">
          <input type="file" id="ac-file" accept="image/*">
          <span class="drop-text">${t('dropText')}</span>
          <img id="ac-preview" alt="">
        </label>
        <input id="ac-name" type="text" placeholder="${escapeAttr(t('charNamePh'))}">
        <button id="ac-add" class="btn-primary">${t('addToTray')}</button>
      </div>

      <div class="tab-body" data-body="json" hidden>
        <textarea id="ac-json" placeholder='[{"name":"Ark","avatarUrl":"https://..."}]'></textarea>
        <div class="hint">${t('jsonHint')}</div>
        <button id="ac-json-add" class="btn-primary">${t('loadIntoTray')}</button>
      </div>

      <button class="modal-close" title="${escapeAttr(t('close'))}">✕</button>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelector('.modal-close').addEventListener('click', close);

  // สลับแท็บ
  back.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      back.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === tab));
      back.querySelectorAll('.tab-body').forEach((b) => {
        b.hidden = b.dataset.body !== tab.dataset.tab;
      });
    });
  });

  // โหมดอัปโหลด
  let pendingDataUrl = '';
  const fileInp = back.querySelector('#ac-file');
  const preview = back.querySelector('#ac-preview');
  const nameInp = back.querySelector('#ac-name');
  fileInp.addEventListener('change', async () => {
    const f = fileInp.files?.[0];
    if (!f) return;
    try {
      pendingDataUrl = await fileToSquareDataUrl(f);
      preview.src = pendingDataUrl;
      preview.style.display = 'block';
      if (!nameInp.value) nameInp.value = f.name.replace(/\.[^.]+$/, '');
    } catch (err) { alert(err.message); }
  });
  back.querySelector('#ac-add').addEventListener('click', () => {
    if (!pendingDataUrl) { alert(t('alertChooseImage')); return; }
    if (!nameInp.value.trim()) { alert(t('alertEnterName')); return; }
    addCustomCharacter({ name: nameInp.value, avatarUrl: pendingDataUrl });
    close();
  });

  // โหมด JSON
  back.querySelector('#ac-json-add').addEventListener('click', () => {
    const txt = back.querySelector('#ac-json').value.trim();
    if (!txt) { alert(t('alertPasteJson')); return; }
    try {
      const n = addCharactersFromJsonText(txt);
      close();
      alert(t('added', { n }));
    } catch (err) { alert(t('invalidJson') + err.message); }
  });
}

// ---------- template controls ----------
function buildTemplateEditor() {
  const box = document.getElementById('tpl-fields');
  const tpl = state.template;

  const rows = [
    [t('graphTitle'), 'title', tpl.title],
    [t('axisXRight'), 'ax-x-right', tpl.axis.x.right],
    [t('axisXLeft'), 'ax-x-left', tpl.axis.x.left],
    [t('axisYTop'), 'ax-y-top', tpl.axis.y.top],
    [t('axisYBottom'), 'ax-y-bottom', tpl.axis.y.bottom],
  ];
  let html = '<div class="tpl-grid">';
  for (const [label, key, val] of rows) {
    html += `<label>${label}<input data-k="${key}" value="${escapeAttr(val)}"></label>`;
  }
  html += '</div><div class="tpl-quads">';
  const qlab = { topLeft: t('quadTL'), topRight: t('quadTR'), bottomLeft: t('quadBL'), bottomRight: t('quadBR') };
  for (const k of QUADRANT_KEYS) {
    const qq = tpl.quadrants[k];
    html += `<div class="tpl-quad"><b>${qlab[k]}</b>
      <input data-q="${k}" data-f="label" value="${escapeAttr(qq.label)}" placeholder="${escapeAttr(t('zoneName'))}">
      <input data-q="${k}" data-f="color" type="color" value="${qq.color}"></div>`;
  }
  html += '</div>';
  box.innerHTML = html;

  box.querySelectorAll('input[data-k]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      if (k === 'title') { state.title = inp.value; el.title.value = inp.value; }
      else if (k === 'ax-x-right') tpl.axis.x.right = inp.value;
      else if (k === 'ax-x-left') tpl.axis.x.left = inp.value;
      else if (k === 'ax-y-top') tpl.axis.y.top = inp.value;
      else if (k === 'ax-y-bottom') tpl.axis.y.bottom = inp.value;
      renderGraph(); saveLocal();
    });
  });
  box.querySelectorAll('input[data-q]').forEach((inp) => {
    inp.addEventListener('input', () => {
      tpl.quadrants[inp.dataset.q][inp.dataset.f] = inp.value;
      renderGraph(); saveLocal();
    });
  });
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function applyTemplate(id) {
  state.template = cloneTemplate(id);
  if (!state.title) state.title = state.template.title;
  el.title.value = state.title;
  buildTemplateEditor();
  renderAll();
  saveLocal();
}

// ---------- wire UI ----------
function wireUI() {
  el.title.addEventListener('input', () => {
    state.title = el.title.value;
    document.title = (state.title || 'BonkGraph') + ' — BonkGraph';
    saveLocal();
  });

  el.url.addEventListener('input', () => {
    state.url = el.url.value;
    saveLocal();
  });

  // display controls
  document.getElementById('ctl-title-color').addEventListener('input', (e) => {
    state.titleColor = e.target.value; applyDisplayVars(); saveLocal();
  });
  document.getElementById('ctl-title-size').addEventListener('input', (e) => {
    state.titleScale = parseFloat(e.target.value); applyDisplayVars(); saveLocal();
  });
  document.getElementById('ctl-badge-size').addEventListener('input', (e) => {
    state.badgeScale = parseFloat(e.target.value); applyDisplayVars(); saveLocal();
  });

  document.getElementById('tpl-select').addEventListener('change', (e) => {
    applyTemplate(e.target.value);
  });

  const panel = document.getElementById('tpl-panel');
  document.getElementById('btn-template').addEventListener('click', () => {
    // วาง panel ให้อยู่ใต้ topbar พอดี (topbar สูงไม่คงที่บนมือถือ)
    panel.style.top = document.getElementById('topbar').offsetHeight + 'px';
    panel.classList.toggle('open');
  });

  document.getElementById('btn-export-json').addEventListener('click', () => exportJSON(state));
  document.getElementById('btn-import-json').addEventListener('click', () => {
    importJSON((snap) => {
      applySnapshot(snap);   // rebuild pool ภายในแล้ว
      buildTemplateEditor();
      renderAll();
      saveLocal();
    });
  });
  document.getElementById('btn-export-png').addEventListener('click', () => {
    exportPNG(state, el.board, {
      onClearBoard: () => { state.placements = {}; renderBadges(); saveLocal(); },
    });
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm(t('confirmClearBoard'))) return;
    state.placements = {};
    renderBadges();
    saveLocal();
  });

  document.getElementById('btn-add-char').addEventListener('click', showAddCharModal);
  document.getElementById('btn-clear-chars').addEventListener('click', clearCustomCharacters);

  // ตัวเลือกภาษา (dropdown แบบ custom + ธง SVG)
  setupLangDropdown();
}

function langOf(code) { return LANGS.find((l) => l.code === code) || LANGS[0]; }

function setupLangDropdown() {
  const btn = document.getElementById('lang-btn');
  const menu = document.getElementById('lang-menu');

  const renderBtn = () => {
    const l = langOf(getLang());
    btn.innerHTML = `<span class="lang-flag">${l.flag}</span><span class="lang-lbl">${l.label}</span><span class="caret">▾</span>`;
  };
  menu.innerHTML = LANGS.map((l) =>
    `<button type="button" data-lang="${l.code}"><span class="lang-flag">${l.flag}</span>${l.label}</button>`
  ).join('');

  const markActive = () => menu.querySelectorAll('button').forEach((b) =>
    b.classList.toggle('active', b.dataset.lang === getLang()));

  const choose = (code) => {
    setLang(code);
    localStorage.setItem(LANG_KEY, getLang());
    applyI18n(document);
    buildTemplateEditor();
    renderBtn(); markActive();
    menu.hidden = true;
  };

  renderBtn(); markActive();
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  menu.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => choose(b.dataset.lang)));
  document.addEventListener('click', () => { menu.hidden = true; });
}

const LANG_KEY = 'bonkgraph_lang';

// ---------- init ----------
async function init() {
  cacheDom();
  const savedLang = localStorage.getItem(LANG_KEY);
  if (savedLang) setLang(savedLang);
  wireUI();
  applyI18n(document);   // แปล static UI ตามภาษาที่บันทึกไว้
  loadLocal();
  if (!state.title) state.title = state.template.title;

  // set template dropdown ให้ตรงกับ state
  const sel = document.getElementById('tpl-select');
  if (TEMPLATES[state.template.id]) sel.value = state.template.id;

  buildTemplateEditor();

  try {
    defaultCharacters = await loadCharacters();
  } catch (err) {
    defaultCharacters = [];
    document.getElementById('tray').innerHTML =
      `<div class="tray-error">${t('failLoad')}${err.message}</div>`;
  }
  rebuildPool();   // defaults + custom (จาก localStorage/snapshot)
  renderAll();

  window.addEventListener('resize', () => renderGraph());
}

init();
