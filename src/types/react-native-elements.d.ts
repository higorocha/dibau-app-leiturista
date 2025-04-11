// src/@types/react-native-elements.d.ts
declare module 'react-native-elements' {
    import React from 'react';
    import { ViewStyle } from 'react-native';
  
    export interface TooltipProps {
      popover: React.ReactElement;
      backgroundColor?: string;
      withPointer?: boolean;
      overlayColor?: string;
      skipAndroidStatusBar?: boolean;
      containerStyle?: ViewStyle;
      children: React.ReactElement;
    }
  
    export const Tooltip: React.FC<TooltipProps>;
    export * from 'react-native-elements/dist/index';
  }