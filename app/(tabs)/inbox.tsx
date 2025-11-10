import TopBar from '@/components/TopBar';
import { useRouter } from 'expo-router';
import { ImageBackground, StyleSheet, View } from 'react-native';

export default function Inbox() {
  const router = useRouter();

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
});

