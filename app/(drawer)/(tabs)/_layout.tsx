// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuth } from "@/src/contexts/AuthContext";
import { DrawerToggleButton } from "@react-navigation/drawer";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();

  if (!user) {
    return null; // Não renderiza nada se o usuário não estiver autenticado
  }

  return (
    <Tabs
      screenOptions={{
        // fundo da barra de abas
        tabBarStyle: { backgroundColor: "#008bac99" },
        // ícones e textos sempre brancos
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "#ffffff",
        // oculta cabeçalhos internos das telas de aba
        headerShown: true,
        headerLeft: () => <DrawerToggleButton tintColor="#fff" />,
        headerTintColor: "#fff",
      }}
    >
      <Tabs.Screen
        name="index"
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
      {/* Outras abas podem ser adicionadas aqui no futuro */}
    </Tabs>
  );
}
