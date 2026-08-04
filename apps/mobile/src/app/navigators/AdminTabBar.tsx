import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { IconName } from '../../ui/Icon';
import { PillTabBar, PILL_TAB_CLEARANCE } from './PillTabBar';

const ICONS: Record<string, IconName> = {
  AdminHome: 'home',
  AdminOrders: 'inbox',
  AdminMoney: 'card',
  AdminApprove: 'check',
  /** AD4 ยังไม่มีแท็บนี้จนกว่าระบบตั๋วจะมีจริง (เฟส 2c) */
  AdminSupport: 'help',
};

/** ความสูงที่จอในแท็บต้องเว้นไว้ล่างสุด ไม่งั้นบรรทัดท้ายโดนแถบบัง */
export const ADMIN_TAB_CLEARANCE = PILL_TAB_CLEARANCE;

/** แถบนำทางของแอดมิน สี่แท็บ (ห้าคือเพดาน) */
export function AdminTabBar(props: BottomTabBarProps) {
  return <PillTabBar {...props} prefix="admin" icons={ICONS} />;
}
