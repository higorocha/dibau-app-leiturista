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
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: "#fff",
          headerLeft: () => <DrawerToggleButton tintColor="#fff" />,
          drawerStyle: { backgroundColor: colors.background },
          drawerActiveTintColor: "#33c05ff0",
          drawerInactiveTintColor: "#999",
          headerShown: false,
        }}
      >
        <Drawer.Screen
          name="(tabs)"
          options={{
            headerShown: false, // Garantindo que o header seja mostrado
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}