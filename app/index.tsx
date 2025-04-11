// app/index.tsx
import { useAuth } from '@/src/contexts/AuthContext';
import { Redirect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import Loading from '@/src/components/Loading';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading message="Iniciando aplicativo..." />;
  }

  // Redirecionar com base no estado de autenticação
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/login" />;
  }
}