// app/(tabs)/_layout.tsx
import BottomTabBar from '@/components/BottomTabBar';
import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { getSignedIn } from '../lib/auth';

export default function TabLayout() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getSignedIn().then(v => { setAuthed(v); setReady(true); });
  }, []);

  if (!ready) return null;            // prevents flicker on web
  if (!authed) return <Redirect href="/" />;  // <-- Welcome first

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <BottomTabBar {...p} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="signal" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
