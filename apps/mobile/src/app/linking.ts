import type { LinkingOptions } from '@react-navigation/native';

/** ลิงก์ที่เปิดแอปเข้าจอที่ถูกต้อง (product-spec §11 ข้อ 1 ทางดึงลูกค้าตอนที่มีแต่แอป) */
export const APP_SCHEME = 'wingdai';
export const WEB_ORIGIN = 'https://wingdai.app';

/** ลิงก์เปิดหน้าร้าน ใช้เป็นเนื้อหาของ QR ที่ร้านเอาไปพิมพ์ */
export function restaurantLink(restaurantId: string): string {
  return `${WEB_ORIGIN}/restaurant/${restaurantId}`;
}

export const linking: LinkingOptions<Record<string, unknown>> = {
  prefixes: [`${APP_SCHEME}://`, WEB_ORIGIN],
  config: {
    screens: {
      /** แม็ปเฉพาะจอที่ลิงก์ภายนอกควรเข้าถึงได้ */
      RestaurantDetail: 'restaurant/:restaurantId',
      OrderTracking: 'order/:orderId',
    },
  },
};
