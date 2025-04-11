// app/(drawer)/(tabs)/leituras.tsx
import React from 'react';
import { Stack } from 'expo-router';
import LeiturasScreen from '@/src/screens/leituras/LeiturasScreen';

export default function TabLeiturasScreen() {
  return (
    <>
      <Stack.Screen 
        options={{
          title: "Leituras",
        }}
      />
      <LeiturasScreen />
    </>
  );
}