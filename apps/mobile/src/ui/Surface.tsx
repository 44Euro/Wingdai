import React, { useState } from 'react';
import { View, Pressable, Image, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

/** พื้นผิวพื้นฐานของ Wingdai design system (rounded-soft) */

/** การ์ดมุมมน tone teal คือการ์ดเด่นสีเข้ม (announcement / ยอดเงิน / ใบเสร็จ) */
export function Card({
  children,
  tone = 'raised',
  padded = true,
  style,
  testID,
}: {
  children: React.ReactNode;
  tone?: 'raised' | 'teal';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { tokens, primitives: p, scheme } = useTheme();
  // เงาเป็นสีดำจาง บนพื้นมืดจึงมองไม่เห็นเลย โหมดมืดใช้เส้นขอบแทนเพื่อให้การ์ดมีขอบให้ตาจับ
  const outlined = scheme === 'dark';
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: tone === 'teal' ? tokens.tealSolid : tokens.bgRaised,
          borderRadius: p.radius.xl,
          padding: padded ? p.space.card : 0,
          borderWidth: outlined ? 1 : 0,
          borderColor: tokens.borderSubtle,
        },
        tone === 'teal' ? p.shadow.teal : p.shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** สี่เหลี่ยมมนสีอ่อนที่มีไอคอนอยู่ตรงกลาง ใช้นำแถวรายการทุกหน้า */
export function IconChip({
  name,
  tone = 'brand',
  size = 40,
  style,
}: {
  name: IconName;
  tone?: 'brand' | 'teal' | 'neutral';
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens, primitives: p } = useTheme();
  const bg =
    tone === 'brand' ? tokens.brandTint : tone === 'teal' ? tokens.tealTint : tokens.bgSunken;
  const fg =
    tone === 'brand'
      ? tokens.textOnBrandTint
      : tone === 'teal'
        ? tokens.textOnTealTint
        : tokens.textMuted;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: p.radius.sm,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon name={name} color={fg} size={Math.round(size * 0.48)} />
    </View>
  );
}

/** ปุ่มไอคอนทรงสี่เหลี่ยมมน 40px ปุ่มย้อนกลับ/ปิด/ถูกใจ ตาม back header ของ design */
export function RoundButton({
  icon,
  onPress,
  tone = 'surface',
  testID,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  tone?: 'surface' | 'brand' | 'onDark';
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { tokens, primitives: p } = useTheme();
  const bg =
    tone === 'brand'
      ? tokens.brandAccent
      : tone === 'onDark'
        ? 'rgba(255,255,255,0.14)'
        : tokens.bgRaised;
  const fg = tone === 'surface' ? tokens.textPrimary : tokens.textOnBrand;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: p.radius.sm,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        },
        tone === 'surface' ? p.shadow.card : null,
      ]}
    >
      <Icon name={icon} color={fg} size={20} strokeWidth={2.4} />
    </Pressable>
  );
}

/** พิลกรอง/หมวดหมู่ ตัวที่เลือกใช้พื้นแบรนด์ทึบ */
export function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: p.space.lg,
          paddingVertical: p.space.sm,
          borderRadius: p.radius.full,
          // พื้นพิลมีตัวหนังสือทับ จึงต้องใช้ brandSolid ไม่ใช่ brandAccent
          backgroundColor: active ? tokens.brandSolid : tokens.bgRaised,
          opacity: pressed ? 0.85 : 1,
        },
        !active ? p.shadow.card : null,
      ]}
    >
      <Text variant="small" color={active ? 'onBrand' : 'primary'} bold>
        {label}
      </Text>
    </Pressable>
  );
}

/** แบดจ์สถานะทรงพิล (design: On the way / Delivered / Cooking) */
export function Badge({
  label,
  tone = 'brand',
}: {
  label: string;
  /** `danger` ใช้กับสถานะที่ผู้ใช้ต้องลงมือแก้ เช่นเอกสารที่ไม่ผ่าน (R8) */
  tone?: 'brand' | 'teal' | 'neutral' | 'danger';
}) {
  const { tokens, primitives: p } = useTheme();
  const bg =
    tone === 'brand' ? tokens.brandTint : tone === 'teal' ? tokens.tealTint : tokens.bgSunken;
  const fg = tone === 'brand'
    ? 'onBrandTint'
    : tone === 'teal' ? 'onTealTint' : tone === 'danger' ? 'danger' : 'muted';
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: p.space.md,
        paddingVertical: 5,
        borderRadius: p.radius.full,
      }}
    >
      <Text variant="kicker" color={fg}>
        {label}
      </Text>
    </View>
  );
}

/** สวิตช์เปิด/ปิดทรงพิล 46×27 ตาม design */
export function Toggle({
  value,
  onValueChange,
  testID,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={{
        width: 46,
        height: 27,
        borderRadius: 999,
        padding: 3,
        backgroundColor: value ? tokens.brandSolid : tokens.borderSubtle,
        alignItems: value ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{ width: 21, height: 21, borderRadius: 999, backgroundColor: tokens.bgRaised }} />
    </Pressable>
  );
}

/** ช่องติ๊กสี่เหลี่ยมมน 22×22 + ป้ายกำกับ ตาม design (A3 ยอมรับข้อกำหนด) */
export function Checkbox({
  checked,
  onChange,
  label,
  testID,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  testID?: string;
}) {
  const { tokens, primitives: p } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm, minHeight: 44 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? tokens.brandAccent : tokens.bgRaised,
          borderWidth: checked ? 0 : 1.6,
          borderColor: tokens.borderSubtle,
        }}
      >
        {checked ? <Icon name="check" color={tokens.textOnBrand} size={14} strokeWidth={3.2} /> : null}
      </View>
      <Text variant="caption" color="muted" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** บล็อกแทนรูปอาหาร design ใช้ไล่เฉดเทาเป็น placeholder */
export function PhotoBlock({
  icon = 'rice',
  size,
  height,
  radius,
  style,
  uri,
}: {
  icon?: IconName;
  size?: number;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** รูปจริงจากเซิร์ฟเวอร์ ไม่มีหรือโหลดไม่ขึ้นก็เหลือกล่องไล่สีข้างล่าง */
  uri?: string | null;
}) {
  const { primitives: p } = useTheme();
  const [broken, setBroken] = useState(false);
  const h = height ?? size ?? 64;
  // กล่องไล่สีอยู่ข้างล่างเสมอ มันเป็นทั้งจอตอนรูปยังไม่มา และตัวสำรองตอนรูปพัง
  const showPhoto = Boolean(uri) && !broken;

  return (
    <LinearGradient
      colors={['#D6D3D0', '#A5A19E']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: h,
          borderRadius: radius ?? p.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Icon name={icon} color="rgba(255,255,255,0.78)" size={Math.min(32, h * 0.4)} strokeWidth={1.4} />
      {showPhoto ? (
        <Image
          source={{ uri: uri as string }}
          onError={() => setBroken(true)}
          resizeMode="cover"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
      ) : null}
    </LinearGradient>
  );
}
