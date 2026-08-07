import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { ReviewList } from '../../reviews/components/ReviewList';
import { useRestaurantReviews } from '../../reviews/hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'RestaurantReviews'>;

/** รีวิวของร้าน (design C36) */
export function RestaurantReviewsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data } = useRestaurantReviews(route.params.restaurantId);

  return (
    <SafeAreaView
      testID="screen-restaurant-reviews"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('reviews.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {data ? <ReviewList summary={data} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
