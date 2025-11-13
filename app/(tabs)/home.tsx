import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ImageBackground, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  // Wait for Clerk to fully load before accessing user data
  if (!isLoaded) {
    return (
      <View style={styles.root}>
        <ImageBackground
          source={require('@/assets/backgrounds/Home.png')}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}      
        />
        <SafeAreaView style={styles.content} edges={['top']}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }
  
  // Extract first name from multiple possible sources (OAuth providers vary)
  const firstName = user?.firstName || 
                    user?.fullName?.split(' ')[0] || 
                    user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 
                    'User';

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
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={styles.header}>
            <Image 
              source={require('@/assets/logos/color-logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Welcome Message */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome, {firstName}!</Text>
            <Text style={styles.welcomeSubtitle}>We wish you a good day.</Text>
          </View>

          {/* Action Cards */}
          <View style={styles.cardsContainer}>
            {/* Report your lost pet */}
            <TouchableOpacity 
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push('/report-lost-pet')}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Report your lost pet</Text>
                <Text style={styles.cardDescription}>
                  Create a post with photos and the last seen location
                </Text>
              </View>
              <View style={styles.cardIcon}>
                <Ionicons name="play" size={28} color="#D9D9D9" />
              </View>
            </TouchableOpacity>

            {/* View your cases */}
            <TouchableOpacity 
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push('/active-cases')}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>View your cases</Text>
                <Text style={styles.cardDescription}>
                  See and update your current lost pet cases
                </Text>
              </View>
              <View style={styles.cardIcon}>
                <Ionicons name="play" size={28} color="#D9D9D9" />
              </View>
            </TouchableOpacity>

            {/* Check your pet's route */}
            <TouchableOpacity 
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push('/pet-route')}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Check your pet&#39;s route</Text>
                <Text style={styles.cardDescription}>
                  View sightings, heatmaps, and travel history
                </Text>
              </View>
              <View style={styles.cardIcon}>
                <Ionicons name="play" size={28} color="#D9D9D9" />
              </View>
            </TouchableOpacity>

            {/* Create a printable poster */}
            <TouchableOpacity 
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push('/poster-generator')}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Create a printable poster</Text>
                <Text style={styles.cardDescription}>
                  Download a shareable poster with your pet&#39;s info and QR code
                </Text>
              </View>
              <View style={styles.cardIcon}>
                <Ionicons name="play" size={28} color="#D9D9D9" />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#81adc8' 
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 15,
  },
  header: {
    paddingTop: 15,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  logo: {
    width: 170,
    height: 44,
  },
  welcomeSection: {
    padding: 24,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E1F24',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#4A5568',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flex: 1,
    paddingRight: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E1F24',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E1F24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#2C3E50',
    fontWeight: '500',
  },
});
