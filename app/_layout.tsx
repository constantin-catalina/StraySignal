import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';

import { tokenCache } from '@/utils/clerkTokenCache'; // shown below
import { ClerkLoaded, ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-expo';

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const publishableKey = Constants.expoConfig?.extra?.clerkPublishableKey as string;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>

          {/* App shown only when signed in */}
          <SignedIn>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </SignedIn>

          {/* Auth flow shown when signed out */}
          <SignedOut>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="auth/sign-in" />
              <Stack.Screen name="auth/sign-up" />
              <Stack.Screen name="auth/forgot-password" />   {/* <-- add this */}
            </Stack>
          </SignedOut>

          <StatusBar style="auto" />
        </ThemeProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
