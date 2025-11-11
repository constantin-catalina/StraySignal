import TopBarSecondary from '@/components/TopBarSecondary';
import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Per-user storage to avoid mixing data between different signed-in accounts
const PROFILE_DATA_KEY_PREFIX = 'user_profile_data:';

export default function EditProfile() {
  const router = useRouter();
  const { user } = useUser();
  const storageKey = user?.id ? `${PROFILE_DATA_KEY_PREFIX}${user.id}` : null;

  // Initialize state with current user data
  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.emailAddresses?.[0]?.emailAddress || '');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [radiusPreference, setRadiusPreference] = useState('2');
  const [profileImage, setProfileImage] = useState(user?.imageUrl || '');

  // Load saved profile data on mount
  useEffect(() => {
    loadProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfileData = async () => {
    try {
      if (!user?.id) return;

      // First try to load from MongoDB
      const response = await fetch(`${API_ENDPOINTS.USERS}/${user.id}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const userData = data.data;
          // Use saved data from MongoDB (user can edit name); prefer Clerk for email/image only
          setName(userData.name || user?.fullName || '');
          setEmail(user?.emailAddresses?.[0]?.emailAddress || userData.email || '');
          setPhone(userData.phone || '');
          setLocation(userData.location || '');
          setShowPhoneNumber(userData.showPhoneNumber || false);
          setRadiusPreference(userData.radiusPreference?.toString() || '2');
          setProfileImage(user?.imageUrl || userData.profileImage || '');
          return;
        }
      }

      // Fallback to AsyncStorage if MongoDB fetch fails
      if (storageKey) {
        const savedData = await AsyncStorage.getItem(storageKey);
        if (savedData) {
        const profileData = JSON.parse(savedData);
        // Use saved name from storage (user can edit); prefer Clerk for email/image only
        setName(profileData.name || user?.fullName || '');
        setEmail(user?.emailAddresses?.[0]?.emailAddress || profileData.email || '');
        setPhone(profileData.phone || '');
        setLocation(profileData.location || '');
        setShowPhoneNumber(profileData.showPhoneNumber || false);
        setRadiusPreference(profileData.radiusPreference?.toString() || '2');
        setProfileImage(user?.imageUrl || profileData.profileImage || '');
        }
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  };

  const pickImage = async () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'We need camera permissions to take photos.');
              return;
            }

            let result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [1, 1],
            });

            if (!result.canceled && result.assets) {
              setProfileImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'We need camera roll permissions to upload photos.');
              return;
            }

            let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
              aspect: [1, 1],
            });

            if (!result.canceled && result.assets) {
              setProfileImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleSave = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'User ID not found. Please try logging in again.');
        return;
      }

      // If no phone, ensure showPhoneNumber is false
      const finalShowPhoneNumber = phone && phone.trim().length > 0 ? showPhoneNumber : false;

      // Prepare profile data
      const profileData = {
        clerkId: user.id,
        name,
        email,
        phone,
        location,
        showPhoneNumber: finalShowPhoneNumber,
        radiusPreference: parseInt(radiusPreference) || 2,
        profileImage,
      };
      
      console.log('Saving profile data:', profileData);
      console.log('API endpoint:', API_ENDPOINTS.USERS);

      // Save to MongoDB via API
      let response;
      try {
        response = await fetch(API_ENDPOINTS.USERS, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(profileData),
        });
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`);
      }

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error('Server error (JSON):', errorData);
        } catch {
          errorData = await response.text();
          console.error('Server error (text):', errorData);
        }
        throw new Error(`Failed to save profile to server: ${response.status}`);
      }

      const result = await response.json();
      console.log('Save successful:', result);

      // Also save to AsyncStorage for offline access
      if (storageKey) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(profileData));
      }
      
      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error saving profile data:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      const errorMessage = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Error', `Failed to save profile data: ${errorMessage}`);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBarWrapper}>
        <TopBarSecondary onBack={() => router.back()} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={styles.profileSection}>
          <View style={styles.profilePictureContainer}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={[styles.profilePicture, styles.profilePlaceholder]}>
                <Ionicons name="person" size={60} color="#666" />
              </View>
            )}
            <TouchableOpacity style={styles.editPhotoButton} onPress={pickImage}>
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formContainer}>
          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Enter your location"
              placeholderTextColor="#999"
            />
          </View>

          {/* Show Phone Number Toggle */}
          <View style={styles.inputGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Show phone number in lost pet cases</Text>
              <Switch
                value={showPhoneNumber}
                onValueChange={setShowPhoneNumber}
                disabled={!phone || phone.trim().length === 0}
                trackColor={{ false: '#767577', true: '#5F9EA0' }}
                thumbColor={showPhoneNumber ? '#fff' : '#f4f3f4'}
              />
            </View>
            {(!phone || phone.trim().length === 0) && (
              <Text style={styles.helperText}>Enter a phone number to enable this option</Text>
            )}
          </View>

          {/* Radius Preference */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alert Radius (km)</Text>
            <TextInput
              style={styles.input}
              value={radiusPreference}
              onChangeText={setRadiusPreference}
              placeholder="Enter radius in km"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            <Text style={styles.helperText}>
              Show alerts within this radius of your location
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
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
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#2C2C2E',
  },
  profilePictureContainer: {
    position: 'relative',
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#8AB1CA',
    backgroundColor: '#D9D9D9',
  },
  profilePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8AB1CA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#2C2C2E',
  },
  formContainer: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#8AB1CA',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
