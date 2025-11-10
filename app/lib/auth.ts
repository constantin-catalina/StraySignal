import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'signed_in';

export async function setSignedIn(v: boolean) {
  await AsyncStorage.setItem(KEY, v ? '1' : '0');
}
export async function getSignedIn(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}

// Provide a default export so expo-router stops warning about missing default component export.
// This module is a utility, so we export a tiny placeholder component.
export default function AuthLibPlaceholder() {
  return null;
}
