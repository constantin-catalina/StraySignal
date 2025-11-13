import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import TopBar from '@/components/TopBar';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function Chat() {
  const router = useRouter();

  return (
    <ThemedView style={{ flex: 1 }}>
      <TopBar onBack={() => router.back()} />

      <ThemedView style={styles.center}>
        <ThemedText type="title">Coming soon...</ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
