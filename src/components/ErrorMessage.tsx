// src/components/ErrorMessage.tsx
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface ErrorMessageProps {
  error: string;
  visible: boolean;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, visible }) => {
  if (!error || !visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{error}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 5,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  text: {
    color: '#c62828',
    fontSize: 14,
  },
});

export default ErrorMessage;