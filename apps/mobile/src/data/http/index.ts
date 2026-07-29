import type { Repos } from '../repositories';

export class NotImplementedError extends Error {
  constructor(method: string) {
    super(`${method} ยังไม่ได้ต่อ backend จริง — ตอนนี้ใช้ mock อยู่`);
    this.name = 'NotImplementedError';
  }
}

const nope = (method: string) => async (): Promise<never> => {
  throw new NotImplementedError(method);
};

/**
 * Stub ที่ implement interface ครบทุก method เพื่อให้ type ตรงกับ MockRepo
 * ไม่ใช่ไฟล์ว่าง — ความครบของ type คือสิ่งที่พิสูจน์ว่าสลับ implementation ได้จริง
 */
export function createHttpRepos(_baseUrl: string): Repos {
  return {
    auth: {
      login: nope('auth.login'),
      register: nope('auth.register'),
      verifyOtp: nope('auth.verifyOtp'),
      logout: nope('auth.logout'),
    },
    catalog: {
      listRestaurants: nope('catalog.listRestaurants'),
      getRestaurant: nope('catalog.getRestaurant'),
      getMenu: nope('catalog.getMenu'),
      createMenuItem: nope('catalog.createMenuItem'),
      searchRestaurants: nope('catalog.searchRestaurants'),
    },
    orders: {
      create: nope('orders.create'),
      get: nope('orders.get'),
      listForCustomer: nope('orders.listForCustomer'),
      updateStatus: nope('orders.updateStatus'),
      payWithPromptPay: nope('orders.payWithPromptPay'),
    },
  };
}
