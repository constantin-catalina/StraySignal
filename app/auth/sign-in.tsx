import { useAuth, useOAuth, useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ImageBackground, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const BG = require('@/assets/backgrounds/Auth.png');
const GOOGLE = require('@/assets/icons/google.png');     
const FB = require('@/assets/icons/facebook.png');       

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();

  const google = useOAuth({ strategy: 'oauth_google' });
  const facebook = useOAuth({ strategy: 'oauth_facebook' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const redirectUri = makeRedirectUri({ scheme: 'straysignal' });

  async function onGooglePress() {
    // if already signed in, go to home instead of starting OAuth
    if (isSignedIn) {
      router.replace('/(tabs)/home');
      return;
    }

    try {
      const { createdSessionId, setActive: setActiveOAuth } =
        await google.startOAuthFlow({ redirectUrl: redirectUri });
      if (createdSessionId) {
        await setActiveOAuth?.({ session: createdSessionId });
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      // if OAuth fails because user is already signed in, redirect silently
      const msg = e?.message ?? 'Please try again.';
      if (msg.toLowerCase().includes('already signed')) {
        router.replace('/(tabs)/home');
        return;
      }
      Alert.alert('Google sign-in failed', msg);
    }
  }

  async function onFacebookPress() {
    // if already signed in, go to home instead of starting OAuth
    if (isSignedIn) {
      router.replace('/(tabs)/home');
      return;
    }

    try {
      const { createdSessionId, setActive: setActiveOAuth } =
        await facebook.startOAuthFlow({ redirectUrl: redirectUri });
      if (createdSessionId) {
        await setActiveOAuth?.({ session: createdSessionId });
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Please try again.';
      if (msg.toLowerCase().includes('already signed')) {
        router.replace('/(tabs)/home');
        return;
      }
      Alert.alert('Facebook sign-in failed', msg);
    }
  }

  async function onEmailPasswordPress() {
    if (!isLoaded) return;
    if (isSignedIn) {
      router.replace('/(tabs)/home');
      return;
    }
    try {
      const res = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (res.status === 'complete' && res.createdSessionId) {
        await setActive!({ session: res.createdSessionId });
        router.replace('/(tabs)/home');
        return;
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? 'Invalid email or password.';
      Alert.alert('Log in failed', msg);
    }
  }

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.wrapper}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.back}>
          <Ionicons name="chevron-back" size={24} />
        </TouchableOpacity>

        <Text style={styles.title}>Welcome Back!</Text>

        <TouchableOpacity style={[styles.cta, styles.ctaPrimary]} onPress={onFacebookPress} activeOpacity={0.9}>
          <Image source={FB} style={styles.leftIcon} resizeMode="contain" />
          <Text style={[styles.ctaText, styles.ctaTextPrimary]}>CONTINUE WITH FACEBOOK</Text>
        </TouchableOpacity>

        {/* Google */}
        <TouchableOpacity style={[styles.cta, styles.ctaOutline]} onPress={onGooglePress} activeOpacity={0.9}>
          <Image source={GOOGLE} style={styles.leftIcon} resizeMode="contain" />
          <Text style={styles.ctaText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>

        <Text style={styles.or}>OR LOG IN WITH EMAIL</Text>

        {/* Email */}
        <TextInput
          placeholder="Email address"
          placeholderTextColor="#7C8AA5"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        {/* Password */}
        <TextInput
          placeholder="Password"
          placeholderTextColor="#7C8AA5"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.loginBtn} onPress={onEmailPasswordPress} activeOpacity={0.9}>
          <Text style={styles.loginText}>LOG IN</Text>
        </TouchableOpacity>

        <Link href="/auth/forgot-password" asChild>
          <TouchableOpacity>
            <Text style={styles.forgot}>Forgot Password?</Text>
          </TouchableOpacity>
        </Link>

        <View style={{ flex: 1 }} />

        <Text style={styles.bottomText}>
          ALREADY HAVE AN ACCOUNT?{' '}
          <Text onPress={() => router.push('/auth/sign-up')} style={styles.signUp}>SIGN UP</Text>
        </Text>
      </View>
    </ImageBackground>
  );
}

const NAVY = '#23395B';
const LIGHT = '#D9D9D9';

const styles = StyleSheet.create({
  bg: { flex: 1 },
  wrapper: {
    flex: 1,
    paddingTop: Platform.select({ ios: 80, android: 60 }),
    paddingHorizontal: 24,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: '700', color: NAVY, marginVertical: 30, textAlign: 'center' },

  cta: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  ctaPrimary: { backgroundColor: '#23395B' },
  ctaOutline: { borderWidth: 1, borderColor: LIGHT, backgroundColor:  LIGHT },
  ctaText: { flex: 1, color: '#23395B', textAlign: 'center', fontWeight: '700', letterSpacing: 0.4 },
  ctaTextPrimary: { color: '#D9D9D9' },

  leftIcon: { 
    position: 'absolute', 
    left: 20,
    width: 24,
    height: 24
  },

  or: { textAlign: 'center', color: '#23395B', marginVertical: 20, fontWeight: '700', letterSpacing: 0.3 },

  input: {
    height: 56,
    borderRadius: 14,
    backgroundColor: LIGHT,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },

  loginBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#23395B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginText: { color: LIGHT, fontWeight: '800', letterSpacing: 0.5 },

  forgot: { textAlign: 'center', color: '#23395B', marginTop: 20, fontWeight: '500' },

  bottomText: { textAlign: 'center', color: '#D9D9D9', marginBottom: 197, fontWeight: '500' },
  signUp: { color: '#23395B', fontWeight: '500', textDecorationLine: 'underline' },
});
