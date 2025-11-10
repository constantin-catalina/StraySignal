import TopBarSecondary from '@/components/TopBarSecondary';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LostPetCase {
  _id: string;
  petName: string;
  animalType: string;
  breed?: string;
  lastSeenDate: string;
  lastSeenLocation: string;
  latitude?: number;
  longitude?: number;
  photos: string[];
  hasReward?: boolean;
  hasDistinctiveMarks?: boolean;
  distinctiveMarks?: string;
  additionalInfo?: string;
  createdAt: string;
}

export default function ActiveCases() {
  const router = useRouter();
  const [cases, setCases] = useState<LostPetCase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveCases = async () => {
    setLoading(true);
    try {
      const API_URL = 'http://192.168.0.115:3000/api/reports';
      const response = await fetch(API_URL);
      const result = await response.json();

      if (result.success) {
        // Filter only lost-from-home reports
        const lostPetCases = result.data.filter(
          (report: any) => report.reportType === 'lost-from-home'
        );
        setCases(lostPetCases);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
      Alert.alert('Error', 'Failed to load your cases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchActiveCases();
    }, [])
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

  const handleMarkAsFound = async (caseId: string, petName: string) => {
    Alert.alert(
      'Mark as Found',
      `Are you sure ${petName} has been found?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Found!',
          onPress: async () => {
            try {
              const API_URL = `http://192.168.0.115:3000/api/reports/${caseId}`;
              const response = await fetch(API_URL, {
                method: 'DELETE',
              });

              const result = await response.json();

              if (result.success) {
                Alert.alert('Success', `${petName} has been marked as found!`);
                fetchActiveCases(); // Refresh the list
              } else {
                throw new Error(result.message);
              }
            } catch (error) {
              console.error('Error marking as found:', error);
              Alert.alert('Error', 'Failed to update case. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleViewDetails = (caseItem: LostPetCase) => {
    // Navigate to case detail page with case data
    router.push({
      pathname: '/case-detail',
      params: {
        caseData: JSON.stringify(caseItem),
      },
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'}
        translucent
        backgroundColor="#1E1F24"
      />

      <ImageBackground
        source={require('@/assets/backgrounds/Auth.png')}
        style={styles.bg}
        resizeMode="cover"
      >
        <TopBarSecondary onBack={() => router.back()} title="StraySignal" />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Text style={styles.heading}>CHECK{'\n'}your active cases</Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1E1F24" />
                <Text style={styles.loadingText}>Loading your cases...</Text>
              </View>
            ) : cases.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="paw-outline" size={80} color="#D9D9D9" />
                <Text style={styles.emptyText}>No active cases</Text>
                <Text style={styles.emptySubtext}>
                  Report a lost pet to see it here
                </Text>
              </View>
            ) : (
              <View style={styles.casesContainer}>
                {cases.map((caseItem) => (
                  <View key={caseItem._id} style={styles.caseCardWrapper}>
                    {/* Pet Photo - Above Card */}
                    {caseItem.photos && caseItem.photos.length > 0 && (
                      <View style={styles.photoContainer}>
                        <Image
                          source={{ uri: caseItem.photos[0] }}
                          style={styles.petPhoto}
                        />
                      </View>
                    )}

                    {/* Combined Card with Name, Date, and Button */}
                    <View style={styles.combinedCard}>
                      {/* Top Section - Name, Date, and Play Button */}
                      <View style={styles.caseCard}>
                        <View style={styles.cardLeftSection}>
                          <Text style={styles.petName}>{caseItem.petName}</Text>
                          <Text style={styles.lostDate}>
                            Lost on {formatDate(caseItem.lastSeenDate)}
                          </Text>
                        </View>

                        {/* View Details Button */}
                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() => handleViewDetails(caseItem)}
                        >
                          <Ionicons name="play" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>

                      {/* Mark as Found Button - Connected Below */}
                      <TouchableOpacity
                        style={styles.foundButton}
                        onPress={() => handleMarkAsFound(caseItem._id, caseItem.petName)}
                      >
                        <Text style={styles.foundButtonText}>Mark as found</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </ImageBackground>
    </View>
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
  container: {
    flex: 1,
  },
  heading: {
    fontSize: 32,
    fontWeight: '600',
    color: '#23395B',
    marginBottom: 40,
    marginTop: 35,
    textAlign: 'center',
    lineHeight: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#D9D9D9',
    marginTop: 24,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#D9D9D9',
    marginTop: 8,
  },
  casesContainer: {
    gap: 40,
  },
  caseCardWrapper: {
    alignItems: 'center',
  },
  photoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    padding: 5,
    marginBottom: -50,
    zIndex: 1,
  },
  petPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  combinedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    elevation: 3,
    overflow: 'hidden',
  },
  caseCard: {
    padding: 20,
    paddingTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeftSection: {
    flex: 1,
  },
  petName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1E1F24',
    marginBottom: 4,
  },
  lostDate: {
    fontSize: 14,
    color: '#666',
  },
  viewButton: {
    width: 46,
    height: 46,
    borderRadius: 32,
    backgroundColor: '#1E1F24',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  foundButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  foundButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1F24',
  },
});
