import TopBar from '@/components/TopBar';
import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

interface AnimalMarker {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  reportedBy?: string; // User ID of the reporter
  details?: {
    time: string;
    animalType: string;
    direction: string;
    injured: boolean;
    photos: string[];
    additionalInfo: string;
    reportType: 'lost-from-home' | 'spotted-on-streets';
    // Lost pet specific optional fields populated when reportType === 'lost-from-home'
    petName?: string;
    breed?: string;
    lastSeenLocation?: string;
    lastSeenDate?: string; // ISO string for consistency on client
    hasReward?: boolean;
    hasDistinctiveMarks?: boolean;
    distinctiveMarks?: string;
    createdAt?: string;
    timestamp?: string;
  };
}

export default function Signal() {
  const router = useRouter();
  const { user } = useUser();
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [markers, setMarkers] = useState<AnimalMarker[]>([]);
  const [isReportMode, setIsReportMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentMarker, setCurrentMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  // Lost pet detail modal state (for existing blue markers)
  const [showLostModal, setShowLostModal] = useState(false);
  const [selectedLostMarker, setSelectedLostMarker] = useState<AnimalMarker | null>(null);
  // Spotted detail modal state (for existing green markers)
  const [showSpottedModal, setShowSpottedModal] = useState(false);
  const [selectedSpottedMarker, setSelectedSpottedMarker] = useState<AnimalMarker | null>(null);
  
  // Form state
  const [selectedTime, setSelectedTime] = useState('NOW');
  const [animalType, setAnimalType] = useState('DOG');
  const [direction, setDirection] = useState('');
  const [injured, setInjured] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [reportType, setReportType] = useState<'lost-from-home' | 'spotted-on-streets'>('spotted-on-streets');

  useEffect(() => {
    (async () => {
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to show your position on the map.'
        );
        return;
      }

      // Get current location
      try {
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Could not fetch your location.');
      }

      // Fetch existing reports from database (Atlas-backed server)
      try {
        const response = await fetch(API_ENDPOINTS.REPORTS);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            console.log(`Current user ID: ${user?.id}`);
            console.log(`Total reports from server: ${data.data.length}`);
            
            // Map all reports and preserve server-provided reportType
            const loadedMarkers: AnimalMarker[] = data.data
              .filter((report: any) => typeof report.latitude === 'number' && typeof report.longitude === 'number')
              .filter((report: any) => {
                // Show all lost pet reports (blue markers) to everyone
                if (report.reportType === 'lost-from-home') {
                  console.log(`Lost pet report ${report._id} - showing to all users`);
                  return true;
                }
                // Only show spotted reports (green markers) to the user who created them
                if (report.reportType === 'spotted-on-streets') {
                  const shouldShow = report.reportedBy === user?.id;
                  console.log(`Spotted report ${report._id} - reportedBy: ${report.reportedBy}, current user: ${user?.id}, showing: ${shouldShow}`);
                  return shouldShow;
                }
                return true;
              })
              .map((report: any) => ({
                id: report._id,
                coordinate: {
                  latitude: report.latitude,
                  longitude: report.longitude,
                },
                reportedBy: report.reportedBy,
                details: {
                  time: report.time ?? report.lastSeenDate ?? '',
                  animalType: report.animalType ?? 'PET',
                  direction: report.direction ?? '',
                  injured: !!report.injured,
                  photos: report.photos || [],
                  additionalInfo: report.additionalInfo ?? '',
                  reportType: (report.reportType as 'lost-from-home' | 'spotted-on-streets') || 'spotted-on-streets',
                  // Lost pet case fields
                  petName: report.petName,
                  breed: report.breed,
                  lastSeenLocation: report.lastSeenLocation,
                  lastSeenDate: report.lastSeenDate,
                  hasReward: report.hasReward,
                  hasDistinctiveMarks: report.hasDistinctiveMarks,
                  distinctiveMarks: report.distinctiveMarks,
                  createdAt: report.createdAt,
                  timestamp: report.timestamp || report.createdAt,
                },
              }));
            setMarkers(loadedMarkers);
            console.log(`Loaded ${loadedMarkers.length} visible reports (after filtering)`);
          }
        }
      } catch (error) {
        console.error('Error loading reports:', error);
        // Don't show alert here, fail silently to not interrupt user experience
      }
    })();
  }, [user?.id]);

  const handleMapPress = (event: any) => {
    // Always place a marker and open the report form on map tap
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setCurrentMarker({ latitude, longitude });
    setShowModal(true);
    setIsReportMode(false);
  };

  const pickImage = async () => {
    // Show action sheet to choose between camera or gallery
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            // Request camera permission
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'We need camera permissions to take photos.');
              return;
            }

            // Launch camera
            let result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
              allowsEditing: true,
            });

            if (!result.canceled && result.assets) {
              const newPhotos = result.assets.map(asset => asset.uri);
              setPhotos([...photos, ...newPhotos]);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            // Request gallery permission
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'We need camera roll permissions to upload photos.');
              return;
            }

            // Launch image picker
            let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsMultipleSelection: true,
              quality: 0.8,
            });

            if (!result.canceled && result.assets) {
              const newPhotos = result.assets.map(asset => asset.uri);
              setPhotos([...photos, ...newPhotos]);
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

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmitReport = async () => {
    if (!currentMarker) return;
    
    if (injured === null) {
      Alert.alert('Missing Information', 'Please indicate if the animal appears injured.');
      return;
    }

    if (photos.length === 0) {
      Alert.alert('Missing Photo', 'Please upload at least one photo of the animal.');
      return;
    }

    try {
      // Convert photos to base64 for ML processing
      console.log('Converting photos to base64...');
      console.log('Current user ID:', user?.id);
      const base64Photos = await Promise.all(
        photos.map(async (uri) => {
          try {
            const base64 = await FileSystem.readAsStringAsync(uri, {
              encoding: 'base64',
            });
            return `data:image/jpeg;base64,${base64}`;
          } catch (error) {
            console.error('Error converting photo to base64:', error);
            return uri; // Fallback to original URI
          }
        })
      );
      console.log(`Converted ${base64Photos.length} photos to base64`);

      const reportData = {
        latitude: currentMarker.latitude,
        longitude: currentMarker.longitude,
        time: selectedTime,
        animalType,
        direction,
        injured,
        photos: base64Photos, // Use base64 encoded photos
        additionalInfo,
        reportType,
        timestamp: new Date().toISOString(),
        reportedBy: user?.id || 'anonymous', // Add user ID to identify reporter
      };
      
      console.log('Submitting report with reportedBy:', reportData.reportedBy);

      const response = await fetch(API_ENDPOINTS.REPORTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      const result = await response.json();
      const reportId = result.data?._id || result.id;

      const newMarker: AnimalMarker = {
        id: reportId || Date.now().toString(),
        coordinate: currentMarker,
        reportedBy: user?.id || 'anonymous',
        details: {
          time: selectedTime,
          animalType,
          direction,
          injured,
          photos,
          additionalInfo,
          reportType,
        },
      };

      setMarkers([...markers, newMarker]);

      // Trigger ML matching for spotted animals
      if (reportType === 'spotted-on-streets' && reportId) {
        console.log('Triggering ML matching for report:', reportId);
        console.log('ML endpoint:', `${API_ENDPOINTS.MATCHES}/process/${reportId}`);
        try {
          // Fire and forget - don't wait for ML processing to complete
          const mlResponse = await fetch(`${API_ENDPOINTS.MATCHES}/process/${reportId}`, {
            method: 'POST',
          });
          console.log('ML matching response status:', mlResponse.status);
          const mlResult = await mlResponse.json();
          console.log('ML matching result:', mlResult);
        } catch (err) {
          console.error('ML matching error:', err);
          // Don't show error to user - ML matching is a background process
        }
      }
      
      // Reset form
      setShowModal(false);
      setCurrentMarker(null);
      setSelectedTime('NOW');
      setAnimalType('DOG');
      setDirection('');
      setInjured(null);
      setPhotos([]);
      setAdditionalInfo('');
      setReportType('spotted-on-streets');
      
      Alert.alert('Success', 'Animal sighting reported successfully!');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setCurrentMarker(null);
    setSelectedTime('NOW');
    setAnimalType('DOG');
    setDirection('');
    setInjured(null);
    setPhotos([]);
    setAdditionalInfo('');
    setReportType('spotted-on-streets');
  };

  const goToCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not fetch your location.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Google Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onPress={handleMapPress}
      >
        {/* Display all reported markers with custom green pin */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            pinColor={marker.details?.reportType === 'lost-from-home' ? '#23395B' : '#668586'}
            onPress={() => {
              if (marker.details?.reportType === 'lost-from-home') {
                setSelectedLostMarker(marker);
                setShowLostModal(true);
              } else if (marker.details?.reportType === 'spotted-on-streets') {
                setSelectedSpottedMarker(marker);
                setShowSpottedModal(true);
              }
            }}
          />
        ))}
        
        {/* Temporary marker while in report mode */}
        {currentMarker && showModal && (
          <Marker 
            coordinate={currentMarker}
            pinColor={reportType === 'lost-from-home' ? '#23395B' : '#668586'}
          />
        )}
      </MapView>

      {/* TopBar overlaid on top of the map */}
      <View style={styles.topBarOverlay} pointerEvents="box-none">
        <TopBar onBack={() => router.back()} />
      </View>

      {/* Current Location Button */}
      <TouchableOpacity
        style={styles.currentLocationButton}
        onPress={goToCurrentLocation}
        activeOpacity={0.8}
      >
        <Ionicons name="locate" size={24} color="#1E1F24" />
      </TouchableOpacity>

      {/* Report Button */}
      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setIsReportMode(!isReportMode)}
        activeOpacity={0.8}
      >
        <View style={styles.reportButtonContent}>
          <Image 
            source={require('../../assets/icons/attention_gray.png')} 
            style={styles.attentionIcon}
          />
          <View style={styles.reportTextContainer}>
            <Text style={styles.reportTitle}>Report a lost animal</Text>
            <Text style={styles.reportSubtitle}>
              {isReportMode ? 'Tap on the map to mark location' : 'Click on the map and select the place where you have seen a stray animal.'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Report Details Modal */}
      {/* Spotted/Lost sighting creation modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Top center badge icon */}
            <View style={styles.modalBadgeContainer} pointerEvents="none">
              <View style={styles.modalBadgeCircle}>
                <Image
                  source={require('../../assets/icons/attention_gray.png')}
                  style={styles.modalBadgeIcon}
                />
              </View>
            </View>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={resetForm} style={styles.backButton}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Report Sighting</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              {/* Time Selection */}
              <Text style={styles.questionText}>When did you see the animal?</Text>
              <View style={styles.buttonRow}>
                {['NOW', '5 min ago', '15 min ago', '1 hour ago', 'Other...'].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[styles.optionButton, selectedTime === time && styles.optionButtonSelected]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text style={[styles.optionButtonText, selectedTime === time && styles.optionButtonTextSelected]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Animal Type Selection */}
              <Text style={styles.questionText}>What kind of animal was it?</Text>
              <View style={styles.buttonRow}>
                {['DOG', 'CAT', 'Other...'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.optionButton, animalType === type && styles.optionButtonSelected]}
                    onPress={() => setAnimalType(type)}
                  >
                    <Text style={[styles.optionButtonText, animalType === type && styles.optionButtonTextSelected]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Direction Input */}
              <Text style={styles.questionText}>Which direction was it heading?</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter text..."
                placeholderTextColor="#666"
                value={direction}
                onChangeText={setDirection}
              />

              {/* Injured Status */}
              <Text style={styles.questionText}>Did the animal appear injured?</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.optionButton, injured === true && styles.optionButtonSelected]}
                  onPress={() => setInjured(true)}
                >
                  <Text style={[styles.optionButtonText, injured === true && styles.optionButtonTextSelected]}>
                    YES
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, injured === false && styles.optionButtonSelected]}
                  onPress={() => setInjured(false)}
                >
                  <Text style={[styles.optionButtonText, injured === false && styles.optionButtonTextSelected]}>
                    NO
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Photo Upload */}
              <Text style={styles.questionText}>Upload at least one photo of the animal</Text>
              <TouchableOpacity style={styles.photoUploadBox} onPress={pickImage}>
                <View style={styles.photoUploadContent}>
                  {photos.length === 0 ? (
                    <>
                      <Ionicons name="add-circle-outline" size={40} color="#666" />
                      <Text style={styles.photoUploadText}>Tap to add photos</Text>
                    </>
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
                      <TouchableOpacity style={styles.addMoreButton} onPress={pickImage}>
                        <Ionicons name="add-circle-outline" size={32} color="#5F9EA0" />
                      </TouchableOpacity>
                    </ScrollView>
                  )}
                </View>
              </TouchableOpacity>

              {/* Additional Information */}
              <Text style={styles.questionText}>Additional information</Text>
              <TextInput
                style={[styles.textInput, styles.textInputMultiline]}
                placeholder="Enter text..."
                placeholderTextColor="#666"
                value={additionalInfo}
                onChangeText={setAdditionalInfo}
                multiline
                numberOfLines={4}
              />

              {/* Submit Button */}
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmitReport}>
                <Text style={styles.submitButtonText}>POST</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Lost pet detail modal (blue marker press) */}
      <LostPetDetailModal
        visible={showLostModal}
        onClose={() => {
          setShowLostModal(false);
          setSelectedLostMarker(null);
        }}
        marker={selectedLostMarker}
      />
      <SpottedDetailModal
        visible={showSpottedModal}
        onClose={() => {
          setShowSpottedModal(false);
          setSelectedSpottedMarker(null);
        }}
        marker={selectedSpottedMarker}
        onDeleted={(id) => {
          setMarkers((prev) => prev.filter((m) => m.id !== id));
          setShowSpottedModal(false);
          setSelectedSpottedMarker(null);
        }}
      />
    </View>
  );
}

