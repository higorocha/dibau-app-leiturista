// src/components/common/ModalToast.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ModalToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  onHide: () => void;
}

const ModalToast: React.FC<ModalToastProps> = ({ 
  message, 
  type = 'info', 
  duration = 2000, 
  onHide 
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onHide();
    });
    
    return () => {
      opacity.stopAnimation();
    };
  }, []);
  
  // Define icon and color based on type
  let icon, backgroundColor;
  switch (type) {
    case 'success':
      icon = 'checkmark-circle';
      backgroundColor = '#2a9d8f';
      break;
    case 'error':
      icon = 'alert-circle';
      backgroundColor = '#e63946';
      break;
    case 'info':
    default:
      icon = 'information-circle';
      backgroundColor = '#3498db';
  }
  
  return (
    <Animated.View 
      style={[
        styles.container, 
        { backgroundColor, opacity }
      ]}
    >
      <Ionicons name={icon as any} size={20} color="#fff" />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  message: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  }
});

export default ModalToast;