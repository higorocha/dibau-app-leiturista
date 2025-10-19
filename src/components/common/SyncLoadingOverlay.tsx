// src/components/common/SyncLoadingOverlay.tsx
// Componente de loading profissional para sincronização

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SyncLoadingOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  type: 'loading' | 'success' | 'error';
  iconName?: string;
}

const { width, height } = Dimensions.get('window');

const SyncLoadingOverlay: React.FC<SyncLoadingOverlayProps> = ({
  visible,
  title,
  subtitle,
  type,
  iconName,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Animação de entrada
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Animação de pulso contínua para loading
      if (type === 'loading') {
        const startPulse = () => {
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.9,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (visible && type === 'loading') {
              startPulse();
            }
          });
        };
        startPulse();
      }
    } else {
      // Animação de saída
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 0.8,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, type]);

  if (!visible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#d4edda',
          borderColor: '#c3e6cb',
          iconColor: '#155724',
          titleColor: '#155724',
        };
      case 'error':
        return {
          backgroundColor: '#f8d7da',
          borderColor: '#f5c6cb',
          iconColor: '#721c24',
          titleColor: '#721c24',
        };
      default:
        return {
          backgroundColor: '#ffffff',
          borderColor: '#e9ecef',
          iconColor: '#2a9d8f',
          titleColor: '#333333',
        };
    }
  };

  const typeStyles = getTypeStyles();

  const renderIcon = () => {
    if (type === 'loading') {
      return (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <ActivityIndicator size="large" color={typeStyles.iconColor} />
        </Animated.View>
      );
    }

    const getIconName = () => {
      if (iconName) return iconName;
      switch (type) {
        case 'success':
          return 'checkmark-circle';
        case 'error':
          return 'close-circle';
        default:
          return 'information-circle';
      }
    };

    return (
      <Ionicons 
        name={getIconName() as any} 
        size={48} 
        color={typeStyles.iconColor} 
      />
    );
  };

  return (
    <Animated.View 
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        }
      ]}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: typeStyles.backgroundColor,
            borderColor: typeStyles.borderColor,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        {/* Ícone ou Spinner */}
        <View style={styles.iconContainer}>
          {renderIcon()}
        </View>

        {/* Título */}
        <Text 
          style={[
            styles.title,
            { color: typeStyles.titleColor }
          ]}
        >
          {title}
        </Text>

        {/* Subtítulo opcional */}
        {subtitle && (
          <Text style={styles.subtitle}>
            {subtitle}
          </Text>
        )}

        {/* Indicador de carregamento adicional para loading */}
        {type === 'loading' && (
          <View style={styles.loadingIndicator}>
            <View style={styles.dotContainer}>
              {[0, 1, 2].map((index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: typeStyles.iconColor,
                      opacity: pulseAnim,
                    }
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    width: Math.min(320, width * 0.8),
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  loadingIndicator: {
    marginTop: 16,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default SyncLoadingOverlay;
