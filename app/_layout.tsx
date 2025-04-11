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
import Toast from 'react-native-toast-message';
import { useColorScheme } from "@/hooks/useColorScheme";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { LeiturasProvider } from "@/src/contexts/LeiturasContext"; // Importar o Provider


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
          <Toast />
        </ThemeProvider>
      </LeiturasProvider>
    </AuthProvider>
  );
}
