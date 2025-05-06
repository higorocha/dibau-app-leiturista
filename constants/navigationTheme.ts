// constants/navigationTheme.ts
import { DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';

// Criar um tema base comum para ambos os modos
const commonTheme = {
  colors: {
    primary: '#008bac99',   // botões, links ativos
    card: '#008bac99',      // fundo do header
    border: '#008bac99',
    notification: '#008bac99',
  }
};

export const LightNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    ...commonTheme.colors,
    // Utilizar as cores do modo escuro para o tema claro
    background: DarkTheme.colors.background, // Importante: usar o background do tema escuro
    text: DarkTheme.colors.text, // Importante: usar a cor de texto do tema escuro
  },
};

export const DarkNavigationThemeCustom: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    ...commonTheme.colors,
  },
};