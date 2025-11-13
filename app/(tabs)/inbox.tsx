import TopBar from '@/components/TopBar';
import { useAlerts } from '@/contexts/AlertContext';
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Inbox() {
  const router = useRouter();
  const { alerts, loading } = useAlerts();

  const getAlertConfig = (type: 'injured' | 'high-match' | 'moderate-match') => {
    switch (type) {
      case 'high-match':
        return {
          iconBg: '#34C759',
          iconText: '!',
          title: 'Possible match found nearby',
        };
      case 'moderate-match':
        return {
          iconBg: '#FF9500',
          iconText: '!',
          title: 'Check this sighting',
        };
      case 'injured':
      default:
        return {
          iconBg: '#FF3B30',
          iconText: '!',
          title: 'Injured animal reported nearby',
        };
    }
  };

  const getAlertDescription = (alert: any) => {
    if (alert.type === 'high-match') {
      return `A sighting photo matches ${alert.matchedPetName} with ${alert.matchScore}% confidence. Seen ${alert.distance} km away, ${alert.timeAgo}.`;
    } else if (alert.type === 'moderate-match') {
      return `This sighting has a ${alert.matchScore}% match score with ${alert.matchedPetName}. Seen ${alert.distance} km away, ${alert.timeAgo}.`;
    } else {
      return `An user reported an injured ${alert.animalType.toLowerCase()} near ${alert.location} ${alert.timeAgo}.`;
    }
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/backgrounds/Inbox.png')}
        style={styles.bg}          
        resizeMode="cover"
      >
        <View style={styles.topBarWrapper}>
          <TopBar onBack={() => router.back()} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[
            styles.scrollContent,
            (loading || alerts.length === 0) && styles.scrollContentCentered
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Checking for nearby alerts...</Text>
            </View>
          ) : alerts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No alerts at this moment</Text>
              <Text style={styles.emptySubtext}>You&apos;ll be notified about injured animals and potential matches in your area</Text>
            </View>
          ) : (
            alerts.map((alert) => {
              const config = getAlertConfig(alert.type);
              return (
                <TouchableOpacity
                  key={alert.id}
                  style={styles.alertCard}
                  onPress={() => {
                    router.push('/signal');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.alertIconContainer}>
                    <View style={[styles.alertIcon, { backgroundColor: config.iconBg }]}>
                      <Text style={styles.alertIconText}>{config.iconText}</Text>
                    </View>
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>{config.title}</Text>
                    <Text style={styles.alertDescription}>
                      {getAlertDescription(alert)}
                    </Text>
                    {alert.type === 'injured' && (
                      <Text style={styles.alertDistance}>{alert.distance} km away</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bg: { 
    flex: 1,
  },
  topBarWrapper: {
    zIndex: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 24,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 20,
  },
  alertCard: {
    backgroundColor: '#2C2E33',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  alertIconContainer: {
    marginRight: 12,
  },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  alertDescription: {
    color: '#D1D1D6',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  alertDistance: {
    color: '#8E8E93',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

