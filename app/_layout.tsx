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
import NetInfo from '@react-native-community/netinfo';
import { checkAndSyncCulturas } from "@/src/services/CulturasSyncService";
import AsyncStorage from '@react-native-async-storage/async-storage';
import UpdateHandler from "@/src/components/UpdateHandler"; // Adicione esta linha


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
  const navTheme =
    colorScheme === "dark" ? DarkNavigationThemeCustom : LightNavigationTheme;
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      
      // Verificar e sincronizar após o app carregar, mas com um pequeno atraso
      // para não impactar a inicialização e não bloquear a UI
      const timer = setTimeout(() => {
        // Verificar se passou o tempo mínimo desde a última sincronização
        const verificarEhSincronizarSeNecessario = async () => {
          try {
            // Verificar leituras
            const ultimaSincLeituras = await AsyncStorage.getItem('leituras_ultima_sincronizacao');
            const agora = new Date().getTime();
            const duasHorasEmMS = 2 * 60 * 60 * 1000;
            
            let deveSincLeituras = true;
            if (ultimaSincLeituras) {
              const ultimaData = new Date(ultimaSincLeituras).getTime();
              deveSincLeituras = (agora - ultimaData) > duasHorasEmMS;
            }
            
            
            // Mesma lógica para culturas
            const ultimaSincCulturas = await AsyncStorage.getItem('culturas_ultima_sincronizacao');
            let deveSincCulturas = true;
            if (ultimaSincCulturas) {
              const ultimaData = new Date(ultimaSincCulturas).getTime();
              deveSincCulturas = (agora - ultimaData) > duasHorasEmMS;
            }
            
            if (deveSincCulturas) {
              checkAndSyncCulturas(); // sincronização de culturas
            }
          } catch (error) {
            console.error('Erro ao verificar timestamp de sincronização:', error);
          }
        };
        
        verificarEhSincronizarSeNecessario();
      }, 5000); // 5 segundos após inicialização
      
      // Configurar listener de conectividade com a mesma lógica
      const unsubscribe = NetInfo.addEventListener(async state => {
        if (state.isConnected) {
          // Quando a conexão é estabelecida, verificar se deve sincronizar
          const verificarEhSincronizarSeNecessario = async () => {
            try {
              // Verificar leituras
              const ultimaSincLeituras = await AsyncStorage.getItem('leituras_ultima_sincronizacao');
              const agora = new Date().getTime();
              const duasHorasEmMS = 2 * 60 * 60 * 1000;
              
              let deveSincLeituras = true;
              if (ultimaSincLeituras) {
                const ultimaData = new Date(ultimaSincLeituras).getTime();
                deveSincLeituras = (agora - ultimaData) > duasHorasEmMS;
              }
              
              
              // Mesma lógica para culturas
              const ultimaSincCulturas = await AsyncStorage.getItem('culturas_ultima_sincronizacao');
              let deveSincCulturas = true;
              if (ultimaSincCulturas) {
                const ultimaData = new Date(ultimaSincCulturas).getTime();
                deveSincCulturas = (agora - ultimaData) > duasHorasEmMS;
              }
              
              if (deveSincCulturas) {
                checkAndSyncCulturas(); // sincronização de culturas
                await AsyncStorage.setItem('culturas_ultima_sincronizacao', new Date().toISOString());
              }
            } catch (error) {
              console.error('Erro ao verificar timestamp de sincronização:', error);
            }
          };
          
          verificarEhSincronizarSeNecessario();
        }
      });
      
      // Limpar listener e timer
      return () => {
        clearTimeout(timer);
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
          <UpdateHandler />
        </ThemeProvider>
      </LeiturasProvider>
    </AuthProvider>
  );
}