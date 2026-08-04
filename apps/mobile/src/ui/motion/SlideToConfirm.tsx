import React, { useRef, useState } from 'react';
import { Animated, PanResponder, View, LayoutChangeEvent, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { maxTravel, clampDrag, shouldCommit } from './slideRule';

const KNOB = 52;
const INSET = 4;

/** เลื่อนเพื่อยืนยัน (design R3) */
export function SlideToConfirm({
  label,
  confirmedLabel,
  disabled = false,
  onConfirm,
  testID,
}: {
  label: string;
  confirmedLabel: string;
  disabled?: boolean;
  onConfirm: () => void;
  testID?: string;
}) {
  const { tokens, primitives: p } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const x = useRef(new Animated.Value(0)).current;
  const current = useRef(0);
  const maxX = maxTravel(trackWidth, KNOB, INSET);

  /** ค่าล่าสุดต้องอ่านได้ตอนปล่อยนิ้ว Animated.Value อ่านตรง ๆ ไม่ได้ */
  const listener = useRef<string | null>(null);
  if (listener.current === null) {
    listener.current = x.addListener(({ value }) => {
      current.current = value;
    });
  }

  function settle(commit: boolean) {
    Animated.spring(x, {
      toValue: commit ? maxX : 0,
      useNativeDriver: false,
      bounciness: 0,
      speed: 20,
    }).start();
    if (commit) {
      setConfirmed(true);
      onConfirm();
    }
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !confirmed,
      onMoveShouldSetPanResponder: () => !disabled && !confirmed,
      onPanResponderMove: (_e, g) => {
        x.setValue(clampDrag(g.dx, maxX));
      },
      onPanResponderRelease: () => settle(shouldCommit(current.current, maxX)),
      onPanResponderTerminate: () => settle(false),
    }),
  ).current;

  const dim = disabled || confirmed;

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{
        height: 60,
        borderRadius: p.radius.full,
        backgroundColor: dim ? tokens.bgRaised : tokens.tealSolid,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Pressable
        testID={testID ? `${testID}-press` : undefined}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled || confirmed}
        onPress={() => settle(true)}
        style={{ ...StyleSheetAbsoluteFill, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text variant="body" bold color={dim ? 'muted' : 'onTeal'}>
          {confirmed ? confirmedLabel : label}
        </Text>
      </Pressable>

      <Animated.View
        {...pan.panHandlers}
        style={{
          position: 'absolute',
          left: INSET,
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          backgroundColor: disabled ? tokens.borderSubtle : tokens.brandAccent,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: x }],
        }}
      >
        <Icon name="chevronRight" color="#FFFFFF" size={22} strokeWidth={2.6} />
      </Animated.View>
    </View>
  );
}

/** เขียนแยกไว้เพราะ StyleSheet.absoluteFillObject อ่านยากเมื่อฝังกลางสไตล์อื่น */
const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
