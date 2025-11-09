import 'dotenv/config';

export default {
  expo: {
    name: 'StraySignal',
    slug: 'straysignal',
    scheme: 'straysignal',
    extra: {
      clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
  },
};
