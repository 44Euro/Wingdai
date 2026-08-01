/**
 * กติกาตรวจใบสมัครไรเดอร์ ฝั่งแอป (design R5)
 *
 * **เซิร์ฟเวอร์เป็นผู้ตัดสิน** — สำเนานี้มีไว้ให้ฟอร์มบอกผู้ใช้ได้ทันทีว่าพิมพ์ผิดตรงไหน
 * โดยไม่ต้องรอ round trip ไม่ใช่เพื่อแทนการตรวจฝั่งเซิร์ฟเวอร์
 * ตัวจริงอยู่ที่ services/core-api/src/dispatch/riderApplication.ts — แก้ที่ไหนต้องแก้ทั้งคู่
 */

export const MIN_AGE_YEARS = 18;

/**
 * เลขบัตรประชาชนไทย 13 หลัก ตรวจด้วย checksum จริง
 * ผลรวมของ หลักที่ i × (13 − i) สำหรับ i = 0..11 แล้ว (11 − ผลรวม mod 11) mod 10 = หลักที่ 13
 */
export function isValidThaiNationalId(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 13) return false;
  if (/^(\d)\1{12}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

export function ageOn(dateOfBirth: string, at: Date): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return Number.NaN;

  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dob.getUTCMonth() ||
    (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function isExpired(date: string, at: Date): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return true;
  const today = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  return d < today;
}

/** วันที่ต้องเป็น YYYY-MM-DD และมีอยู่จริงบนปฏิทิน */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type RiderApplicationDraft = {
  nationalId: string;
  dateOfBirth: string;
  vehicleRegistration: string;
  licenceExpiry: string;
  compulsoryInsuranceExpiry: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  acceptContract: boolean;
  acceptPdpa: boolean;
};

/** คืน map ช่อง → i18n key ที่ผิด · ว่าง = ส่งได้ */
export function validateDraft(draft: RiderApplicationDraft, at: Date): Record<string, string> {
  const e: Record<string, string> = {};

  if (!isValidThaiNationalId(draft.nationalId)) e.nationalId = 'rider.apply.error.nationalId';

  if (!isIsoDate(draft.dateOfBirth)) e.dateOfBirth = 'rider.apply.error.date';
  else if (ageOn(draft.dateOfBirth, at) < MIN_AGE_YEARS) e.dateOfBirth = 'rider.apply.error.age';

  if (!isIsoDate(draft.licenceExpiry)) e.licenceExpiry = 'rider.apply.error.date';
  else if (isExpired(draft.licenceExpiry, at)) e.licenceExpiry = 'rider.apply.error.licenceExpired';

  if (!isIsoDate(draft.compulsoryInsuranceExpiry)) e.compulsoryInsuranceExpiry = 'rider.apply.error.date';
  else if (isExpired(draft.compulsoryInsuranceExpiry, at)) {
    e.compulsoryInsuranceExpiry = 'rider.apply.error.insuranceExpired';
  }

  if (draft.vehicleRegistration.trim() === '') e.vehicleRegistration = 'rider.apply.error.required';
  if (draft.bankName.trim() === '') e.bankName = 'rider.apply.error.required';
  if (draft.bankAccountNumber.replace(/\D/g, '').length < 8) {
    e.bankAccountNumber = 'rider.apply.error.bankNumber';
  }
  if (draft.bankAccountName.trim() === '') e.bankAccountName = 'rider.apply.error.required';
  if (draft.emergencyContactName.trim() === '') e.emergencyContactName = 'rider.apply.error.required';
  if (!/^0[689][0-9]{8}$/.test(draft.emergencyContactPhone.replace(/\D/g, ''))) {
    e.emergencyContactPhone = 'rider.apply.error.phone';
  }

  // §7 ต้องมีทั้งคู่ก่อนอนุมัติ — ไม่ติ๊กก็ส่งไม่ได้
  if (!draft.acceptContract) e.acceptContract = 'rider.apply.error.required';
  if (!draft.acceptPdpa) e.acceptPdpa = 'rider.apply.error.required';

  return e;
}
