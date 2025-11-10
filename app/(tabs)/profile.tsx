import TopBar from '@/components/TopBar';
import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const PROFILE_DATA_KEY = 'user_profile_data';

interface LostPetCase {
  _id: string;
  petName: string;
  animalType: string;
  breed?: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  createdAt?: string;
  timestamp?: string;
}

interface ProfileData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  showPhoneNumber?: boolean;
  radiusPreference?: string;
  profileImage?: string;
}

export default function Profile() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [lostPetCases, setLostPetCases] = useState<LostPetCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({});

  // Get user info with fallbacks from saved data or Clerk
  const userName = profileData.name || user?.fullName || 
                   `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 
                   user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 
                   'User';
  
  const userImage = profileData.profileImage || user?.imageUrl;
  const userEmail = profileData.email || user?.emailAddresses?.[0]?.emailAddress || 'Not provided';
  const userPhone = profileData.phone || '+40720013113';
  const userLocation = profileData.location || 'Timisoara, Romania';
  const showPhoneNumber = profileData.showPhoneNumber || false;
  const radiusPreference = profileData.radiusPreference || '2';

  const loadProfileData = useCallback(async () => {
    try {
      if (!user?.id) return;

      // Try to load from MongoDB first
      const response = await fetch(`${API_ENDPOINTS.USERS}/${user.id}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setProfileData(data.data);
          return;
        }
      }

      // Fallback to AsyncStorage if MongoDB fetch fails
      const savedData = await AsyncStorage.getItem(PROFILE_DATA_KEY);
      if (savedData) {
        setProfileData(JSON.parse(savedData));
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  }, [user?.id]);

  const fetchLostPetCases = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.REPORTS);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Filter for lost-from-home reports only
          const lostCases = data.data.filter((report: any) => report.reportType === 'lost-from-home');
          setLostPetCases(lostCases);
        }
      }
    } catch (error) {
      console.error('Error fetching lost pet cases:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      fetchLostPetCases();
    }, [loadProfileData, fetchLostPetCases])
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const day = date.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' 
                 : day === 2 || day === 22 ? 'nd'
                 : day === 3 || day === 23 ? 'rd' : 'th';
    return `${months[date.getMonth()]} ${day}${suffix} ${date.getFullYear()}`;
  };

  if (!isLoaded || loading) {
    return (
      <View style={styles.root}>
        <View style={styles.topBarWrapper}>
          <TopBar showRightDots={true} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBarWrapper}>
        <TopBar showRightDots={true} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header with Profile background */}
        <ImageBackground
          source={require('@/assets/backgrounds/Profile.png')}
          style={styles.header}
          resizeMode="cover"
        />

        {/* Profile Content Card */}
        <View style={styles.profileCard}>
          {/* Profile Picture */}
          <View style={styles.profilePictureContainer}>
            {userImage ? (
              <Image
                source={{ uri: userImage }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={[styles.profilePicture, styles.profilePlaceholder]}>
                <Ionicons name="person" size={60} color="#666" />
              </View>
            )}
          </View>

          {/* User Info */}
          <Text style={styles.userName}>{userName}</Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={20} color="#1E1F24" />
            <Text style={styles.locationText}>{userLocation}</Text>
          </View>

          {/* Edit Profile Button */}
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
          >
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>

          {/* Contact Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT INFO:</Text>
            <Text style={styles.infoText}>Phone number: {userPhone}</Text>
            <Text style={styles.infoText}>Email: {userEmail}</Text>
            <Text style={styles.infoText}>Show my phone number in lost pet cases: {showPhoneNumber ? 'YES' : 'NO'}</Text>
          </View>

          {/* My Lost Pet Cases Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MY LOST PET CASES:</Text>
            {lostPetCases.length === 0 ? (
              <Text style={styles.infoText}>No lost pet cases yet</Text>
            ) : (
              lostPetCases.map((petCase, index) => (
                <Text key={petCase._id} style={styles.infoText}>
                  {index + 1}. {petCase.petName}                [{formatDate(petCase.lastSeenDate || petCase.createdAt || petCase.timestamp || '')}]
                </Text>
              ))
            )}
            
            <TouchableOpacity 
              style={styles.viewCasesButton}
              onPress={() => router.push('/active-cases')}
            >
              <Text style={styles.viewCasesButtonText}>View cases</Text>
            </TouchableOpacity>
          </View>

          {/* Optional Utilities Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OPTIONAL UTILITIES:</Text>
            <Text style={styles.infoText}>Radius preference: show alerts within {radiusPreference}km</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1E1F24',
  },
  topBarWrapper: {
    zIndex: 2,
  },
  container: {
    flex: 1,
  },
  header: {
    height: 280,
    backgroundColor: '#9AD0DA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    minHeight: 600,
  },
  profilePictureContainer: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  profilePicture: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#D9D9D9',
  },
  profilePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#23395B',
    textAlign: 'center',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  locationText: {
    fontSize: 16,
    color: '#1E1F24',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: '#23395B',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 30,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E1F24',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  infoText: {
    fontSize: 14,
    color: '#1E1F24',
    marginBottom: 4,
    lineHeight: 20,
  },
  viewCasesButton: {
    backgroundColor: '#D9D9D9',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 12,
  },
  viewCasesButtonText: {
    color: '#1E1F24',
    fontSize: 14,
    fontWeight: '500',
  },
});
