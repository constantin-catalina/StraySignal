import TopBarSecondary from '@/components/TopBarSecondary';
import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';

interface LostPetReport {
  _id: string;
  latitude: number;
  longitude: number;
  petName?: string;
  animalType: string;
  reportType: string;
  timestamp: string;
  createdAt: string;
}

interface CheckedSighting {
  _id: string;
  latitude: number;
  longitude: number;
  checkedAt: string;
  timestamp: string;
  createdAt: string;
}

export default function PetRoute() {
  const router = useRouter();
  const { user } = useUser();
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [lostPetReports, setLostPetReports] = useState<LostPetReport[]>([]);
  const [checkedSightings, setCheckedSightings] = useState<CheckedSighting[]>([]);
  const [loading, setLoading] = useState(true);

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
          const checkedMatches = matchesData.data
            .filter((match: any) => match.checked && match.spottedReportId)
            .map((match: any) => ({
              _id: match.spottedReportId._id,
              latitude: match.spottedReportId.latitude,
              longitude: match.spottedReportId.longitude,
              checkedAt: match.checkedAt,
              timestamp: match.spottedReportId.timestamp,
              createdAt: match.spottedReportId.createdAt,
            }));
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
        timestamp: new Date(r.timestamp || r.createdAt).getTime()
      })),
      ...checkedSightings.map(s => ({ 
        latitude: s.latitude, 
        longitude: s.longitude,
        timestamp: new Date(s.timestamp || s.createdAt).getTime()
      }))
    ];
    
    // Sort by timestamp (earliest first)
    allPoints.sort((a, b) => a.timestamp - b.timestamp);
    
    // Return just the coordinates in chronological order
    return allPoints.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
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
});
