import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { IconName } from '../../ui/Icon';
import { PillTabBar, PILL_TAB_CLEARANCE } from './PillTabBar';

const ICONS: Record<string, IconName> = {
  MerchantOrders: 'inbox',
  MerchantMenu: 'menu',
  MerchantSummary: 'card',
  MerchantProfile: 'store',
};

/** ความสูงที่จอในแท็บต้องเว้นไว้ล่างสุด ไม่งั้นบรรทัดท้ายโดนแถบบัง */
export const MERCHANT_TAB_CLEARANCE = PILL_TAB_CLEARANCE;

/** แถบนำทางของร้าน สี่แท็บ */
export function MerchantTabBar(props: BottomTabBarProps) {
  return <PillTabBar {...props} prefix="merchant" icons={ICONS} />;
}
