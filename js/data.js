// Adapter สำหรับดึงข้อมูลตัวละคร
// ตอนนี้ hard-code อ่านจาก data/characters.json (ข้อ 1)
// อนาคต: เพิ่ม fromCreatorUrl() ดึงจาก https://www.whif.io/profile/<name> (ข้อ 11)

// map ประเภทธงในข้อมูล -> สีขอบ badge (ให้ user ดูออกก่อนลากวาง)
export const FLAG_COLORS = {
  'ธงเขียว': '#22c55e',
  'ธงเหลือง': '#eab308',
  'ธงแดง': '#ef4444',
  'ธงดำ': '#4b5563',
};

// สร้าง id ที่คงที่จากข้อมูลตัวละคร เพื่อใช้ผูก placement ตอน export/import
function makeId(c, i) {
  return `${c.universeId || 'u'}-${i}-${(c.name || '').slice(0, 8)}`;
}

function normalize(list) {
  return list.map((c, i) => ({
    id: makeId(c, i),
    name: c.name || '(ไม่มีชื่อ)',
    avatarUrl: c.avatarUrl || '',
    keywords: c.keywords || [],
    type: c.type || '',
    color: FLAG_COLORS[c.type] || '#94a3b8',
  }));
}

export async function loadCharacters() {
  const res = await fetch('data/characters.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('โหลด characters.json ไม่สำเร็จ');
  const json = await res.json();
  return normalize(json.characters || []);
}

// stub เผื่ออนาคต — ยังไม่ได้ใช้ (จะติด CORS ต้องมี proxy)
export async function fromCreatorUrl(_url) {
  throw new Error('ยังไม่รองรับ — จะเพิ่มในอนาคต');
}