// Reuse formatting utilities from case-detail (could be extracted later)
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' 
    : day === 2 || day === 22 ? 'nd'
    : day === 3 || day === 23 ? 'rd' : 'th';
  return `${months[date.getMonth()]} ${day}${suffix} ${date.getFullYear()}`;
};

const getTimeAgo = (dateString?: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 60) return `${diffMins}min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

interface LostPetDetailModalProps {
  visible: boolean;
  onClose: () => void;
  marker: AnimalMarker | null;
}

const LostPetDetailModal: React.FC<LostPetDetailModalProps> = ({ visible, onClose, marker }) => {
  const lost = marker?.details;
  // Only render when the marker is for a lost pet; otherwise, this modal won't be shown
  if (!visible) return null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Purple badge */}
          <View style={styles.modalBadgeContainer} pointerEvents="none">
            <View style={[styles.modalBadgeCircle, { borderColor: '#1E1F24' }] }>
              <Image source={require('../../assets/icons/attention_gray.png')} style={[styles.modalBadgeIcon, { tintColor: '#CDC1FF' }]} />
            </View>
          </View>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={styles.seenBadge}>SEEN: {getTimeAgo(lost?.createdAt || lost?.timestamp)}</Text>
          </View>
          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            {/* NAME */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>NAME:</Text>
              <Text style={styles.detailValue}>{lost?.petName || 'N/A'}</Text>
            </View>
            {/* LOST LOCATION */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>LOST LOCATION:</Text>
              <Text style={styles.detailValue}>{lost?.lastSeenLocation || 'N/A'}</Text>
            </View>
            {/* DATE */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>DATE:</Text>
              <Text style={styles.detailValue}>{lost?.lastSeenDate ? formatDate(lost.lastSeenDate) : 'N/A'}</Text>
            </View>
            {/* BREED */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>BREED:</Text>
              <Text style={styles.detailValue}>{lost?.breed && lost?.animalType ? `${lost.breed} ${lost.animalType}` : lost?.breed || lost?.animalType || 'N/A'}</Text>
            </View>
            {/* DISTINCTIVE MARKS */}
            {lost?.hasDistinctiveMarks && lost?.distinctiveMarks ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DISTINCTIVE MARKS:</Text>
                <Text style={styles.detailValue}>{lost.distinctiveMarks}</Text>
              </View>
            ) : null}
            {/* REWARD */}
            {lost?.hasReward ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>REWARD:</Text>
                <Text style={styles.detailValue}>100 Euros</Text>
              </View>
            ) : null}
            {/* DESCRIPTION */}
            {lost?.additionalInfo ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DESCRIPTION:</Text>
                <Text style={styles.detailValue}>{lost.additionalInfo}</Text>
              </View>
            ) : null}
            {/* CONTACT */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>CONTACT:</Text>
              <View style={styles.contactButtons}>
                <TouchableOpacity style={styles.contactButton}>
                  <Text style={styles.contactButtonText}>CHAT with owner</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactButton}>
                  <Text style={styles.contactButtonText}>CALL owner</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* PHOTO GALLERY */}
            <Text style={styles.detailLabel}>PHOTO GALLERY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
              {lost?.photos && lost.photos.length > 0 ? (
                lost.photos.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.galleryPhoto} />
                ))
              ) : (
                <Text style={[styles.detailValue, { marginTop: 8 }]}>No photos available</Text>
              )}
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

interface SpottedDetailModalProps {
  visible: boolean;
  onClose: () => void;
  marker: AnimalMarker | null;
  onDeleted?: (id: string) => void;
}

const SpottedDetailModal: React.FC<SpottedDetailModalProps> = ({ visible, onClose, marker, onDeleted }) => {
  const spotted = marker?.details;
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAddress = async () => {
      if (visible && marker?.coordinate) {
        try {
          setResolvedAddress(null);
          const results = await Location.reverseGeocodeAsync(marker.coordinate);
            if (!cancelled && results.length > 0) {
              const r = results[0];
              // Build address parts, prioritizing street and city, skipping name if it's just a number
              const parts = [];
              if (r.street) parts.push(r.street);
              if (r.city) parts.push(r.city);
              // Only add name if it's not purely numeric
              if (r.name && !/^\d+$/.test(r.name.trim())) {
                parts.unshift(r.name);
              }
              const formatted = parts.filter(Boolean).join(', ');
              if (formatted) setResolvedAddress(formatted);
            }
        } catch {
          // silent fail, we'll fallback to coordinates
        }
      }
    };
    fetchAddress();
    return () => { cancelled = true; };
  }, [visible, marker]);
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalBadgeContainer} pointerEvents="none">
            <View style={[styles.modalBadgeCircle, { borderColor: '#1E1F24' }] }>
              <Image source={require('../../assets/icons/attention_gray.png')} style={[styles.modalBadgeIcon, { tintColor: '#81ADC8' }]} />
            </View>
          </View>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={styles.seenBadgeSpotted}>SEEN: {getTimeAgo(spotted?.createdAt || spotted?.timestamp)}</Text>
          </View>
          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            {/* Action buttons row (CHECK placeholder + SEEN badge already above) */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>LOCATION:</Text>
              <Text style={styles.detailValue}>{
                resolvedAddress || (marker?.coordinate ? `${marker.coordinate.latitude.toFixed(5)}, ${marker.coordinate.longitude.toFixed(5)}` : 'N/A')
              }</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>INJURED:</Text>
              <Text style={styles.detailValue}>{spotted?.injured ? 'YES' : 'NO'}</Text>
            </View>
            {spotted?.additionalInfo ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DESCRIPTION:</Text>
                <Text style={styles.detailValue}>{spotted.additionalInfo}</Text>
              </View>
            ) : null}
            {spotted?.direction ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DIRECTION:</Text>
                <Text style={styles.detailValue}>{spotted.direction}</Text>
              </View>
            ) : null}
            <Text style={styles.detailLabel}>PHOTO GALLERY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
              {spotted?.photos && spotted.photos.length > 0 ? (
                spotted.photos.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.galleryPhoto} />
                ))
              ) : (
                <Text style={[styles.detailValue, { marginTop: 8 }]}>No photos available</Text>
              )}
            </ScrollView>
            {marker?.id && onDeleted && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={async () => {
                  try {
                    const res = await fetch(`${API_ENDPOINTS.REPORTS}/${marker.id}`, { method: 'DELETE' });
                    if (res.ok) {
                      onDeleted(marker.id);
                    } else {
                      Alert.alert('Delete Failed', 'Could not delete report.');
                    }
                  } catch {
                    Alert.alert('Error', 'Network error deleting report.');
                  }
                }}
              >
                <Ionicons name="trash" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>Delete report</Text>
              </TouchableOpacity>
            )}
            {/* Extra bottom padding for delete button visibility */}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  topBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  currentLocationButton: {
    position: 'absolute',
    top: 120,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5F9EA0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  reportButton: {
    position: 'absolute',
    bottom: 56,
    left: 20,
    right: 20,
    backgroundColor: '#5F9EA0',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  reportButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attentionIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  reportTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E1F24',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 12,
    color: 'white',
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1F24',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 20,
    paddingTop: 10,
    position: 'relative',
  },
  detailsContainer: {
    padding: 20,
  },
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 14,
    color: '#D9D9D9',
    lineHeight: 20,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#E5E5EA',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  photoGallery: {
    marginTop: 12,
    marginBottom: 20,
  },
  galleryPhoto: {
    width: 150,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#b82b24ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  seenBadge: {
    backgroundColor: '#CDC1FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  seenBadgeSpotted: {
    backgroundColor: '#81ADC8',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  formContainer: {
    padding: 20,
  },
  questionText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  optionButton: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#5F9EA0',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  optionButtonTextSelected: {
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 16,
  },
  textInputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#5F9EA0',
    borderRadius: 25,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  photoUploadBox: {
    backgroundColor: '#3A3A3C',
    borderRadius: 8,
    minHeight: 120,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  photoUploadContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  photoPreviewScroll: {
    width: '100%',
  },
  photoPreviewContainer: {
    position: 'relative',
    marginRight: 8,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  addMoreButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#5F9EA0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal badge styles
  modalBadgeContainer: {
    position: 'absolute',
    top: -28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  modalBadgeCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#1E1F24',
    borderWidth: 3,
    borderColor: '#1E1F24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBadgeIcon: {
    width: 54,
    height: 54,
    resizeMode: 'contain',
    tintColor: '#5F9EA0',
  },
  // Custom photo pin styles
  photoPinContainer: {
    alignItems: 'center',
  },
  photoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#1E1F24',
    borderWidth: 2,
    borderColor: '#5F9EA0',
  },
  photoCircleImage: {
    width: '50%',
    height: '50%',
    resizeMode: 'cover',
    borderRadius: 36,
  },
  pinStick: {
    width: 4,
    height: 28,
    backgroundColor: '#1E1F24',
    opacity: 0.85,
  },
  pinShadow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 4,
  },
  tempMarkerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#5F9EA0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
  },
  tempMarkerIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    tintColor: '#1E1F24',
  },
  // Green circle marker styles for saved reports
  greenCircleContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#5F9EA0',
    borderWidth: 3,
    borderColor: '#5F9EA0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCircleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 32,
  },
  greenCirclePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#5F9EA0',
  },
  customMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
