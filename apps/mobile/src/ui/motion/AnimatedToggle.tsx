import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable } from 'react-native';

const W = 52;
const H = 30;
const KNOB = 24;
const PAD = 3;

/** สวิตช์ไหล design `transition: 'background .28s, transform .28s'` สีเปิดคือ #F15A22 */
export function AnimatedToggle({
  value,
  onValueChange,
  onColor,
  offColor,
  knobColor,
  disabled,
  testID,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  onColor: string;
  offColor: string;
  knobColor: string;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const v = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: value ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [value, v]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
    >
      <Animated.View
        style={{
          width: W,
          height: H,
          borderRadius: H / 2,
          padding: PAD,
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          backgroundColor: v.interpolate({
            inputRange: [0, 1],
            outputRange: [offColor, onColor],
          }),
        }}
      >
        <Animated.View
          style={{
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            backgroundColor: knobColor,
            transform: [
              {
                translateX: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, W - KNOB - PAD * 2],
                }),
              },
            ],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
