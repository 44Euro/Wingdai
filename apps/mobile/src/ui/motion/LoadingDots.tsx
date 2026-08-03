import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/** จุดสามจุดไล่กัน design `@keyframes wd-dot` opacity .35→1 รอบละ 1.2s เหลื่อมกัน .2s */
export function LoadingDots({ color, size = 9 }: { color: string; size?: number }) {
  const vs = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    const loops = vs.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, {
            toValue: 1,
            duration: 600,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.35,
            duration: 600,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vs]);

  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {vs.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: v,
          }}
        />
      ))}
    </View>
  );
}
