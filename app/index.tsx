import { Link } from 'expo-router';
import React from 'react';
import { Dimensions, Image, ImageBackground, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function Welcome() {
  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'}
        translucent
        backgroundColor="transparent"
      />

      <ImageBackground
        source={require('@/assets/backgrounds/Welcome.png')}
        resizeMode="cover"
        style={styles.background}
      >

      <SafeAreaView style={styles.headerSafe} edges={['top']}> 
        <View style={styles.header}> 
            <Image source={require('@/assets/logos/color-logo.png')} 
            style={styles.logo} 
            resizeMode="contain" /> 
        </View> 
      </SafeAreaView>

      <SafeAreaView style={styles.content} edges={['bottom']}>
        <View style={styles.center}>
          <Image
            source={require('@/assets/images/welcome-dog.png')}
            style={styles.dog}
            resizeMode="contain"
          />

          <Text style={styles.title}>Help lost pets get home</Text>
          <Text style={styles.subtitle}>
            Join neighbors who report sightings and{'\n'}receive instant match alerts.
          </Text>

          <Link href="/auth/sign-up" asChild>
            <TouchableOpacity style={styles.cta}>
              <Text style={styles.ctaText}>SIGN UP</Text>
            </TouchableOpacity>
          </Link>

          <Text style={styles.loginRow}>
            ALREADY HAVE AN ACCOUNT?{' '}
            <Link href="/auth/sign-in" style={styles.loginLink}>LOG IN</Link>
          </Text>
        </View>
      </SafeAreaView>
      </ImageBackground>

    </View>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#81adc8',
    overflow: 'hidden'
  },

  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  header: { paddingTop: 15, paddingHorizontal: 15, alignItems: 'flex-start' },
  logo: { width: 170, height: 44 },

  content: { 
    flex: 1,
    width: '100%'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',  
    paddingBottom: 28,
    paddingHorizontal: 20, 
    gap: 12,
    width: '100%'
  },

  dog: {
    width: screenWidth * 1.1,
    height: screenHeight * 0.45, 
    marginBottom: screenHeight * 0.15,
    alignSelf: 'center',
    marginHorizontal: -(screenWidth * 0.05)
  },

  title: { fontSize: 22, fontWeight: '700', color: '#23395B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#D9D9D9', textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  cta: {
    width: '88%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#23395B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  background: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%'
  },
  ctaText: { color: '#D9D9D9', fontSize: 15, fontWeight: '400', letterSpacing: 0.5 },

  loginRow: { color: '#D9D9D9', marginTop: 10, textAlign: 'center', letterSpacing: 0.3 },
  loginLink: { textDecorationLine: 'underline', color: '#23395B' },
});