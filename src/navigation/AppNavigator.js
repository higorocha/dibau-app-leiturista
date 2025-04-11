// src/navigation/AppNavigator.js
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import LotesScreen from '../screens/lotes/LotesScreen';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const Stack = createStackNavigator();

// Componente de tela de carregamento
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#2a9d8f" />
    <Text style={styles.loadingText}>Iniciando o aplicativo...</Text>
  </View>
);

const AppNavigator = () => {
  const { user, loading } = useAuth();

  // Mostrar tela de loading enquanto verifica autenticação
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          // Rotas autenticadas
          <Stack.Screen 
            name="Lotes" 
            component={LotesScreen} 
            options={{ 
              headerShown: false 
            }}
          />
        ) : (
          // Rotas não autenticadas
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ 
              headerShown: false 
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666',
  },
});

export default AppNavigator;