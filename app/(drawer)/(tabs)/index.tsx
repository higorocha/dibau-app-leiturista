// app/(tabs)/index.tsx
import React from 'react';
import LotesScreen from '@/src/screens/lotes/LotesScreen';

export const options = {
  title: 'Lotes Agrícolas',
};

export default function TabLotesScreen() {
  return <LotesScreen />;
}