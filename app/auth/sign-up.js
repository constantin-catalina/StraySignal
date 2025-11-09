import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { setSignedIn } from '../lib/auth';

export default function SignUp() {
  const onLogin = async () => {
    await setSignedIn(true);
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headingText}>Login here</Text>
          <Text style={styles.introText}>Welcome</Text>
        </View>

        <TouchableOpacity style={styles.primary} onPress={onLogin}>
          <Text style={styles.primaryText}>Log in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 40, width: '100%' },
  headerContainer: { alignItems: 'center', gap: 16, width: '100%' },
  headingText: { color: '#1F31BB', fontWeight: '700', fontSize: 30 },
  introText: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  primary: { marginTop: 24, height: 48, borderRadius: 12, backgroundColor: '#142A4C', alignItems:'center', justifyContent:'center' },
  primaryText: { color:'#fff', fontWeight:'700' },
});
