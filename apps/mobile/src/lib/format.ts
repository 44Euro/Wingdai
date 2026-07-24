/** แปลงสตางค์เป็นบาทสำหรับแสดงผล — ลงตัวไม่โชว์ทศนิยม มีเศษโชว์ 2 ตำแหน่ง */
export function formatBaht(satang: number): string {
  const baht = satang / 100;
  const s = Number.isInteger(baht) ? String(baht) : baht.toFixed(2);
  return `฿${s}`;
}
