// src/components/leituras/PeriodoBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PeriodoBadgeProps {
  periodo: string;
}

const PeriodoBadge: React.FC<PeriodoBadgeProps> = ({ periodo }) => {
  return (
    <View style={styles.periodBadge}>
      <Text style={styles.periodText}>{periodo}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  periodBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 10,
  },
  periodText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default PeriodoBadge;