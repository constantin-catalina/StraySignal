import { API_ENDPOINTS } from '@/constants/api';
import { useAuth, useOAuth, useSignIn, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import { Link, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, ImageBackground, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const BG = require('@/assets/backgrounds/Auth.png');
const GOOGLE = require('@/assets/icons/google.png');     
const FB = require('@/assets/icons/facebook.png');       

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const { isLoaded: userLoaded, isSignedIn: userSignedIn, user } = useUser();
  const hasCreatedUser = useRef(false);

  const google = useOAuth({ strategy: 'oauth_google' });
  const facebook = useOAuth({ strategy: 'oauth_facebook' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const redirectUri = makeRedirectUri({ scheme: 'straysignal' });


  useEffect(() => {
    async function handleUserCreationAndRedirect() {
      if (userLoaded && userSignedIn && user && !hasCreatedUser.current) {
        hasCreatedUser.current = true;
        const id = user.id;
        const emailAddr = user.emailAddresses?.[0]?.emailAddress || '';
        const name = user.fullName || user.firstName || '';
          try {
            const response = await fetch(API_ENDPOINTS.USERS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clerkId: id, email: emailAddr, name }),
            });
            let shouldRedirect = false;
            if (response.ok) {
              shouldRedirect = true;
            } else {
              const errorData = await response.json();
              if (errorData.error?.includes('E11000')) {
                shouldRedirect = true;
              } else {
                Alert.alert('Sign-in failed', 'Could not create user in backend.');
              }
            }
            if (shouldRedirect) {
              router.replace('/(tabs)/home');
            }
          } catch (_err) {
            Alert.alert('Sign-in failed', 'Network error while creating user.');
          }
      }
    }
    handleUserCreationAndRedirect();
  }, [userLoaded, userSignedIn, user]);

  async function onGooglePress() {
    if (isSignedIn) {
      router.replace('/(tabs)/home');
      return;
    }

    try {
      const { createdSessionId, setActive: setActiveOAuth } =
        await google.startOAuthFlow({ redirectUrl: redirectUri });
      if (createdSessionId) {
        await setActiveOAuth?.({ session: createdSessionId });
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Please try again.';
      if (msg.toLowerCase().includes('already signed')) {
        return;
      }
      Alert.alert('Google sign-in failed', msg);
    }
  }

  async function onFacebookPress() {
    if (isSignedIn) {
      router.replace('/(tabs)/home');
      return;
    }

    try {
      const { createdSessionId, setActive: setActiveOAuth } =
        await facebook.startOAuthFlow({ redirectUrl: redirectUri });
      if (createdSessionId) {
        await setActiveOAuth?.({ session: createdSessionId });
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Please try again.';
      if (msg.toLowerCase().includes('already signed')) {
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

        <TouchableOpacity style={[styles.cta, styles.ctaOutline]} onPress={onGooglePress} activeOpacity={0.9}>
          <Image source={GOOGLE} style={styles.leftIcon} resizeMode="contain" />
          <Text style={styles.ctaText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>

        <Text style={styles.or}>OR LOG IN WITH EMAIL</Text>

        <TextInput
          placeholder="Email address"
          placeholderTextColor="#7C8AA5"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

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
