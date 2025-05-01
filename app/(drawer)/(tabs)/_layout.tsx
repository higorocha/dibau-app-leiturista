// app/(drawer)/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import React from "react";
import { Platform, BackHandler } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuth } from "@/src/contexts/AuthContext";
import { DrawerToggleButton } from "@react-navigation/drawer";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  // Adicionando manipulador para o botão voltar
  React.useEffect(() => {
    const backAction = () => {
      // Verifica se estamos na tela de detalhes de leituras
      if (router.canGoBack()) {
        // Se pudermos voltar, deixe o comportamento padrão acontecer
        return false;
      }
      // Se não podemos voltar, podemos definir comportamento personalizado
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  if (!user) {
    return null; // Não renderiza nada se o usuário não estiver autenticado
  }

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#008bac99" },
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#ffffff",
        // Importante: não mostrar o botão de voltar, apenas o do drawer
        headerShown: true,
        headerLeft: () => <DrawerToggleButton tintColor="#fff" />,
        headerTintColor: "#fff",
      }}
    >
      <Tabs.Screen
        name="index" // Isso corresponderá a /index
        options={{
          title: "Lotes Agrícolas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leituras"
        options={{
          title: "Leituras",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="water-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}