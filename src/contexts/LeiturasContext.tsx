// src/contexts/LeiturasContext.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react';

interface LeiturasContextType {
  faturasSelecionadas: any[];
  mesAnoSelecionado: string;
  setFaturasSelecionadas: (faturas: any[]) => void;
  setMesAnoSelecionado: (mesAno: string) => void;
}

const LeiturasContext = createContext<LeiturasContextType | null>(null);

export const LeiturasProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [faturasSelecionadas, setFaturasSelecionadas] = useState<any[]>([]);
  const [mesAnoSelecionado, setMesAnoSelecionado] = useState<string>('');

  return (
    <LeiturasContext.Provider value={{
      faturasSelecionadas,
      mesAnoSelecionado,
      setFaturasSelecionadas,
      setMesAnoSelecionado
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