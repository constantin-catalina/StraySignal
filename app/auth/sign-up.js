import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ImageBackground, Platform, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { setSignedIn } from '../lib/auth';

const BG = require('@/assets/backgrounds/Auth.png');
const GOOGLE = require('@/assets/icons/google.png');
const FB = require('@/assets/icons/facebook.png');

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  // validation / status
  const [emailStatus, setEmailStatus] = useState(''); // '', 'valid', 'invalid'
  const [passwordStatus, setPasswordStatus] = useState(''); // '', 'valid', 'invalid'

  const isValidEmail = (e) => /\S+@\S+\.\S+/.test(e);
  const canSubmit = name.trim() && emailStatus === 'valid' && passwordStatus === 'valid' && accepted && !loading;

  // email validation immediate
  useEffect(() => {
    if (!email) return setEmailStatus('');
    setEmailStatus(isValidEmail(email) ? 'valid' : 'invalid');
  }, [email]);

  // password validation immediate (min 6 chars)
  useEffect(() => {
    if (!password) return setPasswordStatus('');
    setPasswordStatus(password.length >= 6 ? 'valid' : 'invalid');
  }, [password]);

  const handleSocial = async () => {
    await setSignedIn(true);
    router.replace('/(tabs)/home');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      // TODO: integrate real signup
      await setSignedIn(true);
      router.replace('/(tabs)/home');
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'} translucent backgroundColor="transparent" />
      <ImageBackground source={BG} resizeMode="cover" style={styles.background}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.wrapper}>
            <TouchableOpacity onPress={() => router.replace('/')} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color="#23395B" />
            </TouchableOpacity>

            <Text style={styles.title}>Create your account</Text>

            <TouchableOpacity style={[styles.cta, styles.ctaPrimary]} onPress={handleSocial} activeOpacity={0.9}>
              <Image source={FB} style={styles.leftIcon} resizeMode="contain" />
              <Text style={[styles.ctaText, styles.ctaTextPrimary]}>CONTINUE WITH FACEBOOK</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.cta, styles.ctaOutline]} onPress={handleSocial} activeOpacity={0.9}>
              <Image source={GOOGLE} style={styles.leftIcon} resizeMode="contain" />
              <Text style={styles.ctaText}>CONTINUE WITH GOOGLE</Text>
            </TouchableOpacity>

            <Text style={styles.or}>OR LOG IN WITH EMAIL</Text>

            <View style={styles.form}>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="Full name"
                  placeholderTextColor="#7C8AA5"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                />
                
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  placeholder="Email address"
                  placeholderTextColor="#7C8AA5"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                />
                <View style={styles.indicator}>
                  {emailStatus === 'valid' ? (
                    <Ionicons name="checkmark-circle" size={20} color="#407a56ff" />
                  ) : emailStatus === 'invalid' ? (
                    <Ionicons name="close-circle" size={20} color="#963429ff" />
                  ) : null}
                </View>
              </View>

              <View style={styles.passwordRow}>
                <TextInput
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor="#7C8AA5"
                  secureTextEntry={!showPassword}
                  style={[styles.input, { marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                />
                <View style={styles.indicatorPassword}>
                  {passwordStatus === 'valid' ? (
                    <Ionicons name="checkmark-circle" size={20} color="#407a56ff" />
                  ) : passwordStatus === 'invalid' ? (
                    <Ionicons name="close-circle" size={20} color="#963429ff" />
                  ) : null}
                </View>
                <TouchableOpacity style={styles.eye} onPress={() => setShowPassword(s => !s)}>
                  <Ionicons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#23395B" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setAccepted(a => !a)} style={styles.policyRow} activeOpacity={0.8}>
                <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
                  {accepted ? <Ionicons name="checkmark" size={14} color={LIGHT} /> : null}
                </View>
                <Text style={styles.policyText}>I have read the <Text style={styles.link}>Privacy Policy</Text></Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.primary, !canSubmit && styles.primaryDisabled]} onPress={handleSubmit} disabled={!canSubmit} activeOpacity={0.9}>
                <Text style={styles.primaryText}>{loading ? 'LOADING...' : 'GET STARTED'}</Text>
              </TouchableOpacity>
            </View>

          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const NAVY = '#23395B';
const LIGHT = '#D9D9D9';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#81adc8' },
  background: { flex: 1 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  wrapper: { flex: 1, paddingTop: Platform.select({ ios: 80, android: 60 }), paddingHorizontal: 24 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: NAVY, textAlign: 'center', marginBottom: 30, marginTop: 50 },

  cta: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  ctaPrimary: { backgroundColor: NAVY },
  ctaOutline: { backgroundColor: LIGHT, borderWidth: 1, borderColor: '#E8EEF6' },
  ctaText: { flex: 1, textAlign: 'center', fontWeight: '700', letterSpacing: 0.4, color: NAVY },
  ctaTextPrimary: { color: LIGHT },
  leftIcon: { position: 'absolute', left: 20, width: 24, height: 24 },

  or: { textAlign: 'center', color: NAVY, marginVertical: 12, fontWeight: '700', letterSpacing: 0.3 },

  form: { marginTop: 6, width: '100%', alignItems: 'center' },
  inputRow: { width: '100%', maxWidth: 360, position: 'relative', marginBottom: 12 },
  input: { height: 56, width: '100%', borderRadius: 14, backgroundColor: LIGHT, paddingHorizontal: 16, fontSize: 16 },
  indicator: { position: 'absolute', right: 12, top: 18 },
  indicatorPassword: { position: 'absolute', right: 44, top: 18 },
  passwordRow: { width: '100%', maxWidth: 360, position: 'relative' },
  eye: { position: 'absolute', right: 16, top: 18 },

  policyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 15 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#C7D6E6', marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  checkboxChecked: { borderColor: NAVY, backgroundColor: NAVY },
  policyText: { color: '#D9D9D9', fontSize: 14 },
  link: { color: NAVY, fontWeight: '500' },

  primary: { marginTop: 8, height: 56, borderRadius: 28, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', width: '88%', alignSelf: 'center' },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: LIGHT, fontWeight: '700' }
});
