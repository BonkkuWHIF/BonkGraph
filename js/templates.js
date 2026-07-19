// นิยาม template ของกราฟ — ออกแบบให้ทุกอย่างเป็น data ก้อนเดียว
// เพื่อให้ user clone ไปแก้เป็น custom template ได้ง่าย (ข้อ 5)
//
// โครงสร้าง 1 template:
// {
//   id, name,
//   title: ชื่อเริ่มต้นของกราฟ,
//   axis: { x:{left,right}, y:{top,bottom} }   // ป้ายปลายแกน
//   quadrants: { topRight, bottomRight, bottomLeft, topLeft }
//              แต่ละช่อง = { label, color }
// }

export const TEMPLATES = {
  flag: {
    id: 'flag',
    name: 'Character Flags',
    title: "Character's Flag",
    axis: {
      x: { left: 'Dangerous', right: 'Safe' },
      y: { top: 'Cool / Calm', bottom: 'Warm / Sweet' },
    },
    quadrants: {
      topRight: { label: 'Green Flag', color: '#22c55e' },
      bottomRight: { label: 'Yellow Flag', color: '#eab308' },
      bottomLeft: { label: 'Red Flag', color: '#ef4444' },
      topLeft: { label: 'Black Flag', color: '#4b5563' },
    },
  },

  mbti: {
    id: 'mbti',
    name: 'MBTI (E–I × T–F)',
    title: 'Character MBTI Map',
    axis: {
      x: { left: 'Introvert (I)', right: 'Extrovert (E)' },
      y: { top: 'Thinking (T)', bottom: 'Feeling (F)' },
    },
    quadrants: {
      topRight: { label: 'ET · Bold Thinker', color: '#3b82f6' },
      bottomRight: { label: 'EF · Social / Playful', color: '#eab308' },
      bottomLeft: { label: 'IF · Gentle / Reserved', color: '#22c55e' },
      topLeft: { label: 'IT · Quiet Analyst', color: '#8b5cf6' },
    },
  },

  // เลย์เอาต์แบบตาราง 16 บุคลิก (ลากรูปลงการ์ดของแต่ละ type)
  // จัดกลุ่ม 4 คอลัมน์ตามอารมณ์นิยม (temperament): NT / NF / SJ / SP
  mbti16: {
    id: 'mbti16',
    name: 'MBTI · 16 Types',
    kind: 'grid',
    title: 'Character MBTI Map',
    // ป้ายกลุ่ม (temperament) แปลตามภาษาที่เลือกด้วย i18n key = 'mbti' + key (ดู i18n.js)
    columns: [
      { key: 'NT', color: '#8f6fc4', types: ['INTJ', 'INTP', 'ENTJ', 'ENTP'] },
      { key: 'NF', color: '#33a474', types: ['INFJ', 'INFP', 'ENFJ', 'ENFP'] },
      { key: 'SJ', color: '#4298b4', types: ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'] },
      { key: 'SP', color: '#d7a12f', types: ['ISTP', 'ISFP', 'ESTP', 'ESFP'] },
    ],
  },

  blank: {
    id: 'blank',
    name: 'Blank (Custom)',
    title: "Character's Flag",
    axis: {
      x: { left: 'Left', right: 'Right' },
      y: { top: 'Top', bottom: 'Bottom' },
    },
    quadrants: {
      topRight: { label: '', color: '#38bdf8' },
      bottomRight: { label: '', color: '#f472b6' },
      bottomLeft: { label: '', color: '#a78bfa' },
      topLeft: { label: '', color: '#facc15' },
    },
  },
};

// clone แบบ deep เพื่อไม่ให้แก้ template ต้นฉบับ
export function cloneTemplate(id) {
  const t = TEMPLATES[id] || TEMPLATES.flag;
  return JSON.parse(JSON.stringify(t));
}

export const QUADRANT_KEYS = ['topRight', 'bottomRight', 'bottomLeft', 'topLeft'];

// template ใช้เลย์เอาต์ตาราง (การ์ด 16 type) หรือแบบ quadrant เดิม
export function isGridTemplate(tpl) {
  return !!tpl && tpl.kind === 'grid';
}
