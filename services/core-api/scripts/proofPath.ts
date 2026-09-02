/**
 * ที่วางรูปยืนยันส่ง จุดเดียวในสคริปต์ seed ที่ต้องมี Supabase Storage
 *
 * บน CI ที่รันกับฐานเปล่าไม่มีกุญแจให้ ถอยไปใช้เส้นทางสังเคราะห์แล้วเดินต่อได้
 * เพราะ assertDeliveryProof ตรวจแค่ว่าเส้นทางไม่ว่าง ไม่ได้เช็คว่าไฟล์มีจริง
 * และสคริปต์ก็ไม่เคยอัปไฟล์ขึ้นไปอยู่แล้ว เส้นทางที่เก็บลงฐานจึงชี้ไปที่ไฟล์ที่ไม่มีอยู่ทั้งสองทาง
 *
 * บนโปรดักชันที่ตั้งกุญแจไว้ พฤติกรรมไม่เปลี่ยน ยังขอเส้นทางจริงทุกใบเหมือนเดิม
 */
export type ProofCaller = (
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) => Promise<{ status: number; body: any }>;

export function createProofPath(call: ProofCaller, say: (line: string) => void) {
  let storageOff = false;

  return async function proofPath(orderId: string, riderToken: string): Promise<string> {
    const fallback = `delivery-proof/${orderId}.jpg`;
    if (storageOff) return fallback;

    const res = await call('POST', '/storage/delivery-proof/sign-upload', { orderId, ext: 'jpg' }, riderToken);
    if ([200, 201].includes(res.status)) return res.body.path;

    storageOff = true;
    say(`  ไม่มี Supabase Storage (${res.status}) ใช้เส้นทางสังเคราะห์แทนตั้งแต่ใบนี้ไป`);
    return fallback;
  };
}
