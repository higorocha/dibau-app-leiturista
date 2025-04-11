// app/(drawer)/(tabs)/index.tsx
import React from 'react';
import { Stack } from 'expo-router';
import LotesScreen from '@/src/screens/lotes/LotesScreen';

export default function TabLotesScreen() {
  return (
    <>
      <Stack.Screen 
        options={{
          title: "Lotes Agrícolas",
        }}
      />
      <LotesScreen />
    </>
  );
}