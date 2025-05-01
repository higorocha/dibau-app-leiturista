// app/LeiturasDetalhes.tsx
import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';
import LeiturasDetalhesScreen from '@/src/screens/leituras/LeiturasDetalhesScreen';

export default function LeiturasDetalhesRoute() {
  // Customização do comportamento do botão voltar
  useEffect(() => {
    const backAction = () => {
      // Navegar explicitamente para a tela de leituras
      router.replace("/(drawer)/(tabs)/leituras");
      return true; // Impede o comportamento padrão
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  return <LeiturasDetalhesScreen />;
}