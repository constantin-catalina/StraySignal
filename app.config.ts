import 'dotenv/config';

export default {
  expo: {
    name: 'StraySignal',
    slug: 'straysignal',
    scheme: 'straysignal',
    extra: {
      clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow StraySignal to use your location to show nearby stray animals.',
        },
      ],
    ],
    android: {
      permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    ios: {
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'Allow StraySignal to use your location to show nearby stray animals.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Allow StraySignal to use your location to show nearby stray animals.',
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },
  },
};
