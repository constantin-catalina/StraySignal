import { useAuth } from '@clerk/clerk-expo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Modal, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  title?: string;
  onBack?: () => void;
  showRightDots?: boolean;
};

export default function TopBar({ title = 'StraySignal', onBack, showRightDots = true }: Props) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const logo = require('../assets/logos/blue-logo.png');

  const topPadding = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 44;
  const baseHeight = 56;
  const barHeight = baseHeight + topPadding;

  const handleLogout = async () => {
  setShowMenu(false);
  await signOut();
  // No manual redirect needed; Clerk will switch to SignedOut stack
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding, height: barHeight }]}> 
      <View style={styles.sideButton} />

      <View style={styles.center}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </View>

      {showRightDots ? (
        <View>
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.sideButton} accessibilityRole="button">
            <Ionicons name="ellipsis-horizontal" size={18} color={styles.title.color as string} />
          </TouchableOpacity>
          
          {showMenu && (
            <Modal
              transparent
              visible={showMenu}
              onRequestClose={() => setShowMenu(false)}
              animationType="fade"
            >
              <TouchableOpacity 
                style={styles.menuOverlay} 
                activeOpacity={1} 
                onPress={() => setShowMenu(false)}
              >
                <View style={styles.menuContainer}>
                  <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
                    <Ionicons name="log-out-outline" size={20} color="#fff" />
                    <Text style={styles.menuText}>Log Out</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          )}
        </View>
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 56 : 100,
    paddingRight: 12,
  },
  menuContainer: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
