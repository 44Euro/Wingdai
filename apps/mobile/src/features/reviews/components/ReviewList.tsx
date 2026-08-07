import React from 'react';
import { View, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';
import { relativeTime } from '../../../lib/format';
import { Stars } from './Stars';
import type { Review, ReviewSummary } from '../../../data/types';

/** สรุปคะแนน + รายการรีวิว (design C36 M9 ใช้ก้อนเดียวกัน) */
export function ReviewList({ summary }: { summary: ReviewSummary }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();

  return (
    <View style={{ gap: p.space.md }}>
      <RatingSummary summary={summary} />
      {summary.reviews.length === 0 ? (
        <Text testID="reviews-empty" variant="body" color="muted">
          {t('reviews.empty')}
        </Text>
      ) : (
        summary.reviews.map((r) => <ReviewCard key={r.id} review={r} />)
      )}
    </View>
  );
}

/** หัวสรุป เลขเฉลี่ย จำนวนรีวิว และแท่งรายระดับ */
function RatingSummary({ summary }: { summary: ReviewSummary }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  // §10 ยังไม่มีใครรีวิวคือ "ยังไม่รู้" ไม่ใช่ 0 ดาว จอต้องบอกตรง ๆ ไม่ใช่โชว์เลขปลอม
  if (summary.average === null) {
    return (
      <Card testID="rating-summary-empty">
        <Text variant="body" color="muted">{t('reviews.noRatingYet')}</Text>
      </Card>
    );
  }

  const most = Math.max(...summary.breakdown.map((b) => b.count), 1);

  return (
    <Card testID="rating-summary" style={{ flexDirection: 'row', gap: p.space.lg }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text testID="rating-average" variant="h1" style={{ fontVariant: ['tabular-nums'] }}>
          {summary.average.toFixed(1)}
        </Text>
        <Stars value={Math.round(summary.average)} size={14} />
        <Text variant="caption" color="muted">
          {t('reviews.count', { count: summary.count })}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
        {summary.breakdown.map((b) => (
          <View key={b.stars} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
            <Text variant="caption" color="muted" style={{ width: 10, textAlign: 'right' }}>
              {b.stars}
            </Text>
            <View
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: tokens.bgSunken,
                overflow: 'hidden',
              }}
            >
              {/* เทียบกับระดับที่มีมากที่สุด ไม่ใช่กับผลรวม ไม่งั้นทุกแท่งสั้นจนอ่านไม่ออก */}
              <View
                testID={`rating-bar-${b.stars}`}
                style={{
                  width: `${(b.count / most) * 100}%`,
                  height: '100%',
                  backgroundColor: tokens.brandAccent,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const when = relativeTime(review.createdAt);

  return (
    <Card testID={`review-${review.id}`} style={{ gap: p.space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" bold numberOfLines={1}>{review.authorName}</Text>
          <Text variant="caption" color="muted" numberOfLines={1}>
            {[t(when.key, { count: when.count }), review.itemName].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Stars value={review.restaurantRating} size={14} />
      </View>

      {review.comment ? <Text variant="small">{review.comment}</Text> : null}

      {review.photoUrls.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: p.space.sm }}>
          {review.photoUrls.map((url) => (
            <Image
              key={url}
              testID={`review-photo-${review.id}`}
              source={{ uri: url }}
              style={{ width: 72, height: 72, borderRadius: p.radius.sm }}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
