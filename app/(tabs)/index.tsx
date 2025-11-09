import React from 'react';
import { ImageBackground, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'}
        translucent
        backgroundColor="transparent"
      />

      <ImageBackground
        source={require('@/assets/backgrounds/Home.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}      
      />

      <SafeAreaView style={styles.content} edges={['top']}>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#81adc8' },
  content: { flex: 1, padding: 16 },
});
