// app/_layout.tsx
import { ThemeProvider } from "@react-navigation/native";
import {
  LightNavigationTheme,
  DarkNavigationThemeCustom,
} from "@/constants/navigationTheme";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import Toast, { BaseToast, ErrorToast, ToastConfig, ToastProps } from 'react-native-toast-message';
import { useColorScheme } from "@/hooks/useColorScheme";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { LeiturasProvider } from "@/src/contexts/LeiturasContext";
import { checkAndSync } from "@/src/services/SyncService";
import NetInfo from '@react-native-community/netinfo';
import { checkAndSyncCulturas } from "@/src/services/CulturasSyncService";

const toastConfig: ToastConfig = {
  success: (props: ToastProps) => (
    <BaseToast
      {...props}
      style={{ 
        borderLeftColor: '#2a9d8f', 
        borderLeftWidth: 5, 
        elevation: 15,
        zIndex: 9999, // Isso ajuda no Android
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: 'bold' }}
      text2Style={{ fontSize: 13 }}
    />
  ),
  error: (props: ToastProps) => (
    <ErrorToast
      {...props}
      style={{ 
        borderLeftColor: '#e63946', 
        borderLeftWidth: 5, 
        elevation: 15,
        zIndex: 9999,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: 'bold' }}
      text2Style={{ fontSize: 13 }}
    />
  ),
  info: (props: ToastProps) => (
    <BaseToast
      {...props}
      style={{ 
        borderLeftColor: '#3498db', 
        borderLeftWidth: 5, 
        elevation: 15,
        zIndex: 9999,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: 'bold' }}
      text2Style={{ fontSize: 13 }}
    />
  ),
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // escolhe o tema claro ou escuro customizado
  const navTheme =
    colorScheme === "dark" ? DarkNavigationThemeCustom : LightNavigationTheme;
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      
      // Verificar e sincronizar após o app carregar
      setTimeout(() => {
        checkAndSync(); //sincronização de leituras
        checkAndSyncCulturas(); //sincronização de culturas
      }, 3000);
      
      // Configurar listener de conectividade
      const unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected) {
          // Quando a conexão é estabelecida, verificar pendências
          checkAndSync(); //sincronização de leituras
          checkAndSyncCulturas(); // sincronização de culturas
        }
      });
      
      // Limpar listener
      return () => {
        unsubscribe();
      };
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <LeiturasProvider>
        <ThemeProvider value={navTheme}>
          <Slot />
          <StatusBar style="auto" />
          <Toast config={toastConfig} />
        </ThemeProvider>
      </LeiturasProvider>
    </AuthProvider>
  );
}