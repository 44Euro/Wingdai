import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * หัวข้อวันของรายการย้อนหลัง `YYYY-MM-DD` → "วันนี้" / "เมื่อวาน" / "2 ก.ย."
 * เทียบกับวันนี้ตามเวลาไทย ไม่ใช่เขตเวลาเครื่อง ให้ตรงกับที่ groupByDay แบ่งไว้
 */
export function dayLabel(
  key: string,
  today: string,
  yesterday: string,
  labels: { today: string; yesterday: string },
  locale = 'th',
): string {
  if (key === today) return labels.today;
  if (key === yesterday) return labels.yesterday;
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return key;
  const months = locale.startsWith('th') ? THAI_MONTHS : EN_MONTHS;
  const name = months[month - 1] ?? String(month);
  return locale.startsWith('th') ? `${day} ${name}` : `${name} ${day}`;
}

/** แถบคั่นวันพร้อมยอดรวมของวันนั้น ผู้ใช้จะได้ไม่ต้องบวกเอง */
export function DaySection({
  label,
  total,
  testID,
}: {
  label: string;
  total?: string;
  testID?: string;
}) {
  const { tokens, primitives: p } = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: p.space.md,
        paddingTop: p.space.sm,
        borderTopWidth: 1,
        borderTopColor: tokens.borderSubtle,
      }}
    >
      <Text variant="kicker" color="muted">{label}</Text>
      {total ? <Text variant="small" bold>{total}</Text> : null}
    </View>
  );
}
