import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { IconName } from '../../ui/Icon';
import { PillTabBar, PILL_TAB_CLEARANCE } from './PillTabBar';

const ICONS: Record<string, IconName> = {
  SuperHome: 'home',
  SuperZones: 'mapPin',
  SuperConfig: 'card',
  SuperAudit: 'history',
};

export const SUPER_TAB_CLEARANCE = PILL_TAB_CLEARANCE;

/** แถบนำทางของซูเปอร์แอดมิน สี่แท็บ (สเปคคลื่น 2 §3.2) */
export function SuperAdminTabBar(props: BottomTabBarProps) {
  return <PillTabBar {...props} prefix="super" icons={ICONS} />;
}
