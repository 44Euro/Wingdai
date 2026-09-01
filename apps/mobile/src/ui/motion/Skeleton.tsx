import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * โครงของสิ่งที่กำลังโหลด แทนคำว่า "กำลังโหลด" ลอย ๆ
 * ต้องกินพื้นที่เท่าของจริง ไม่งั้นจอกระโดดตอนข้อมูลมาถึง
 */
export function Skeleton({
  width,
  height = 14,
  radius,
  style,
  testID,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { tokens, primitives: p } = useTheme();
  const v = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? p.radius.sm,
          backgroundColor: tokens.bgSunken,
          opacity: v,
        },
        style,
      ]}
    />
  );
}

/**
 * โครงการ์ดหลายใบ หน้าตาเหมือนรายการจริง รูป + สองบรรทัด
 * จอไหนโหลดเป็นรายการการ์ดใช้ตัวนี้ได้เลย ไม่ต้องวางโครงเองทีละจอ
 */
export function SkeletonCards({
  count = 3,
  photoHeight = 104,
  testID = 'skeleton',
}: {
  count?: number;
  photoHeight?: number;
  testID?: string;
}) {
  const { tokens, primitives: p } = useTheme();

  return (
    <View style={{ gap: p.space.md }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          testID={`${testID}-${i}`}
          style={{
            borderRadius: p.radius.lg,
            overflow: 'hidden',
            backgroundColor: tokens.bgRaised,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
          }}
        >
          <Skeleton height={photoHeight} radius={0} />
          <View style={{ padding: p.space.md, gap: p.space.sm }}>
            <Skeleton width="62%" height={14} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}
