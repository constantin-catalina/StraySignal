import { ImageBackground, StyleSheet } from 'react-native';

export default function Inbox() {
  return (
    <ImageBackground
      source={require('@/assets/backgrounds/Inbox.png')}
      style={styles.bg}          
      resizeMode="cover"
    >
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
});
