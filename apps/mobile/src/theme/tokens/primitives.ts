/** ค่าดิบของ Wingdai design system (rounded-soft) อ้างอิงตาราง token ใน design handoff */
export const primitives = {
  brand: {
    /** orange tint พื้นชิปไอคอน/แบดจ์ (design: #FCE9DF) */
    50: '#FCE9DF',
    /** teal accent kicker/label บนพื้น teal เข้ม (design: #F6A57E) */
    300: '#F6A57E',
    400: '#F6844F',
    /** ส้มแบรนด์จริงของ design (#F15A22) กราฟิกเท่านั้น */
    500: '#F15A22',
    600: '#DE4B10',
    /** ส้มเข้มสีเดียวกัน (hue 16°) พื้นปุ่มที่มีตัวหนังสือ + ลิงก์ ขาวทับ 4.80:1 ผ่าน AA */
    700: '#CC4310',
    /** design: "orange pressed" ตัวอักษรบนพื้น brand tint (5.10:1) */
    800: '#B23A0C',
    900: '#8A2C07',
  },

  teal: {
    /** teal tint พื้นชิปไอคอนรอง (design: #E4EBEA) */
    100: '#E4EBEA',
    /** brand teal จอมืด/การ์ดเด่น (design: #0E3B3A) */
    500: '#0E3B3A',
    /** พื้นหลังโหมดมืด เข้มกว่า teal500 หนึ่งขั้นเพื่อให้การ์ดลอยขึ้นมาได้ */
    700: '#12403F',
    900: '#0A2C2B',
  },

  /**
   * เฉดโหมดมืด เทากลาง ไม่อมเขียว
   * design C32 ใช้เทาอมเขียว (#0F1A19 / #1C2A28) ซึ่งบนจอเต็มอ่านแล้วขุ่น
   * เพราะจอในแอปไม่มีรูปอาหารมาคั่นเหมือนในภาพ handoff สีเขียวจึงคุมทั้งจอ
   * teal เก็บไว้ที่ `card` อย่างเดียว ให้เป็นสีของแบรนด์ ไม่ใช่สีของพื้น
   */
  night: {
    /** แถบนำทาง เข้มกว่าพื้นแอป ให้แถบจมลงไปเป็นฐาน */
    nav: '#0A0B0C',
    /** พื้นแอป */
    bg: '#141517',
    /** ร่องใน (แถบ stepper บนการ์ด) ต้องจมกว่าพื้นแอป */
    sunken: '#0E0F11',
    /** การ์ด/ชิป/ช่องกรอก ห่างจากพื้นแอป ΔL* 8.4 */
    raised: '#24262A',
    /** การ์ดเด่นสี teal (การ์ดประกาศ) */
    card: '#123B37',
    text: '#F4F1EC',
    textMuted: '#C9CBCB',
    /** ต้องผ่าน AA บนทั้งพื้นแอปและการ์ด ค่าที่จางกว่านี้ตกที่การ์ด */
    textFaint: '#9BA0A0',
  },

  /** warm off-white ground (design: #F6F1EA) */
  cream: '#F6F1EA',
  white: '#FFFFFF',

  /** ink scale ของ design 100 = ink, 70 = body, 50 = muted, 30 = faint */
  ink: {
    100: '#1B1917',
    70: '#4A4642',
    /** faint ของ design (#8A847D) มืดขึ้นเล็กน้อยให้ผ่าน AA บนพื้นครีม (5.12:1) */
    50: '#6B6560',
    30: '#B0AAA3',
  },

  neutral: {
    100: '#EAE5DE',
    300: '#B0AAA3',
    500: '#6B6560',
    700: '#4A4642',
  },

  danger: '#B42318',
  success: '#166534',

  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, screen: 20, card: 16 },

  /** design: การ์ด 20–24 ชิปไอคอน 12–16 ปุ่ม/พิล 16–18 */
  radius: { sm: 12, md: 16, lg: 20, xl: 24, pill: 18, full: 9999 },

  fontFamily: {
    /** design ใช้ weight 800 กับหัวข้อ Prompt_700Bold คือค่าที่หนักสุดที่รองรับไทยครบ */
    heading: 'Prompt_700Bold',
    headingSemi: 'Prompt_600SemiBold',
    body: 'IBMPlexSansThai_400Regular',
    bodyBold: 'IBMPlexSansThai_600SemiBold',
  },

  /** lineHeight ทุกค่าต้อง >= fontSize * 1.7 เพราะสระไทยชนกันถ้าต่ำกว่านี้ */
  fontSize: { kicker: 11, caption: 13, small: 14, body: 16, bodyLg: 18, h3: 20, h2: 24, h1: 28, display: 32 },
  lineHeight: { kicker: 19, caption: 23, small: 24, body: 28, bodyLg: 31, h3: 34, h2: 41, h1: 48, display: 55 },

  /** เงานุ่มของ design ios ใช้ shadow*, android ใช้ elevation */
  shadow: {
    /** การ์ดทั่วไป: 0 8px 22px rgba(27,25,23,.07) */
    card: {
      shadowColor: '#1B1917',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.07,
      shadowRadius: 22,
      elevation: 3,
    },
    /** การ์ดเด่น: 0 10px 26px rgba(27,25,23,.09) */
    raised: {
      shadowColor: '#1B1917',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.09,
      shadowRadius: 26,
      elevation: 5,
    },
    /** ปุ่มหลัก: 0 14px 28px rgba(241,90,34,.32) */
    brand: {
      shadowColor: '#F15A22',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.32,
      shadowRadius: 28,
      elevation: 8,
    },
    /** พื้นผิว teal ลอย (nav pill, การ์ด teal): 0 14px 32px rgba(14,59,58,.3) */
    /** แถบนำทางลอยในโหมดมืด teal จมกับพื้นดำ ต้องใช้เงาดำที่เข้มกว่า */
    navDark: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.5,
      shadowRadius: 28,
      elevation: 12,
    },
    teal: {
      shadowColor: '#0E3B3A',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.3,
      shadowRadius: 32,
      elevation: 8,
    },
  },
} as const;

export type Primitives = typeof primitives;
