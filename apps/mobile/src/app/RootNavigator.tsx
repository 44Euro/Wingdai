import React from 'react';
import { useAuthStore } from '../features/auth/authStore';
import { LoginScreen, PendingApprovalScreen } from './navigators/AuthStack';
import { PlaceholderStack } from './navigators/PlaceholderStack';

/**
 * เลือก stack จาก capability ไม่ใช่จาก accountType ตรง ๆ ตาม claude.md §4
 * การเพิ่ม capability ใหม่ในอนาคตจึงไม่ต้องรื้อโครงนี้
 */
export function RootNavigator() {
  const account = useAuthStore((s) => s.account);
  const capabilities = useAuthStore((s) => s.capabilities);
  const active = useAuthStore((s) => s.activeCapability);

  if (!account) return <LoginScreen />;

  // ไรเดอร์ที่ยังไม่อนุมัติ: ไม่มี capability ใดเลย เข้าได้แค่หน้ารออนุมัติ
  if (capabilities.length === 0) return <PendingApprovalScreen />;

  switch (active) {
    case 'admin':
      return <PlaceholderStack name="Admin" testID="stack-admin" />;
    case 'rider':
      return <PlaceholderStack name="Rider" testID="stack-rider" />;
    case 'merchant':
      return <PlaceholderStack name="Merchant" testID="stack-merchant" />;
    case 'customer':
      return <PlaceholderStack name="Customer" testID="stack-customer" />;
    default:
      return <PendingApprovalScreen />;
  }
}
