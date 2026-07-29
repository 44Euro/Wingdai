import type { CuisineCategory } from '../../data/types';
import type { IconName } from '../../ui/Icon';

/** ไอคอนประจำหมวดอาหาร ใช้ร่วมกันทุกจอที่วาดรูปแทนอาหาร (หน้าแรก ค้นหา หมวดหมู่) */
export const CUISINE_ICON: Record<CuisineCategory, IconName> = {
  rice: 'rice',
  noodle: 'noodle',
  somtam: 'somtam',
  drink: 'drink',
  dessert: 'dessert',
};
