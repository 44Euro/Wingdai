import { getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';

/** ลิงก์ที่เปิดแอปเข้าจอที่ถูกต้อง (product-spec §11 ข้อ 1 ทางดึงลูกค้าตอนที่มีแต่แอป) */
export const APP_SCHEME = 'wingdai';
export const WEB_ORIGIN = 'https://wingdai.app';

/** ลิงก์เปิดหน้าร้าน ใช้เป็นเนื้อหาของ QR ที่ร้านเอาไปพิมพ์ */
export function restaurantLink(restaurantId: string): string {
  return `${WEB_ORIGIN}/restaurant/${restaurantId}`;
}

/**
 * เส้นทางสาธารณะสองเส้นเท่านั้นที่ตั้งใจให้ลิงก์เข้ามาได้
 * นอกจากนี้ห้ามให้ React Navigation เดาเส้นทางจากชื่อจอเอง เพราะจอส่วนใหญ่อยู่หลังการล็อกอิน
 * และผูกกับบทบาท พอสลับโหมดแล้ว URL ของ stack เก่าจะค้างอยู่ ทำให้แถบแท็บกดไม่ติด
 * และการกดรีเฟรชจะพาไปจอที่ stack ปัจจุบันไม่มี
 */
export const PUBLIC_PATHS = /^\/?(restaurant|order)\/[^/]+\/?$/;

export const linking: LinkingOptions<Record<string, unknown>> = {
  prefixes: [`${APP_SCHEME}://`, WEB_ORIGIN],
  config: {
    screens: {
      RestaurantDetail: 'restaurant/:restaurantId',
      OrderTracking: 'order/:orderId',
    },
  },

  /** เส้นทางที่ไม่ได้ตั้งใจเปิดไว้ ให้ตกกลับไปจอเริ่มต้นของบทบาทนั้น แทนที่จะพยายามกู้ state ที่ไม่มีอยู่ */
  getStateFromPath(path, options) {
    if (!PUBLIC_PATHS.test(path.split('?')[0] ?? '')) return undefined;
    return defaultGetStateFromPath(path, options);
  },

  /**
   * ทุกจอที่ไม่ใช่สองเส้นนั้นไม่เขียนลง URL เลย แถบที่อยู่จึงอยู่ที่ `/` ตลอดการใช้งานปกติ
   * ไม่งั้นเส้นทางอย่าง /Tabs/MerchantOrders จะติดค้างข้ามการสลับบทบาท
   */
  getPathFromState() {
    return '/';
  },
};
