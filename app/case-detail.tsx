import TopBarSecondary from '@/components/TopBarSecondary';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

interface CaseData {
  _id: string;
  petName: string;
  animalType: string;
  breed?: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  hasReward?: boolean;
  hasDistinctiveMarks?: boolean;
  distinctiveMarks?: string;
  additionalInfo?: string;
  createdAt?: string;
  timestamp?: string;
}

export default function CaseDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ caseData?: string }>();
  const parsedCase: CaseData | null = useMemo(() => {
    try {
      return params.caseData ? JSON.parse(params.caseData) : null;
    } catch {
      return null;
    }
  }, [params.caseData]);

  const [region, setRegion] = useState<Region | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}min ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        // If we have case coordinates, center on them
        if (parsedCase?.latitude && parsedCase?.longitude) {
          if (!mounted) return;
          setRegion({
            latitude: parsedCase.latitude,
            longitude: parsedCase.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
          // done
          return;
        }

        // Otherwise center on current user location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!mounted) return;
          // Default to a generic region if permission denied
          setRegion({
            latitude: 37.78825,
            longitude: -122.4324,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
          // done
          return;
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!mounted) return;
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
  // done
  } catch {
        if (!mounted) return;
        setRegion({
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
  // done
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [parsedCase]);

  // Map tap should do nothing; modal opens only when pressing existing lost pet marker
  const handleMapPress = () => {
    // intentionally empty to prevent opening modal on any map tap
  };

  const closeModal = () => {
    setShowModal(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'}
        translucent
        backgroundColor="#1E1F24"
      />

      {/* Top Bar */}
      <View style={styles.topBarWrapper}>
        <TopBarSecondary onBack={() => router.back()} title="Case Detail" />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {region ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            region={region}
            showsUserLocation
            showsMyLocationButton
            onPress={handleMapPress}
          >
            {parsedCase?.latitude && parsedCase?.longitude ? (
              <Marker
                coordinate={{ latitude: parsedCase.latitude, longitude: parsedCase.longitude }}
                title={parsedCase?.petName || 'Last seen here'}
                description={parsedCase?.lastSeenLocation}
                onPress={() => {
                  setShowModal(true);
                }}
              />
            ) : null}
            {/* Removed temporary marker; we only show the original lost pet marker */}
          </MapView>
        ) : (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingOverlayText}>Loading map...</Text>
          </View>
        )}
      </View>
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalBadgeContainer} pointerEvents="none">
              <View style={styles.modalBadgeCircle}>
                <Image
                  source={require('../assets/icons/attention_gray.png')}
                  style={styles.modalBadgeIcon}
                />
              </View>
            </View>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal} style={styles.backButton}>
                <Text style={{ color: '#fff', fontSize: 28 }}>{'‹'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <Text style={styles.seenBadge}>
                SEEN: {parsedCase?.createdAt ? getTimeAgo(parsedCase.createdAt) : parsedCase?.timestamp ? getTimeAgo(parsedCase.timestamp) : '2h ago'}
              </Text>
            </View>
            <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
              {/* Name */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>NAME:</Text>
                <Text style={styles.detailValue}>{parsedCase?.petName}</Text>
              </View>

              {/* Lost Location */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>LOST LOCATION:</Text>
                <Text style={styles.detailValue}>{parsedCase?.lastSeenLocation}</Text>
              </View>

              {/* Date */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DATE:</Text>
                <Text style={styles.detailValue}>
                  {parsedCase?.lastSeenDate ? formatDate(parsedCase.lastSeenDate) : 'N/A'}
                </Text>
              </View>

              {/* Breed */}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>BREED:</Text>
                <Text style={styles.detailValue}>
                  {parsedCase?.breed && parsedCase?.animalType 
                    ? `${parsedCase.breed} ${parsedCase.animalType}` 
                    : parsedCase?.breed || parsedCase?.animalType || 'N/A'}
                </Text>
              </View>

              {/* Distinctive Marks */}
              {parsedCase?.hasDistinctiveMarks && parsedCase?.distinctiveMarks && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DISTINCTIVE MARKS:</Text>
                  <Text style={styles.detailValue}>{parsedCase.distinctiveMarks}</Text>
                </View>
              )}

              {/* Reward */}
              {parsedCase?.hasReward && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>REWARD:</Text>
                  <Text style={styles.detailValue}>100 Euros</Text>
                </View>
              )}

              {/* Description */}
              {parsedCase?.additionalInfo && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DESCRIPTION:</Text>
                  <Text style={styles.detailValue}>{parsedCase.additionalInfo}</Text>
                </View>
              )}

              {/* Contact */}
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

              {/* Photo Gallery */}
              <Text style={styles.detailLabel}>PHOTO GALLERY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
                {parsedCase?.photos && parsedCase.photos.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.galleryPhoto} />
                ))}
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  mapContainer: {
    flex: 1,
    zIndex: 1,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlayText: {
    color: '#FFFFFF',
    marginTop: 12,
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
    flex: 1,
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
  contactButtonSingle: {
    backgroundColor: '#E5E5EA',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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
  modalBadgeContainer: {
    position: 'absolute',
    top: -28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  modalBadgeCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1E1F24',
    borderWidth: 3,
    borderColor: '#1E1F24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBadgeIcon: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    tintColor: '#CDC1FF',
  },
  infoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  petName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  locationText: {
    color: '#D9D9D9',
    fontSize: 12,
    marginTop: 2,
  },
});
