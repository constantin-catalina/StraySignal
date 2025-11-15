import { openOrCreateConversation } from '@/app/lib/chat';
import TopBarSecondary from '@/components/TopBarSecondary';
import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface ReportDetails {
  _id: string;
  latitude: number;
  longitude: number;
  time: string;
  animalType: string;
  direction: string;
  injured: boolean;
  photos: string[];
  additionalInfo: string;
  reportType: 'lost-from-home' | 'spotted-on-streets';
  reportedBy: string;
  timestamp: string;
  createdAt: string;
  // Lost pet specific fields
  petName?: string;
  breed?: string;
  lastSeenLocation?: string;
  lastSeenDate?: string;
  hasReward?: boolean;
  hasDistinctiveMarks?: boolean;
  distinctiveMarks?: string;
  ownerShowsPhone?: boolean;
}

export default function AlertDetails() {
  const router = useRouter();
  const { user } = useUser();
  const params = useLocalSearchParams();
  const [report, setReport] = useState<ReportDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleChatWithUser = async () => {
    if (!user?.id || !report?.reportedBy) {
      Alert.alert('Error', 'Unable to start chat');
      return;
    }
    try {
      const conversationId = await openOrCreateConversation(user.id, report.reportedBy);
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  const handleCheckSighting = async () => {
    if (!params.matchId) {
      Alert.alert('Error', 'Cannot mark as checked: No match ID available');
      return;
    }

    try {
      setChecking(true);
      const url = `${API_ENDPOINTS.MATCHES}/${params.matchId}/check`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checked: true,
        }),
      });

      console.log('Check response status:', response.status);
      const responseData = await response.json();
      console.log('Check response data:', responseData);

      if (response.ok) {
        Alert.alert('Success', 'Sighting marked as checked and added to pet route', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Error', `Failed to mark sighting as checked: ${responseData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error checking sighting:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const fetchReportDetails = async () => {
      if (!params.alertId) {
        console.log('No alert ID provided');
        Alert.alert('Error', 'No alert ID provided');
        router.back();
        return;
      }

      try {
        const url = `${API_ENDPOINTS.REPORTS}/${params.alertId}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Report data:', data);
          if (data.success && data.data) {
            setReport(data.data);
          } else {
            console.log('Invalid data structure:', data);
            Alert.alert('Error', 'Failed to load report details');
            router.back();
          }
        } else {
          const errorText = await response.text();
          console.log('Response error:', errorText);
          Alert.alert('Error', 'Failed to load report details');
          router.back();
        }
      } catch (error) {
        console.error('Error fetching report details:', error);
        Alert.alert('Error', 'Could not load report details');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    fetchReportDetails();
  }, [params.alertId, router]);

  if (loading) {
    return (
      <View style={styles.container}>
        <TopBarSecondary title="Alert Details" onBack={() => router.back()} showRightDots={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.container}>
        <TopBarSecondary title="Alert Details" onBack={() => router.back()} showRightDots={false} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Report not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBarSecondary title="Sighting Detail" onBack={() => router.back()} showRightDots={true} />
      
      {/* Full Screen Map */}
      <MapView
        style={styles.fullMap}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: report.latitude,
          longitude: report.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{
            latitude: report.latitude,
            longitude: report.longitude,
          }}
          pinColor="#007AFF"
          onPress={() => setShowModal(true)}
        />
      </MapView>

      {/* Spotted Detail Modal */}
      <SpottedDetailModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        report={report}
        currentUserId={user?.id}
        matchId={params.matchId as string}
        onCheckSighting={handleCheckSighting}
        checking={checking}
        onChatWithUser={handleChatWithUser}
      />
    </View>
  );
}

// Helper function for time ago
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

// Modal Component
interface SpottedDetailModalProps {
  visible: boolean;
  onClose: () => void;
  report: ReportDetails | null;
  currentUserId?: string;
  matchId?: string;
  onCheckSighting?: () => Promise<void>;
  checking?: boolean;
  onChatWithUser?: () => void;
}

const SpottedDetailModal: React.FC<SpottedDetailModalProps> = ({ 
  visible, 
  onClose, 
  report, 
  currentUserId,
  matchId,
  onCheckSighting,
  checking = false,
  onChatWithUser,
}) => {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAddress = async () => {
      if (visible && report) {
        try {
          setResolvedAddress(null);
          const results = await Location.reverseGeocodeAsync({
            latitude: report.latitude,
            longitude: report.longitude,
          });
          if (!cancelled && results.length > 0) {
            const r = results[0];
            const parts = [];
            if (r.street) parts.push(r.street);
            if (r.city) parts.push(r.city);
            if (r.name && !/^\d+$/.test(r.name.trim())) {
              parts.unshift(r.name);
            }
            const formatted = parts.filter(Boolean).join(', ');
            if (formatted) setResolvedAddress(formatted);
          }
        } catch {
          // silent fail, fallback to coordinates
        }
      }
    };
    fetchAddress();
    return () => { cancelled = true; };
  }, [visible, report]);

  if (!visible || !report) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalBadgeContainer} pointerEvents="none">
            <View style={[styles.modalBadgeCircle, { borderColor: '#1E1F24' }]}>
              <Image 
                source={require('../assets/icons/attention_gray.png')} 
                style={[styles.modalBadgeIcon, { tintColor: '#81ADC8' }]} 
              />
            </View>
          </View>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <Text style={styles.seenBadge}>SEEN: {getTimeAgo(report.createdAt || report.timestamp)}</Text>
          </View>
          <ScrollView style={styles.modalDetailsContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>LOCATION:</Text>
              <Text style={styles.detailValue}>{
                resolvedAddress || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
              }</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>INJURED:</Text>
              <Text style={styles.detailValue}>{report.injured ? 'YES' : 'NO'}</Text>
            </View>
            {report.additionalInfo && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DESCRIPTION:</Text>
                <Text style={styles.detailValue}>{report.additionalInfo}</Text>
              </View>
            )}
            {report.direction && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>DIRECTION:</Text>
                <Text style={styles.detailValue}>{report.direction}</Text>
              </View>
            )}
            
            {/* Only show CONTACT section if user is not the owner of the report */}
            {report.reportedBy !== currentUserId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>CONTACT:</Text>
                <View style={styles.contactButtonsContainer}>
                  <TouchableOpacity style={styles.modalContactButton} onPress={onChatWithUser}>
                    <Text style={styles.modalContactButtonText}>
                      {report.reportType === 'lost-from-home' ? 'CHAT with owner' : 'CHAT with reporter'}
                    </Text>
                  </TouchableOpacity>
                  {report.reportType === 'lost-from-home' && report.ownerShowsPhone && (
                    <TouchableOpacity style={styles.modalContactButton}>
                      <Text style={styles.modalContactButtonText}>CALL owner</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <Text style={styles.detailLabel}>PHOTO GALLERY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalPhotoGallery}>
              {report.photos && report.photos.length > 0 ? (
                report.photos.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.modalGalleryPhoto} />
                ))
              ) : (
                <Text style={[styles.detailValue, { marginTop: 8 }]}>No photos available</Text>
              )}
            </ScrollView>
            
            <TouchableOpacity 
              style={[styles.modalCheckButton, checking && styles.modalCheckButtonDisabled]}
              onPress={onCheckSighting}
              disabled={checking || !matchId}
            >
              {checking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalCheckButtonText}>CHECK</Text>
              )}
            </TouchableOpacity>
            
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
    backgroundColor: '#2C3544',
  },
  fullMap: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  mapSection: {
    height: '55%',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(44, 53, 68, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  checkButton: {
    flex: 1,
    backgroundColor: '#4A6278',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  centerIconContainer: {
    marginHorizontal: 8,
  },
  centerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E2633',
    borderWidth: 3,
    borderColor: '#4A6278',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIconText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  seenButton: {
    flex: 1,
    backgroundColor: '#3A4A5C',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 12,
  },
  seenButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#2C3544',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  detailValue: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
  },
  contactButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  contactButtonText: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  photoSection: {
    marginTop: 24,
  },
  photoTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  photoScroll: {
    flexDirection: 'row',
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#1E2633',
  },
  // Modal styles
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
  modalBadgeContainer: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  modalBadgeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 5,
    backgroundColor: '#1E1F24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBadgeIcon: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seenBadge: {
    backgroundColor: '#3A4A5C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  modalDetailsContainer: {
    padding: 20,
  },
  modalPhotoGallery: {
    marginTop: 12,
    marginBottom: 20,
  },
  modalGalleryPhoto: {
    width: 150,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  contactButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalContactButton: {
    backgroundColor: '#D9D9D9',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
  },
  modalContactButtonText: {
    color: '#2C3544',
    fontWeight: '700',
    fontSize: 14,
  },
  modalCheckButton: {
    backgroundColor: '#4A6278',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCheckButtonDisabled: {
    backgroundColor: '#6B7A8F',
    opacity: 0.6,
  },
  modalCheckButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
