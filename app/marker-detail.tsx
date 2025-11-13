import TopBarSecondary from '@/components/TopBarSecondary';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MarkerDetail() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const latitude = parseFloat((params.lat as string) || '0');
  const longitude = parseFloat((params.lng as string) || '0');
  const petName = (params.petName as string) || 'Unknown';
  const type = (params.type as string) || 'sighting';
  const timestamp = (params.ts as string) || '';
  const address = (params.address as string) || '';

  const region = useMemo(() => ({
    latitude: isNaN(latitude) ? 0 : latitude,
    longitude: isNaN(longitude) ? 0 : longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }), [latitude, longitude]);

  const formattedDate = useMemo(() => {
    if (!timestamp) return '';
    try {
      const ms = parseInt(timestamp, 10);
      if (!isNaN(ms)) {
        return new Date(ms).toLocaleString();
      }
      return '';
    } catch {
      return '';
    }
  }, [timestamp]);

  return (
    <View style={styles.container}>
      <TopBarSecondary onBack={() => router.back()} showRightDots={false} />
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        region={region}
        showsUserLocation={true}
      >
        {!isNaN(latitude) && !isNaN(longitude) && (
          <Marker
            coordinate={{ latitude, longitude }}
            pinColor={type === 'lost' ? '#007AFF' : '#81ADC8'}
            title={type === 'lost' ? `${petName} (Lost Report)` : `${petName} (Sighting)`}
            description={address || formattedDate}
          />
        )}
      </MapView>
      <View style={[styles.infoPanel, { paddingBottom: insets.bottom || 16 }]}>
        <Text style={styles.title}>{type === 'lost' ? 'Initial Lost Report' : 'Checked Sighting'}</Text>
        <Text style={styles.name}>{petName}</Text>
        {formattedDate ? <Text style={styles.date}>{formattedDate}</Text> : null}
        {address ? <Text style={styles.address}>{address}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2C3544' },
  map: { flex: 1 },
  infoPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1E1F24',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: { color: '#81ADC8', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  date: { color: '#9CA3AF', fontSize: 13, marginBottom: 4 },
  address: { color: '#D1D5DB', fontSize: 13 },
});
