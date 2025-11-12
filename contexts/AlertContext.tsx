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

      const response = await fetch(API_ENDPOINTS.REPORTS);
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await response.json();
      if (data.success && data.data) {
        const allReports = data.data;
        const nearbyAlerts: InjuredAnimalAlert[] = [];
        
        // Get user's lost pets
        const userLostPets = allReports.filter((report: any) => 
          report.reportType === 'lost-from-home' && 
          report.reportedBy === user.id
        );

        // Check for injured animals
        const injuredReports = allReports.filter((report: any) => 
          report.injured === true &&
          report.reportType === 'spotted-on-streets' &&
          typeof report.latitude === 'number' &&
          typeof report.longitude === 'number'
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

        // Check for potential matches with user's lost pets
        const spottedReports = allReports.filter((report: any) => 
          report.reportType === 'spotted-on-streets' &&
          typeof report.latitude === 'number' &&
          typeof report.longitude === 'number'
        );

        for (const lostPet of userLostPets) {
          for (const spotted of spottedReports) {
            const distance = calculateDistance(
              userLat,
              userLon,
              spotted.latitude,
              spotted.longitude
            );

            if (distance <= radiusPreference) {
              // Simple matching logic based on animal type and proximity to last seen location
              let matchScore = 0;
              
              // Base score for matching animal type
              if (spotted.animalType?.toLowerCase() === lostPet.animalType?.toLowerCase()) {
                matchScore += 40;
              }

              // Score for proximity to last seen location
              if (lostPet.latitude && lostPet.longitude) {
                const distanceFromLastSeen = calculateDistance(
                  lostPet.latitude,
                  lostPet.longitude,
                  spotted.latitude,
                  spotted.longitude
                );
                
                if (distanceFromLastSeen <= 1) matchScore += 30;
                else if (distanceFromLastSeen <= 3) matchScore += 20;
                else if (distanceFromLastSeen <= 5) matchScore += 10;
              }

              // Score for time proximity
              const lostDate = new Date(lostPet.lastSeenDate || lostPet.createdAt);
              const spottedDate = new Date(spotted.timestamp || spotted.createdAt);
              const daysDiff = Math.abs((spottedDate.getTime() - lostDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysDiff <= 1) matchScore += 20;
              else if (daysDiff <= 3) matchScore += 15;
              else if (daysDiff <= 7) matchScore += 10;

              // Score for breed match if available
              if (lostPet.breed && spotted.additionalInfo?.toLowerCase().includes(lostPet.breed.toLowerCase())) {
                matchScore += 10;
              }

              // Only create alert if match score is 75% or higher
              if (matchScore >= 75) {
                let locationName = `${spotted.latitude.toFixed(4)}, ${spotted.longitude.toFixed(4)}`;
                try {
                  const [geocoded] = await Location.reverseGeocodeAsync({
                    latitude: spotted.latitude,
                    longitude: spotted.longitude,
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
                  id: `match-${spotted._id}-${lostPet._id}`,
                  type: matchScore >= 90 ? 'high-match' : 'moderate-match',
                  animalType: spotted.animalType || 'animal',
                  location: locationName,
                  distance: Math.round(distance * 10) / 10,
                  timeAgo: getTimeAgo(spotted.timestamp || spotted.createdAt),
                  latitude: spotted.latitude,
                  longitude: spotted.longitude,
                  matchScore: Math.round(matchScore),
                  matchedPetName: lostPet.petName,
                  matchedPetId: lostPet._id,
                });
              }
            }
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
