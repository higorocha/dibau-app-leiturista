// constants/navigationTheme.ts
import { DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';

export const LightNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#008bac99',   // botões, links ativos
    card: '#008bac99',      // fundo do header
    background: DefaultTheme.colors.background,
    text: DefaultTheme.colors.text,
    border: '#008bac99',
    notification: '#008bac99',
  },
};

export const DarkNavigationThemeCustom: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#008bac99',
    card: '#008bac99',
    background: DarkTheme.colors.background,
    text: DarkTheme.colors.text,
    border: DarkTheme.colors.border,
    notification: DarkTheme.colors.notification,
  },
};
