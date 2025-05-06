/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Definir cores comuns para ambos os modos
const primaryColor = '#151718'; // Cor do background do modo escuro
const tintColor = '#fff';       // Cor do modo escuro

export const Colors = {
  light: {
    text: '#ECEDEE',           // Usar a mesma cor de texto do modo escuro
    background: primaryColor,  // Usar o mesmo background do modo escuro
    tint: tintColor,           // Usar o mesmo tint do modo escuro
    icon: '#9BA1A6',           // Usar a mesma cor de ícone do modo escuro
    tabIconDefault: '#9BA1A6', // Usar a mesma cor de ícone de tab do modo escuro
    tabIconSelected: tintColor // Usar a mesma cor de ícone selecionado do modo escuro
  },
  dark: {
    text: '#ECEDEE',
    background: primaryColor,
    tint: tintColor,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColor
  },
};