import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';

type Props = {
  title?: string;
  onBack?: () => void;
  showRightDots?: boolean;
};

export default function TopBar({ title = 'StraySignal', onBack, showRightDots = true }: Props) {
  const logo = require('../assets/logos/blue-logo.png');

  const topPadding = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 44;
  const baseHeight = 56;
  const barHeight = baseHeight + topPadding;

  return (
    <View style={[styles.container, { paddingTop: topPadding, height: barHeight }]}>
      <TouchableOpacity onPress={onBack} style={styles.sideButton} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={styles.title.color as string} />
      </TouchableOpacity>

      <View style={styles.center}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </View>

      {showRightDots ? (
        <TouchableOpacity style={styles.sideButton} accessibilityRole="button">
          <Ionicons name="ellipsis-horizontal" size={18} color={styles.title.color as string} />
        </TouchableOpacity>
      ) : (
        <View style={styles.sideButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1F24',
  },
  sideButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 16,
    color: '#9AD0DA',
    fontWeight: '600',
  },
});
