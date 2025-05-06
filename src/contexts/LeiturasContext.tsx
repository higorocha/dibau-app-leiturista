// src/contexts/LeiturasContext.tsx - Versão melhorada com persistência
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LeiturasContextType {
  faturasSelecionadas: any[];
  mesAnoSelecionado: string;
  setFaturasSelecionadas: (faturas: any[]) => void;
  setMesAnoSelecionado: (mesAno: string) => void;
  atualizarFaturaLocal: (faturaId: number, dados: any) => void;
}

const LeiturasContext = createContext<LeiturasContextType | null>(null);

// Chaves para AsyncStorage
const FATURAS_STORAGE_KEY = 'leituras_faturas_selecionadas';
const MES_ANO_STORAGE_KEY = 'leituras_mes_ano_selecionado';

export const LeiturasProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [faturasSelecionadas, setFaturasSelecionadasState] = useState<any[]>([]);
  const [mesAnoSelecionado, setMesAnoSelecionadoState] = useState<string>('');

  // Carregar dados salvos ao iniciar
  useEffect(() => {
    const carregarDadosSalvos = async () => {
      try {
        const faturasSalvas = await AsyncStorage.getItem(FATURAS_STORAGE_KEY);
        const mesAnoSalvo = await AsyncStorage.getItem(MES_ANO_STORAGE_KEY);
        
        if (faturasSalvas) {
          setFaturasSelecionadasState(JSON.parse(faturasSalvas));
        }
        
        if (mesAnoSalvo) {
          setMesAnoSelecionadoState(mesAnoSalvo);
        }
      } catch (error) {
        console.error('[LeiturasContext] Erro ao carregar dados salvos:', error);
      }
    };
    
    carregarDadosSalvos();
  }, []);

  // Função para salvar faturas e persistir localmente
  const setFaturasSelecionadas = async (faturas: any[]) => {
    try {
      setFaturasSelecionadasState(faturas);
      await AsyncStorage.setItem(FATURAS_STORAGE_KEY, JSON.stringify(faturas));
    } catch (error) {
      console.error('[LeiturasContext] Erro ao salvar faturas:', error);
    }
  };

  // Função para salvar mês/ano e persistir localmente
  const setMesAnoSelecionado = async (mesAno: string) => {
    try {
      setMesAnoSelecionadoState(mesAno);
      await AsyncStorage.setItem(MES_ANO_STORAGE_KEY, mesAno);
    } catch (error) {
      console.error('[LeiturasContext] Erro ao salvar mês/ano:', error);
    }
  };

  // Nova função para atualizar apenas uma fatura específica
  const atualizarFaturaLocal = async (faturaId: number, dados: any) => {
    try {
      const faturasAtualizadas = faturasSelecionadas.map(f => 
        f.id === faturaId ? { ...f, ...dados } : f
      );
      
      setFaturasSelecionadasState(faturasAtualizadas);
      await AsyncStorage.setItem(FATURAS_STORAGE_KEY, JSON.stringify(faturasAtualizadas));
    } catch (error) {
      console.error('[LeiturasContext] Erro ao atualizar fatura local:', error);
    }
  };

  return (
    <LeiturasContext.Provider value={{
      faturasSelecionadas,
      mesAnoSelecionado,
      setFaturasSelecionadas,
      setMesAnoSelecionado,
      atualizarFaturaLocal
    }}>
      {children}
    </LeiturasContext.Provider>
  );
};

export const useLeiturasContext = () => {
  const context = useContext(LeiturasContext);
  if (!context) {
    throw new Error('useLeiturasContext deve ser usado dentro de um LeiturasProvider');
  }
  return context;
};