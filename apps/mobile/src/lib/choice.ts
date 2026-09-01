import * as SecureStore from 'expo-secure-store';
import { choiceKey, type Choices } from './prefKeys';

export const choice: Choices = {
  async read(k) {
    return SecureStore.getItemAsync(choiceKey(k));
  },

  async write(k, value) {
    await SecureStore.setItemAsync(choiceKey(k), value);
  },
};
