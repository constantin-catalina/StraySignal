import TopBarSecondary from '@/components/TopBarSecondary';
import { API_ENDPOINTS } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ImageBackground, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function ReportLostPet() {
  const router = useRouter();
  
  // Form state
  const [petName, setPetName] = useState('');
  const [animalType, setAnimalType] = useState('');
  const [breed, setBreed] = useState('');
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [lastSeenDate, setLastSeenDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasReward, setHasReward] = useState<boolean | null>(null);
  const [hasDistinctiveMarks, setHasDistinctiveMarks] = useState<boolean | null>(null);
  const [distinctiveMarks, setDistinctiveMarks] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  
  // Location state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [tempMarker, setTempMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Get current location for map
  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const openMapPicker = async () => {
    await getCurrentLocation();
    setShowMapModal(true);
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setTempMarker({ latitude, longitude });
  };

  const confirmLocation = async () => {
    if (tempMarker) {
      setLatitude(tempMarker.latitude);
      setLongitude(tempMarker.longitude);
      
      // Reverse geocode to get address
      try {
        const result = await Location.reverseGeocodeAsync({
          latitude: tempMarker.latitude,
          longitude: tempMarker.longitude,
        });
        
        if (result.length > 0) {
          const address = result[0];
          const parts = [address.street, address.city, address.region].filter(Boolean);
          const locationString = parts.join(', ');
          setLastSeenLocation(locationString || `${tempMarker.latitude.toFixed(4)}, ${tempMarker.longitude.toFixed(4)}`);
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
        setLastSeenLocation(`${tempMarker.latitude.toFixed(4)}, ${tempMarker.longitude.toFixed(4)}`);
      }
      
      setShowMapModal(false);
      setTempMarker(null);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to select photos.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setPhotos([...photos, ...newPhotos].slice(0, 5)); // Max 5 photos
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation
    if (!petName.trim()) {
      Alert.alert('Missing Information', 'Please enter your pet\'s name.');
      return;
    }
    if (!animalType.trim()) {
      Alert.alert('Missing Information', 'Please enter the type of animal.');
      return;
    }
    if (!lastSeenLocation.trim()) {
      Alert.alert('Missing Information', 'Please enter where your pet was last seen.');
      return;
    }
    if (!lastSeenDate) {
      Alert.alert('Missing Information', 'Please select when your pet was last seen.');
      return;
    }
    if (photos.length < 2) {
      Alert.alert('Missing Photos', 'Please upload at least two photos of your pet.');
      return;
    }
    if (hasDistinctiveMarks === null) {
      Alert.alert('Missing Information', 'Please indicate if your pet has distinctive marks.');
      return;
    }
    if (hasDistinctiveMarks && !distinctiveMarks.trim()) {
      Alert.alert('Missing Information', 'Please describe the distinctive marks.');
      return;
    }

    try {
      Alert.alert('Uploading', 'Please wait while we submit your report...');
      
      // Convert images to base64 if needed
      const processedPhotos = await Promise.all(
        photos.map(async (uri) => {
          // If it's already a base64 string, return it
          if (uri.startsWith('data:')) {
            return uri;
          }
          // For local URIs, read and convert to base64
          try {
            const response = await fetch(uri);
            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                console.log(`Image ${photos.indexOf(uri) + 1} size:`, result.length);
                resolve(result);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('Error converting image:', error);
            return uri; // Return original URI if conversion fails
          }
        })
      );

      console.log('Total photos processed:', processedPhotos.length);

      const reportData = {
        petName,
        animalType,
        breed,
        lastSeenLocation,
        latitude,
        longitude,
        lastSeenDate: lastSeenDate?.toISOString(),
        hasReward,
        hasDistinctiveMarks,
        distinctiveMarks: hasDistinctiveMarks ? distinctiveMarks : '',
        additionalInfo,
        photos: processedPhotos,
      };

  console.log('Submitting to:', API_ENDPOINTS.REPORTS_LOST_PET);
      console.log('Report data:', { ...reportData, photos: `[${reportData.photos.length} photos]` });
      
      const response = await fetch(API_ENDPOINTS.REPORTS_LOST_PET, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      console.log('Response status:', response.status);
      
      // Get response text first to see what we're receiving
      const responseText = await response.text();
      console.log('Response text:', responseText.substring(0, 200));

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error('Server returned an invalid response. Please check if the server is running.');
      }

      if (result.success) {
        Alert.alert('Success', 'Your lost pet report has been submitted!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        throw new Error(result.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit report. Please try again.';
  Alert.alert('Error', errorMessage + '\n\nCheck server or network connectivity.');
    }
  };

  return (
    <>
    <View style={styles.root}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
        translucent
        backgroundColor="#1E1F24"
      />

      <ImageBackground
        source={require('@/assets/backgrounds/Auth.png')}
        style={styles.bg}          
        resizeMode="cover"
      >
        <TopBarSecondary onBack={() => router.back()} title="Report a Lost Pet" />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <Text style={styles.heading}>REPORT{'\n'}your lost pet</Text>

            {/* Pet Name */}
            <Text style={styles.questionText}>What&apos;s your pet&apos;s name?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={petName}
              onChangeText={setPetName}
            />

            {/* Animal Type */}
            <Text style={styles.questionText}>What type of animal is it?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={animalType}
              onChangeText={setAnimalType}
            />

            {/* Breed */}
            <Text style={styles.questionText}>What breed is your pet?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={breed}
              onChangeText={setBreed}
            />

            {/* Last Seen Location */}
            <Text style={styles.questionText}>Where was your pet last seen?</Text>
            <View style={styles.locationInputContainer}>
              <TextInput
                style={[styles.textInput, styles.locationTextInput]}
                placeholder="Enter location or pick from map..."
                placeholderTextColor="#999"
                value={lastSeenLocation}
                onChangeText={setLastSeenLocation}
              />
              <TouchableOpacity
                style={styles.mapPickerButton}
                onPress={openMapPicker}
              >
                <Ionicons name="location" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Last Seen Date */}
            <Text style={styles.questionText}>When was your pet last seen?</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.datePickerText, !lastSeenDate && styles.datePickerPlaceholderText]}>
                {lastSeenDate ? lastSeenDate.toLocaleDateString() : 'Select date...'}
              </Text>
              <Ionicons name="calendar-outline" size={24} color="#23395B" />
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={lastSeenDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setLastSeenDate(selectedDate);
                  }
                }}
                maximumDate={new Date()}
              />
            )}

            {/* Reward */}
            <Text style={styles.questionText}>Are you offering a reward for your pet&apos;s return?</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionButton, hasReward === true && styles.optionButtonSelected]}
                onPress={() => setHasReward(true)}
              >
                <Text style={[styles.optionButtonText, hasReward === true && styles.optionButtonTextSelected]}>
                  YES
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, hasReward === false && styles.optionButtonSelected]}
                onPress={() => setHasReward(false)}
              >
                <Text style={[styles.optionButtonText, hasReward === false && styles.optionButtonTextSelected]}>
                  NO
                </Text>
              </TouchableOpacity>
            </View>

            {/* Distinctive Marks */}
            <Text style={styles.questionText}>Does your pet have any distinctive marks?</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionButton, hasDistinctiveMarks === true && styles.optionButtonSelected]}
                onPress={() => setHasDistinctiveMarks(true)}
              >
                <Text style={[styles.optionButtonText, hasDistinctiveMarks === true && styles.optionButtonTextSelected]}>
                  YES
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, hasDistinctiveMarks === false && styles.optionButtonSelected]}
                onPress={() => setHasDistinctiveMarks(false)}
              >
                <Text style={[styles.optionButtonText, hasDistinctiveMarks === false && styles.optionButtonTextSelected]}>
                  NO
                </Text>
              </TouchableOpacity>
            </View>

            {/* Distinctive Marks Description */}
            {hasDistinctiveMarks && (
              <>
                <Text style={styles.questionText}>If yes, what?</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter text..."
                  placeholderTextColor="#999"
                  value={distinctiveMarks}
                  onChangeText={setDistinctiveMarks}
                />
              </>
            )}

            {/* Additional Info */}
            <Text style={styles.questionText}>
              Can you describe how your pet got lost / any other helpful info?
            </Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
              numberOfLines={4}
            />

            {/* Photo Upload */}
            <Text style={styles.questionText}>
              Upload at least two photos of the animal from different angles:
            </Text>
            <TouchableOpacity style={styles.photoUploadBox} onPress={pickImage}>
              <View style={styles.photoUploadContent}>
                {photos.length === 0 ? (
                  <Ionicons name="add-circle-outline" size={60} color="#999" />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreviewScroll}>
                    {photos.map((uri, index) => (
                      <View key={index} style={styles.photoPreviewContainer}>
                        <Image source={{ uri }} style={styles.photoPreview} />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={() => removePhoto(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {photos.length < 5 && (
                      <TouchableOpacity style={styles.addMoreButton} onPress={pickImage}>
                        <Ionicons name="add-circle-outline" size={40} color="#999" />
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                )}
              </View>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>SUBMIT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ImageBackground>
    </View>
    {/* Map Picker Modal */}
    <Modal
      visible={showMapModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowMapModal(false)}
    >
      <View style={styles.mapModalOverlay}>
        <View style={styles.mapModalContent}>
          <Text style={styles.mapModalTitle}>Pick Last Seen Location</Text>
          <MapView
            style={styles.mapPicker}
            provider={PROVIDER_GOOGLE}
            region={mapRegion}
            showsUserLocation
            onPress={handleMapPress}
          >
            {tempMarker ? (
              <Marker coordinate={{ latitude: tempMarker.latitude, longitude: tempMarker.longitude }} pinColor="#23395B" />
            ) : null}
          </MapView>
          <View style={styles.mapModalButtons}>
            <TouchableOpacity
              style={[styles.mapActionButton, styles.mapCancelButton]}
              onPress={() => { setShowMapModal(false); setTempMarker(null); }}
            >
              <Text style={styles.mapActionText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapActionButton, !tempMarker && styles.mapActionButtonDisabled]}
              disabled={!tempMarker}
              onPress={confirmLocation}
            >
              <Text style={styles.mapActionText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.mapHelperText}>Tap on the map to place a marker.</Text>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bg: { 
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 24,
  },
  heading: {
    fontSize: 32,
    fontWeight: '600',
    color: '#23395B',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 40,
  },
  questionText: {
    fontSize: 16,
  color: '#D9D9D9',
    marginTop: 16,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#D9D9D9',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#333',
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  datePickerButton: {
    backgroundColor: '#D9D9D9',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 15,
    color: '#333',
  },
  datePickerPlaceholderText: {
    color: '#999',
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTextInput: {
    flex: 1,
  },
  mapPickerButton: {
    backgroundColor: '#23395B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#D9D9D9',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#23395B',
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#23395B',
  },
  optionButtonTextSelected: {
    color: '#FFFFFF',
  },
  photoUploadBox: {
    backgroundColor: '#D9D9D9',
    borderRadius: 12,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  photoUploadContent: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
  },
  photoPreviewScroll: {
    width: '100%',
  },
  photoPreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  addMoreButton: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#999',
    borderStyle: 'dashed',
  },
  submitButton: {
    backgroundColor: '#23395B',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#D9D9D9',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  // Map Modal Styles
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  mapModalContent: {
    backgroundColor: '#1E1F24',
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#D9D9D9',
    padding: 16,
    textAlign: 'center',
  },
  mapPicker: {
    height: 300,
    width: '100%',
  },
  mapModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  mapActionButton: {
    flex: 1,
    backgroundColor: '#23395B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  mapCancelButton: {
    backgroundColor: '#444',
  },
  mapActionButtonDisabled: {
    opacity: 0.5,
  },
  mapActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  mapHelperText: {
    fontSize: 12,
    color: '#999',
    paddingHorizontal: 16,
    paddingTop: 8,
    textAlign: 'center',
  },
});

