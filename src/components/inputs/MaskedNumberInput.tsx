// src/components/inputs/MaskedNumberInput.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaskInput, { MaskInputProps, createNumberMask } from 'react-native-mask-input';

// Cria uma máscara para números com separador de milhar
const numeroComMilharMask = createNumberMask({
  prefix: [''],
  delimiter: '.',
  precision: 0,
  separator: ',',
});

interface MaskedNumberInputProps extends Omit<MaskInputProps, 'mask'> {
  value: string;
  onChangeText: (text: string) => void;
}

const MaskedNumberInput: React.FC<MaskedNumberInputProps> = ({
  value,
  onChangeText,
  style,
  ...props
}) => {
  // Função para extrair apenas os números (sem formatação)
  const handleChangeText = (maskedValue: string, unmaskedValue: string) => {
    onChangeText(unmaskedValue);
  };

  return (
    <View style={styles.container}>
      <MaskInput
        value={value}
        onChangeText={handleChangeText}
        mask={numeroComMilharMask}
        keyboardType="numeric"
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#2a9d8f',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    color: '#333',
  },
});

export default MaskedNumberInput;