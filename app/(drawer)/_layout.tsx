// app/(drawer)/_layout.tsx
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { useTheme } from "@react-navigation/native";
import CustomDrawerContent from "@/src/components/drawer/CustomDrawerContent";

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          // Remova a linha headerShown: false, ou modifique para:
          headerShown: true, // Mostrar cabeçalhos por padrão
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: "#fff",
          headerLeft: () => <DrawerToggleButton tintColor="#fff" />,
          drawerStyle: { backgroundColor: colors.background },
          drawerActiveTintColor: "#33c05ff0",
          drawerInactiveTintColor: "#999",
        }}
      >
        <Drawer.Screen
          name="(tabs)"
          options={{
            headerShown: false, // Apenas as tabs não mostram cabeçalho
          }}
        />
        {/* Adicione explicitamente a tela LeiturasDetalhes com suas opções */}
        <Drawer.Screen
          name="LeiturasDetalhes" 
          options={{
            headerShown: true, // Força mostrar o cabeçalho
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}