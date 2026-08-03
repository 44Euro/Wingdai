import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/** จุดกระพริบ design `@keyframes wd-blink{0%,55%{opacity:1}57%,100%{opacity:.22}}` */
export function BlinkDot({ color, size = 8 }: { color: string; size?: number }) {
  const v = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.22,
          duration: 550,
          easing: Easing.step0,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 1,
          duration: 450,
          easing: Easing.step0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: v,
      }}
    />
  );
}
