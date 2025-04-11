// app/(drawer)/_layout.tsx
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { useTheme } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import CustomDrawerContent from "@/src/components/drawer/CustomDrawerContent";

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          // estilo do header das telas dentro do drawer
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: "#fff",
          // coloca o botão de abrir/fechar drawer
          headerLeft: () => <DrawerToggleButton tintColor="#fff" />,
          // estilo da gaveta
          drawerStyle: { backgroundColor: colors.background },
          drawerActiveTintColor: "#33c05ff0",
          drawerInactiveTintColor: "#999",
          // ícones e labels brancos por padrão
          drawerLabelStyle: { color: colors.text },
          headerShown: false,
        }}
      >
        {/* Essa rota abre seu layout de abas */}
        <Drawer.Screen
          name="(tabs)"
          options={{
            title: 'Início',
            drawerIcon: ({ size, color }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        
        {/* Nova opção Leituras */}
        <Drawer.Screen
          name="leituras"
          options={{
            title: 'Leituras',
            drawerIcon: ({ size, color }) => (
              <Ionicons name="water-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Perfil */}
        <Drawer.Screen
          name="profile"
          options={{
            title: 'Perfil',
            drawerIcon: ({ size, color }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
