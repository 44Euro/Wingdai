/** กติกาตรวจใบสมัครไรเดอร์ (design R5 product-spec §7) */

/** อายุขั้นต่ำ ใบขับขี่รถจักรยานยนต์ของไทยและการจ้างงานทั่วไปเริ่มที่ 18 */
export const MIN_AGE_YEARS = 18;

/** ตรวจเลขบัตรประชาชนไทย 13 หลักด้วย checksum จริง */
export function isValidThaiNationalId(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 13) return false;
  // เลขซ้ำทั้ง 13 หลัก (1111111111111) ผ่าน checksum ได้บางตัว แต่ไม่ใช่เลขจริง
  if (/^(\d)\1{12}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

/** อายุเต็มปี ณ วันที่อ้างอิง */
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

/** วันหมดอายุที่ผ่านมาแล้ว = ใช้ไม่ได้ (เทียบแบบวันต่อวัน ไม่เอาเวลามาเกี่ยว) */
export function isExpired(date: string, at: Date): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return true;
  const today = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  return d < today;
}

export type RiderApplicationFields = {
  nationalId: string;
  dateOfBirth: string;
  licenceExpiry: string;
  compulsoryInsuranceExpiry: string;
  bankAccountName: string;
};

/** คืน map ของ ช่อง → ข้อความ ที่ผิด ว่าง = ผ่าน */
export function validateRiderApplication(
  input: RiderApplicationFields,
  at: Date,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isValidThaiNationalId(input.nationalId)) {
    errors.nationalId = 'เลขบัตรประชาชนไม่ถูกต้อง';
  }

  const age = ageOn(input.dateOfBirth, at);
  if (Number.isNaN(age)) errors.dateOfBirth = 'วันเกิดไม่ถูกต้อง';
  else if (age < MIN_AGE_YEARS) errors.dateOfBirth = `ต้องอายุ ${MIN_AGE_YEARS} ปีขึ้นไป`;

  /** เอกสารหมดอายุถูกปฏิเสธตั้งแต่ตอนส่ง ไม่ใช่ปล่อยผ่านแล้วให้ eligibility.ts */
  if (isExpired(input.licenceExpiry, at)) errors.licenceExpiry = 'ใบขับขี่หมดอายุแล้ว';
  if (isExpired(input.compulsoryInsuranceExpiry, at)) {
    errors.compulsoryInsuranceExpiry = 'พ.ร.บ. หมดอายุแล้ว';
  }

  if (input.bankAccountName.trim() === '') {
    errors.bankAccountName = 'กรุณากรอกชื่อบัญชี';
  }

  return errors;
}

/** ชื่อบัญชีธนาคารตรงกับชื่อตามกฎหมายไหม ด่านกันบัญชีม้าตาม product-spec §7 */
export function bankNameMatchesLegalName(bankAccountName: string, fullName: string): boolean {
  const strip = (s: string) =>
    s.replace(/(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?)/gi, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  return strip(bankAccountName) === strip(fullName);
}
