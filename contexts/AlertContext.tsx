import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface InjuredAnimalAlert {
  id: string;
  type: 'injured' | 'high-match' | 'moderate-match';
  animalType: string;
  location: string;
  distance: number;
  timeAgo: string;
  latitude: number;
  longitude: number;
  matchScore?: number;
  matchedPetName?: string;
  matchedPetId?: string;
  reportId?: string; // The actual report ID for fetching full details
}

interface AlertContextType {
  alerts: InjuredAnimalAlert[];
  loading: boolean;
  refreshAlerts: () => Promise<void>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const [alerts, setAlerts] = useState<InjuredAnimalAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const reportTime = new Date(timestamp);
    const diffMs = now.getTime() - reportTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const checkForInjuredAnimals = useCallback(async () => {
    if (!user?.id || !locationEnabled) return;
    
    try {
      setLoading(true);
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const userLat = location.coords.latitude;
      const userLon = location.coords.longitude;

      const storageKey = `user_profile_data:${user.id}`;
      const profileData = await AsyncStorage.getItem(storageKey);
      let radiusPreference = 2;
      
      if (profileData) {
        const parsed = JSON.parse(profileData);
        radiusPreference = parsed.radiusPreference || 2;
      }

      // Fetch all data in parallel
      const [reportsResponse, matchesResponse] = await Promise.all([
        fetch(API_ENDPOINTS.REPORTS),
        fetch(`${API_ENDPOINTS.MATCHES}/user/${user.id}`).catch(() => null),
      ]);

      if (!reportsResponse.ok) {
        throw new Error('Failed to fetch reports');
      }

      const reportsData = await reportsResponse.json();
      const nearbyAlerts: InjuredAnimalAlert[] = [];

      if (reportsData.success && reportsData.data) {
        const allReports = reportsData.data;
        
        // First, collect all matched report IDs from ML matches
        const matchedReportIds = new Set<string>();
        
        // Check for ML-based matches from backend first
        if (matchesResponse && matchesResponse.ok) {
          const matchesData = await matchesResponse.json();
          console.log('Fetched matches data:', matchesData);
          
          if (matchesData.success && matchesData.data) {
            console.log(`Found ${matchesData.data.length} matches for user`);
            for (const match of matchesData.data) {
              // Get the spotted report details
              const spottedReport = match.spottedReportId;
              if (!spottedReport || !spottedReport.latitude || !spottedReport.longitude) {
                continue;
              }

              // Track this report as having a match
              matchedReportIds.add(spottedReport._id);

              const distance = calculateDistance(
                userLat,
                userLon,
                spottedReport.latitude,
                spottedReport.longitude
              );

              if (distance <= radiusPreference) {
                let locationName = `${spottedReport.latitude.toFixed(4)}, ${spottedReport.longitude.toFixed(4)}`;
                try {
                  const [geocoded] = await Location.reverseGeocodeAsync({
                    latitude: spottedReport.latitude,
                    longitude: spottedReport.longitude,
                  });
                  if (geocoded) {
                    const parts = [];
                    if (geocoded.street) parts.push(geocoded.street);
                    if (geocoded.city) parts.push(geocoded.city);
                    if (parts.length > 0) locationName = parts.join(', ');
                  }
                } catch {
                  // Use coordinates as fallback
                }

                nearbyAlerts.push({
                  id: match._id,
                  type: match.matchScore >= 90 ? 'high-match' : 'moderate-match',
                  animalType: spottedReport.animalType || 'animal',
                  location: locationName,
                  distance: Math.round(distance * 10) / 10,
                  timeAgo: getTimeAgo(spottedReport.timestamp || spottedReport.createdAt),
                  latitude: spottedReport.latitude,
                  longitude: spottedReport.longitude,
                  matchScore: match.matchScore,
                  matchedPetName: match.lostPetId?.petName,
                  matchedPetId: match.lostPetId?._id,
                  reportId: spottedReport._id, // Add the actual report ID for fetching details
                });
              }
            }
          }
        }
        
        // Now check for injured animals, excluding those that already have match alerts
        const injuredReports = allReports.filter((report: any) => 
          report.injured === true &&
          report.reportType === 'spotted-on-streets' &&
          typeof report.latitude === 'number' &&
          typeof report.longitude === 'number' &&
          report.reportedBy !== user.id && // Exclude user's own reports
          !matchedReportIds.has(report._id) // Exclude reports that have match alerts
        );

        for (const report of injuredReports) {
          const distance = calculateDistance(
            userLat,
            userLon,
            report.latitude,
            report.longitude
          );

          if (distance <= radiusPreference) {
            let locationName = `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`;
            try {
              const [geocoded] = await Location.reverseGeocodeAsync({
                latitude: report.latitude,
                longitude: report.longitude,
              });
              if (geocoded) {
                const parts = [];
                if (geocoded.street) parts.push(geocoded.street);
                if (geocoded.city) parts.push(geocoded.city);
                if (parts.length > 0) locationName = parts.join(', ');
              }
            } catch {
              // Use coordinates as fallback
            }

            nearbyAlerts.push({
              id: report._id,
              type: 'injured',
              animalType: report.animalType || 'animal',
              location: locationName,
              distance: Math.round(distance * 10) / 10,
              timeAgo: getTimeAgo(report.timestamp || report.createdAt),
              latitude: report.latitude,
              longitude: report.longitude,
            });
          }
        }

        // Sort by priority: high-match > moderate-match > injured, then by distance
        nearbyAlerts.sort((a, b) => {
          const priorityOrder = { 'high-match': 0, 'moderate-match': 1, 'injured': 2 };
          const priorityDiff = priorityOrder[a.type] - priorityOrder[b.type];
          if (priorityDiff !== 0) return priorityDiff;
          return a.distance - b.distance;
        });
        
        setAlerts(nearbyAlerts);
      }
    } catch (error) {
      console.error('Error checking for injured animals:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, locationEnabled]);

  // Check location permission and enable monitoring
  useEffect(() => {
    const checkLocationPermission = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationEnabled(true);
        } else {
          setLocationEnabled(false);
        }
      } catch (error) {
        console.error('Error checking location permission:', error);
        setLocationEnabled(false);
      }
    };

    checkLocationPermission();
    
    // Re-check permission every 30 seconds
    const interval = setInterval(checkLocationPermission, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check for injured animals periodically when location is enabled
  useEffect(() => {
    if (locationEnabled && user?.id) {
      checkForInjuredAnimals();
      
      // Check every 5 minutes
      const interval = setInterval(checkForInjuredAnimals, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [locationEnabled, user?.id, checkForInjuredAnimals]);

  const refreshAlerts = useCallback(async () => {
    await checkForInjuredAnimals();
  }, [checkForInjuredAnimals]);

  return (
    <AlertContext.Provider value={{ alerts, loading, refreshAlerts }}>
      {children}
    </AlertContext.Provider>
  );
};
