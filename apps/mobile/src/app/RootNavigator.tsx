import React, { useEffect } from 'react';
import { useAuthStore } from '../features/auth/authStore';
import { usePlatformConfig } from '../features/payment/usePlatformConfig';
import { RiderOnboardingStack } from './navigators/RiderOnboardingStack';
import { AuthNavigator } from './navigators/AuthNavigator';
import { RiderStack } from './navigators/RiderStack';
import { AdminStack } from './navigators/AdminStack';
import { SuperAdminStack } from './navigators/SuperAdminStack';
import { CustomerStack } from './navigators/CustomerStack';
import { MerchantStack } from './navigators/MerchantStack';

/** เลือก stack จาก capability ไม่ใช่จาก accountType ตรง ๆ ตาม product-spec §4 */
export function RootNavigator() {
  const account = useAuthStore((s) => s.account);
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);
  const isRestoring = useAuthStore((s) => s.isRestoring);
  const restore = useAuthStore((s) => s.restore);

  /** เรียกที่นี่ที่เดียว ช่องทางจ่ายเงินที่เปิดอยู่เป็นค่าระดับแอป ไม่ใช่ของจอใดจอหนึ่ง */
  usePlatformConfig();

  useEffect(() => {
    // เช็คเซสชันที่ค้างอยู่ครั้งเดียวตอนเปิดแอป token เก็บไว้ใน Keychain
    void restore();
  }, [restore]);

  /** ยังไม่รู้ว่าล็อกอินอยู่ไหม ยังไม่วาดอะไร */
  if (isRestoring) return null;

  if (!account) return <AuthNavigator />;

  // ไรเดอร์ที่ยังไม่อนุมัติ: ไม่มี capability ใดเลย เข้าได้แค่หน้ารออนุมัติ
  if (capabilities.length === 0) return <RiderOnboardingStack />;

  switch (active) {
    case 'admin':
      return <AdminStack />;
    case 'superAdmin':
      return <SuperAdminStack />;
    case 'rider':
      return <RiderStack />;
    case 'merchant':
      return <MerchantStack />;
    case 'customer':
      return <CustomerStack />;
    default:
      return <RiderOnboardingStack />;
  }
}
