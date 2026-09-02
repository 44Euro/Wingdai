import React, { useMemo, useRef, useState } from 'react';
import { View, ScrollView, TextInput, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { SlideToConfirm } from '../../../ui/motion';
import { pickImage } from '../../../lib/media/pickImage';
import { useRiderStatus, useAdvanceJob, useUploadDeliveryPhoto } from '../hooks';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderProof'>;

const PIN_LENGTH = 4;

/** R11 ยืนยันส่ง */
export function RiderProofScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: status } = useRiderStatus(false);
  const advance = useAdvanceJob();

  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  /** รูปที่เลือกไว้แต่ยังไม่ได้อัป เก็บ uri ไว้โชว์พรีวิว */
  const [photo, setPhoto] = useState<{ uri: string; ext: string } | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);
  const uploadPhoto = useUploadDeliveryPhoto();

  const job = useMemo(
    () => status?.activeJobs.find((j) => j.orderId === orderId),
    [status, orderId],
  );

  const pin = digits.join('');
  /** ลูกค้าขอวางไว้หน้าประตูไว้ตอนสั่ง (สเปคคลื่น 2 §7) ไรเดอร์แก้ค่านี้ไม่ได้ */
  const leaveAtDoor = job?.leaveAtDoor ?? false;
  /** ส่งมือต่อมือ: ต้องครบทั้งรหัสและรูป รหัสพิสูจน์ว่าเจอคน รูปพิสูจน์ว่าของถึงที่ (§6.4) */
  const pinReady = pin.length === PIN_LENGTH && digits.every((d) => d !== '');
  const complete = photo !== null && (leaveAtDoor || pinReady);

  function setDigit(index: number, value: string) {
    // วางรหัสทั้งชุดทีเดียวก็ต้องได้ ไม่ใช่บังคับพิมพ์ทีละช่อง
    const only = value.replace(/\D/g, '');
    if (only.length > 1) {
      const spread = only.slice(0, PIN_LENGTH).split('');
      setDigits((prev) => prev.map((d, i) => spread[i] ?? d));
      inputs.current[Math.min(spread.length, PIN_LENGTH - 1)]?.focus();
      return;
    }
    setDigits((prev) => prev.map((d, i) => (i === index ? only : d)));
    if (only && index < PIN_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  /** อัปรูปให้ขึ้น Storage ก่อน แล้วค่อยปิดงาน */
  function submit() {
    if (!complete || !photo) return;
    uploadPhoto.mutate(
      { orderId, file: photo },
      {
        onSuccess: (photoPath) => {
          advance.mutate(
            {
              orderId,
              status: 'delivered',
              // ใบวางหน้าประตูไม่ส่งรหัสไปเลย เซิร์ฟเวอร์ก็ไม่สนใจอยู่แล้ว
              proof: { ...(leaveAtDoor ? {} : { deliveryPin: pin }), photoPath },
            },
            { onSuccess: () => navigation.popToTop() },
          );
        },
      },
    );
  }

  return (
    <SafeAreaView
      testID="screen-rider-proof"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.proof.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: p.space.xxl,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {job ? (
          <Card>
            <View style={{ gap: 3 }}>
              <Text variant="body" bold>{job.reference}</Text>
              <Text variant="small" color="muted">{job.dropoffAddress}</Text>
            </View>
          </Card>
        ) : null}

        {/* ใบที่ลูกค้าขอวางหน้าประตูไม่มีช่องรหัสเลย ไม่ใช่มีแล้วปล่อยว่างได้ */}
        {leaveAtDoor ? null : (
        <View style={{ gap: p.space.sm }}>
          <Text variant="kicker" color="muted">{t('rider.proof.pinLabel')}</Text>
          <Text variant="small" color="muted">{t('rider.proof.pinHint')}</Text>

          <View style={{ flexDirection: 'row', gap: p.space.md, marginTop: p.space.xs }}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                testID={`pin-${i}`}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={({ nativeEvent }) => {
                  // ลบช่องว่างแล้วต้องถอยไปช่องก่อนหน้า ไม่ใช่ค้างอยู่ที่เดิม
                  if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
                    inputs.current[i - 1]?.focus();
                  }
                }}
                keyboardType="number-pad"
                maxLength={PIN_LENGTH}
                allowFontScaling={false}
                style={{
                  flex: 1,
                  height: 64,
                  textAlign: 'center',
                  fontSize: 26,
                  fontWeight: '700',
                  color: tokens.textPrimary,
                  backgroundColor: tokens.bgRaised,
                  borderRadius: p.radius.lg,
                  borderWidth: 2,
                  borderColor: d ? tokens.brandAccent : 'transparent',
                }}
              />
            ))}
          </View>
        </View>
        )}

        {/* รูปยืนยันส่ง เข้าบักเก็ต ปิด เพราะสิ่งที่อยู่ในรูปคือหน้าบ้านลูกค้า */}
        <View style={{ gap: p.space.sm }}>
          <Text variant="kicker" color="muted">{t('rider.proof.photoLabel')}</Text>
          <Text variant="small" color="muted">{t('rider.proof.photoHint')}</Text>

          <Pressable
            testID="btn-proof-photo"
            accessibilityRole="button"
            accessibilityLabel={t('rider.proof.photoLabel')}
            onPress={() => {
              // ยกเลิกไม่ใช่ข้อผิดพลาด ไม่ได้รูปก็แค่ไม่เปลี่ยนอะไร
              void pickImage().then((file) => {
                if (file) setPhoto(file);
              });
            }}
            style={{
              height: photo ? 180 : 96,
              borderRadius: p.radius.lg,
              backgroundColor: tokens.bgRaised,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {photo ? (
              <Image
                testID="proof-photo-preview"
                source={{ uri: photo.uri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ alignItems: 'center', gap: p.space.xs }}>
                <Icon name="edit" color={tokens.textMuted} size={22} />
                <Text variant="small" color="muted">{t('rider.proof.addPhoto')}</Text>
              </View>
            )}
          </Pressable>

          {photo ? (
            <Text testID="proof-photo-retake" variant="caption" color="faint">
              {t('rider.proof.retake')}
            </Text>
          ) : null}
        </View>

        {/* "วางไว้หน้าประตู" เป็นป้ายอ่านอย่างเดียว ไม่ใช่ช่องติ๊ก (สเปคคลื่น 2 §7) */}
        {leaveAtDoor ? (
          <Card testID="leave-at-door-note">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
              <Icon name="check" color={tokens.textMuted} size={18} strokeWidth={3} />
              <Text variant="body" style={{ flex: 1 }}>{t('rider.proof.leftAtDoor')}</Text>
            </View>
          </Card>
        ) : null}

        {advance.isError || uploadPhoto.isError ? (
          <Text testID="proof-error" variant="small" color="danger">
            {errorText(advance.error ?? uploadPhoto.error, t, i18n.language)}
          </Text>
        ) : null}

        {/* R3 ปิดงานเป็นการกระทำที่ย้อนกลับไม่ได้ ต้องเลื่อน ไม่ใช่แตะ */}
        <SlideToConfirm
          testID="btn-complete-delivery"
          label={t('rider.proof.slideToComplete')}
          confirmedLabel={t('rider.proof.completing')}
          disabled={!complete || advance.isPending || uploadPhoto.isPending}
          onConfirm={submit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
