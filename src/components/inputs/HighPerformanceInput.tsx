// 1. Primeiro, crie um componente de input completamente nativo em:
// src/components/inputs/HighPerformanceInput.tsx

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, View } from 'react-native';

export interface HighPerformanceInputProps extends TextInputProps {
  onValueChange?: (text: string) => void;
}

export interface HighPerformanceInputRef {
  getValue: () => string;
  clear: () => void;
}

const HighPerformanceInput = forwardRef<HighPerformanceInputRef, HighPerformanceInputProps>((props, ref) => {
  const { style, onValueChange, ...restProps } = props;
  const inputRef = useRef<TextInput>(null);
  const [value, setValue] = useState('');

  // Expõe métodos para o componente pai
  useImperativeHandle(ref, () => ({
    getValue: () => value,
    clear: () => {
      setValue('');
      inputRef.current?.clear();
    }
  }));

  return (
    <TextInput
      ref={inputRef}
      {...restProps}
      style={[styles.input, style]}
      value={undefined} // Força o input a ser não controlado
      defaultValue="" // Sempre começa vazio
      onChangeText={(text) => {
        // Atualiza o estado local sem re-renderizar
        setValue(text);
        // Opcional: notifica o pai, mas não controla o input
        onValueChange?.(text);
      }}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    padding: 8,
    fontSize: 14,
  },
});

export default HighPerformanceInput;