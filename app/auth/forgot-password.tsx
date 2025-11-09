import { useSignIn } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ImageBackground, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const BG = require('@/assets/backgrounds/Auth.png');

export default function ForgotPassword() {
  const { signIn, isLoaded, setActive } = useSignIn();
  const [stage, setStage] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const requestCode = async () => {
    if (!isLoaded) return;
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      setStage('verify');
    } catch (e: any) {
      Alert.alert('Error', e?.errors?.[0]?.longMessage ?? 'Could not start reset.');
    }
  };

  const verifyAndSet = async () => {
    if (!isLoaded || !signIn) {
      Alert.alert('Error', 'Please wait a moment and try again.');
      return;
    }
    try {
      const res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });
      if (res.status === 'complete' && res.createdSessionId) {
        await setActive?.({ session: res.createdSessionId });
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.errors?.[0]?.longMessage ?? 'Invalid code.');
    }
  };

  return (
    <ImageBackground source={BG} style={styles.background} resizeMode="cover">
      <View style={styles.wrapper}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.back}>
          <Ionicons name="chevron-back" size={24} />
        </TouchableOpacity>
        
        <Text style={styles.title}>Reset Password</Text>

        <View style={styles.content}>
          {stage === 'request' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#7C8AA5"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TouchableOpacity style={styles.btn} onPress={requestCode}>
                <Text style={styles.btnText}>SEND RESET CODE</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email code"
                placeholderTextColor="#7C8AA5"
                value={code}
                onChangeText={setCode}
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor="#7C8AA5"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity style={styles.btn} onPress={verifyAndSet}>
                <Text style={styles.btnText}>Set new password</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const NAVY = '#23395B';
const LIGHT = '#D9D9D9';

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  wrapper: {
    flex: 1,
    paddingTop: Platform.select({ ios: 80, android: 60 }),
    paddingHorizontal: 24,
  },
  back: { 
    width: 32, 
    height: 32, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 20 
  },

  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: NAVY, 
    marginTop: 150, 
    marginBottom: 15,
    textAlign: 'center' 
  },
  content: {
    flex: 1,
    paddingTop: 20
  },
  input: { 
    height: 56,
    borderRadius: 14,
    backgroundColor: LIGHT,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
  },
  btn: { 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: NAVY, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 8 
  },
  btnText: { 
    color: LIGHT, 
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5 
  },
});
