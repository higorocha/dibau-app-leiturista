// src/contexts/LeiturasContext.tsx - Versão simplificada sem persistência offline
import React, { createContext, useState, useContext, ReactNode } from 'react';

interface LeiturasContextType {
  faturasSelecionadas: any[];
  mesAnoSelecionado: string;
  setFaturasSelecionadas: (faturas: any[]) => void;
  setMesAnoSelecionado: (mesAno: string) => void;
  atualizarFaturaLocal: (faturaId: number, dados: any) => void;
}

const LeiturasContext = createContext<LeiturasContextType | null>(null);

export const LeiturasProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [faturasSelecionadas, setFaturasSelecionadas] = useState<any[]>([]);
  const [mesAnoSelecionado, setMesAnoSelecionado] = useState<string>('');

  // Função para atualizar apenas uma fatura específica
  const atualizarFaturaLocal = (faturaId: number, dados: any) => {
    console.log(`[DEBUG] Atualizando fatura local ID ${faturaId}`, dados);
    
    // Cria uma cópia atualizada das faturas
    const faturasAtualizadas = faturasSelecionadas.map(f => 
      f.id === faturaId ? { ...f, ...dados } : f
    );
    
    // Atualiza o estado
    setFaturasSelecionadas(faturasAtualizadas);
    
    console.log(`[DEBUG] Fatura ${faturaId} atualizada no estado`);
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