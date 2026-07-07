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
    name: 'ธงตัวละคร (Flag)',
    title: "Character's Flag",
    axis: {
      x: { left: 'อันตราย', right: 'ปลอดภัย' },
      y: { top: 'เท่/นิ่ง', bottom: 'อบอุ่น/นัว' },
    },
    quadrants: {
      topRight: { label: 'ธงเขียว', color: '#22c55e' },
      bottomRight: { label: 'ธงเหลือง', color: '#eab308' },
      bottomLeft: { label: 'ธงแดง', color: '#ef4444' },
      topLeft: { label: 'ธงดำ', color: '#4b5563' },
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
      topRight: { label: 'ET · ผู้นำ/นักคิดเปิดเผย', color: '#3b82f6' },
      bottomRight: { label: 'EF · นักการทูต/ขี้เล่น', color: '#eab308' },
      bottomLeft: { label: 'IF · อ่อนโยน/เก็บตัว', color: '#22c55e' },
      topLeft: { label: 'IT · นักวิเคราะห์เงียบ', color: '#8b5cf6' },
    },
  },

  blank: {
    id: 'blank',
    name: 'ว่าง (Custom)',
    title: "Character's Flag",
    axis: {
      x: { left: 'ซ้าย', right: 'ขวา' },
      y: { top: 'บน', bottom: 'ล่าง' },
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
