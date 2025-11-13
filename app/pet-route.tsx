import TopBarSecondary from '@/components/TopBarSecondary';
import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LostPetReport {
  _id: string;
  latitude: number;
  longitude: number;
  petName?: string;
  animalType?: string;
  reportType: string;
  timestamp?: string;
  createdAt?: string;
}

interface CheckedSighting {
  _id: string;
  latitude: number;
  longitude: number;
  checkedAt: Date;
  timestamp?: string;
  createdAt?: string;
  address?: string;
  petName?: string;
}

interface CombinedMarker {
  _id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  type: 'lost' | 'sighting';
  petName?: string;
  animalType?: string;
  address?: string;
  checkedAt?: Date;
  createdAt?: string;
}

export default function PetRoute() {
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [lostPetReports, setLostPetReports] = useState<LostPetReport[]>([]);
  const [checkedSightings, setCheckedSightings] = useState<CheckedSighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        setLoading(false);
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
      }
    })();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchPetRouteData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchPetRouteData = async () => {
    try {
      setLoading(true);
      
      // Fetch lost pet reports owned by the current user
      const reportsResponse = await fetch(API_ENDPOINTS.REPORTS);
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        if (reportsData.success && reportsData.data) {
          const userLostPets = reportsData.data.filter(
            (report: any) => 
              report.reportType === 'lost-from-home' && 
              report.reportedBy === user?.id
          );
          setLostPetReports(userLostPets);
          
          // Center map on first lost pet if available
          if (userLostPets.length > 0) {
            setRegion({
              latitude: userLostPets[0].latitude,
              longitude: userLostPets[0].longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          }
        }
      }

      // Fetch checked sightings (matches that have been checked)
      const matchesResponse = await fetch(`${API_ENDPOINTS.MATCHES}/user/${user?.id}`);
      if (matchesResponse.ok) {
        const matchesData = await matchesResponse.json();
        if (matchesData.success && matchesData.data) {
          const checkedMatches = await Promise.all(
            matchesData.data
              .filter((match: any) => match.checked && match.spottedReportId)
              .map(async (match: any) => {
                // Get address for this sighting
                let address = 'Unknown location';
                try {
                  const results = await Location.reverseGeocodeAsync({
                    latitude: match.spottedReportId.latitude,
                    longitude: match.spottedReportId.longitude,
                  });
                  if (results.length > 0) {
                    const r = results[0];
                    address = `${r.street || ''}, ${r.city || ''}`.trim().replace(/^,\s*/, '');
                  }
                } catch (err) {
                  console.log('Error getting address:', err);
                }

                return {
                  _id: match.spottedReportId._id,
                  latitude: match.spottedReportId.latitude,
                  longitude: match.spottedReportId.longitude,
                  checkedAt: match.checkedAt,
                  timestamp: match.spottedReportId.timestamp,
                  createdAt: match.spottedReportId.createdAt,
                  address,
                  petName: match.lostPetId?.petName || 'Unknown',
                };
              })
          );
          setCheckedSightings(checkedMatches);
        }
      }
    } catch (error) {
      console.error('Error fetching pet route data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create polyline coordinates sorted by report time (chronological order)
  const getPolylineCoordinates = () => {
    // Combine all points with their timestamps
    const allPoints = [
      ...lostPetReports.map(r => ({ 
        latitude: r.latitude, 
        longitude: r.longitude,
        timestamp: new Date(r.timestamp || r.createdAt || Date.now()).getTime()
      })),
      ...checkedSightings.map(s => ({ 
        latitude: s.latitude, 
        longitude: s.longitude,
        timestamp: new Date(s.timestamp || s.createdAt || Date.now()).getTime()
      }))
    ];
    
    // Sort by timestamp (earliest first)
    allPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    // Return just the coordinates in chronological order
    return allPoints.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
  };

  // Get combined markers sorted by timestamp (newest first for modal)
  const getCombinedMarkers = (): CombinedMarker[] => {
    const markers: CombinedMarker[] = [
      ...lostPetReports.map(r => ({
        _id: r._id,
        latitude: r.latitude,
        longitude: r.longitude,
        timestamp: new Date(r.timestamp || r.createdAt || Date.now()).getTime(),
        type: 'lost' as const,
        petName: r.petName,
        animalType: r.animalType,
        createdAt: r.createdAt,
      })),
      ...checkedSightings.map(s => ({
        _id: s._id,
        latitude: s.latitude,
        longitude: s.longitude,
        timestamp: new Date(s.timestamp || s.createdAt || Date.now()).getTime(),
        type: 'sighting' as const,
        petName: s.petName || 'Unknown',
        address: s.address,
        checkedAt: s.checkedAt,
        createdAt: s.createdAt,
      }))
    ];

    // Sort by timestamp, newest first
    markers.sort((a, b) => b.timestamp - a.timestamp);
    return markers;
  };

  const handleMarkerPress = (marker: CombinedMarker) => {
    try {
      router.push({
        pathname: '/marker-detail',
        params: {
          id: marker._id,
          lat: marker.latitude.toString(),
          lng: marker.longitude.toString(),
          type: marker.type,
          petName: marker.petName || '',
          ts: marker.timestamp.toString(),
          address: marker.address || '',
        },
      });
    } catch (e) {
      console.log('Navigation error:', e);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      <TopBarSecondary 
        onBack={() => router.back()} 
        showRightDots={true}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#81ADC8" />
          <Text style={styles.loadingText}>Loading pet route...</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region}
          region={region}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {/* Blue markers for lost pet reports (owner's report) */}
          {lostPetReports.map((report) => (
            <Marker
              key={`lost-${report._id}`}
              coordinate={{
                latitude: report.latitude,
                longitude: report.longitude,
              }}
              pinColor="#007AFF"
              title={report.petName || 'Lost Pet'}
              description={`Lost ${report.animalType}`}
            />
          ))}

          {/* White markers for checked sightings */}
          {checkedSightings.map((sighting) => (
            <Marker
              key={`checked-${sighting._id}`}
              coordinate={{
                latitude: sighting.latitude,
                longitude: sighting.longitude,
              }}
              pinColor="#81ADC8"
              title="Sighting"
              description="Checked sighting"
            />
          ))}

          {/* Draw polyline connecting the points if there are multiple */}
          {(lostPetReports.length + checkedSightings.length) > 1 && (
            <Polyline
              coordinates={getPolylineCoordinates()}
              strokeColor="#D9D9D9"
              strokeWidth={3}
            />
          )}
        </MapView>
      )}

      {/* Bottom Modal with Last Seen History */}
      {!loading && (lostPetReports.length > 0 || checkedSightings.length > 0) && (
        <View style={[styles.modalContainer, { paddingBottom: insets.bottom }]}>
          <TouchableOpacity 
            style={styles.modalHeader}
            onPress={() => setModalVisible(!modalVisible)}
          >
            <Ionicons 
              name={modalVisible ? 'chevron-down' : 'chevron-up'} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.modalTitle}>LAST SEEN HISTORY</Text>
          </TouchableOpacity>
          
          {modalVisible && (
            <ScrollView style={styles.modalContent}>
              {getCombinedMarkers().map((marker, index) => (
                <TouchableOpacity
                  key={`${marker.type}-${marker._id}-${index}`}
                  style={styles.historyItem}
                  activeOpacity={0.7}
                  onPress={() => handleMarkerPress(marker)}
                >
                  <View
                    style={[
                      styles.markerIndicator,
                      { backgroundColor: marker.type === 'lost' ? '#007AFF' : '#81ADC8' },
                    ]}
                  />
                  <View style={styles.historyDetails}>
                    <Text style={styles.historyTitle}>
                      {marker.type === 'lost'
                        ? `${marker.petName || 'Lost Pet'} - Initial Report`
                        : `${marker.petName || 'Unknown'} - Sighting`}
                    </Text>
                    <Text style={styles.historyDate}>{formatDate(marker.timestamp)}</Text>
                    {marker.address && (
                      <Text style={styles.historyAddress}>{marker.address}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2C3544',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2C3544',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E1F24',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  modalContent: {
    maxHeight: 300,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2C3544',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  markerIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
  },
  historyDetails: {
    flex: 1,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyDate: {
    color: '#81ADC8',
    fontSize: 14,
    marginBottom: 4,
  },
  historyAddress: {
    color: '#9CA3AF',
    fontSize: 13,
  },
});
