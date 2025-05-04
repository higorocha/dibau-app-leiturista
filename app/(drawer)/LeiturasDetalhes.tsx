// app/LeiturasDetalhes.tsx
import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router, Stack } from 'expo-router';
import LeiturasDetalhesScreen from '@/src/screens/leituras/LeiturasDetalhesScreen';
import { useLeiturasContext } from '@/src/contexts/LeiturasContext';
import PeriodoBadge from '@/src/components/leituras/PeriodoBadge';

export default function LeiturasDetalhesRoute() {
  const { mesAnoSelecionado } = useLeiturasContext();

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

  return (
    <>
      <Stack.Screen
        options={{
          title: "Captura de Leituras",
          headerStyle: {
            backgroundColor: "#008bac99", // Mesma cor da barra de navegação
          },
          headerTintColor: "#fff",
          headerRight: () => <PeriodoBadge periodo={mesAnoSelecionado} />,
        }}
      />
      <LeiturasDetalhesScreen />
    </>
  );
}