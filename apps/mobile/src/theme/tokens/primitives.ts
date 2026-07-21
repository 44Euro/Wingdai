/**
 * ค่าดิบของแบรนด์ Wingdai — สกัดจาก Logo/logo.png ด้วยการอ่านพิกเซลจริง
 * ไฟล์นี้ห้าม import อะไรจากส่วนอื่นของแอป
 */
export const primitives = {
  brand: {
    400: '#FE7B4A',
    500: '#FE6227', // สีโลโก้ — ใช้กับกราฟิกเท่านั้น ห้ามใส่ตัวหนังสือทับ
    600: '#FB4601',
    700: '#D23A01', // สีปุ่มและข้อความ — ผ่าน AA
    800: '#A92F01',
    900: '#802401',
  },
  teal900: '#023839', // ตัวอักษรในโลโก้ / ข้อความ light / พื้นหลัง dark
  cream: '#FEFBF7',   // พื้นหลัง light / ข้อความ dark
  white: '#FFFFFF',
  neutral: {
    100: '#E8E1DA',
    300: '#B5ABA3',
    500: '#6B615A',
    700: '#3D3630',
  },
  danger: '#B42318',
  success: '#2C5435',

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 8, md: 12, lg: 20, xl: 28, full: 9999 },

  fontFamily: {
    heading: 'Prompt_600SemiBold',
    body: 'IBMPlexSansThai_400Regular',
    bodyBold: 'IBMPlexSansThai_600SemiBold',
  },

  /** lineHeight ทุกค่าต้อง >= fontSize * 1.7 เพราะสระไทยชนกันถ้าต่ำกว่านี้ */
  fontSize: { caption: 13, small: 14, body: 16, bodyLg: 18, h3: 20, h2: 24, h1: 28, display: 32 },
  lineHeight: { caption: 23, small: 24, body: 28, bodyLg: 31, h3: 34, h2: 41, h1: 48, display: 55 },
} as const;

export type Primitives = typeof primitives;
