import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/** วงแหวนเต้น แปลงจาก design */
export function PulseRing({
  size = 12,
  color,
  children,
}: {
  size?: number;
  color: string;
  children?: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                // วงแหวน 16px รอบจุดขนาด size → ปลายทางคือ (size + 32) / size เท่า
                outputRange: [1, (size + 32) / size],
              }),
            },
          ],
          opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 0, 0] }),
        }}
      />
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      />
      {children}
    </View>
  );
}
