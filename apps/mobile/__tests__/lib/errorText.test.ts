import { errorText } from '../../src/lib/errorText';

const t = ((key: string) => (key === 'common.errorGeneric' ? 'Something went wrong' : key)) as any;

/**
 * API เขียนข้อความ error เป็นไทยตายตัวทุกเส้นทาง (ยังไม่ได้คืนเป็นรหัส)
 * 26 จอเอามาโชว์ตรง ๆ ตั้งแอปเป็นอังกฤษแล้วจึงมีไทยโผล่กลางจอทีละประโยค
 */
describe('ข้อความ error ที่เอาไปโชว์', () => {
  it('ภาษาไทย — ใช้ข้อความจากเซิร์ฟเวอร์ตามเดิม เพราะมันบอกเหตุผลได้ตรงกว่าคำกลาง ๆ', () => {
    expect(errorText(new Error('เบอร์นี้มีคนใช้แล้ว'), t, 'th')).toBe('เบอร์นี้มีคนใช้แล้ว');
  });

  it('ภาษาอังกฤษ + ข้อความเป็นไทย — ตกไปใช้คำกลางที่แปลแล้ว', () => {
    expect(errorText(new Error('เบอร์นี้มีคนใช้แล้ว'), t, 'en')).toBe('Something went wrong');
  });

  it('ภาษาอังกฤษ + ข้อความเป็นอังกฤษอยู่แล้ว — โชว์ได้เลย', () => {
    expect(errorText(new Error('Network request failed'), t, 'en')).toBe('Network request failed');
  });

  it('ไม่ใช่ Error หรือไม่มีข้อความ — ใช้คำกลาง ไม่โชว์ undefined', () => {
    expect(errorText(null, t, 'th')).toBe('Something went wrong');
    expect(errorText(new Error('   '), t, 'en')).toBe('Something went wrong');
    expect(errorText('พัง', t, 'en')).toBe('Something went wrong');
  });
});
