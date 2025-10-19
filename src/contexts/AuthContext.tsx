// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { router } from 'expo-router';
import api from '../api/axiosConfig';
import LoggerService from '../services/LoggerService';

// Debug helper para banco de dados (desenvolvimento)
if (__DEV__) {
  require('../utils/databaseDebug');
}

// Definir tipos
interface User {
  id: number;
  nome: string;
  email: string;
  nivel: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Criar o contexto
const AuthContext = createContext<AuthContextType | null>(null);

// Função auxiliar para verificar validade do token
const isTokenValid = (token: string): boolean => {
  try {
    const decoded = jwtDecode(token) as { exp: number };
    const now = Date.now() / 1000; // Converter para segundos
    const timeUntilExpiry = decoded.exp - now;
    
    // Token é válido se ainda tem pelo menos 5 minutos de vida
    console.log(`[AUTH] Token expira em ${Math.round(timeUntilExpiry / 60)} minutos`);
    return timeUntilExpiry > 300; // 5 minutos de margem
  } catch (error) {
    console.error('[AUTH] Erro ao decodificar token:', error);
    return false;
  }
};

// Função auxiliar para verificar integridade dos dados armazenados
const verificarIntegridadeDados = async (): Promise<{ token: string | null, userData: string | null, integro: boolean }> => {
  try {
    const token = await AsyncStorage.getItem('dibau_token');
    const userData = await AsyncStorage.getItem('dibau_user');
    
    // Verificar se os dados existem
    if (!token || !userData) {
      return { token, userData, integro: false };
    }
    
    // Tentar parsear os dados para verificar integridade
    try {
      JSON.parse(userData); // Verificar se userData é JSON válido
      // Token não precisa ser JSON, mas deve ser string não vazia
      if (token.trim().length < 10) {
        throw new Error('Token muito pequeno');
      }
      return { token, userData, integro: true };
    } catch (parseError) {
      console.error('[AUTH] Dados corrompidos detectados:', parseError);
      return { token, userData, integro: false };
    }
  } catch (error) {
    console.error('[AUTH] Erro ao verificar integridade dos dados:', error);
    return { token: null, userData: null, integro: false };
  }
};

// Provider do contexto
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar dados de autenticação ao iniciar
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        console.log('[AUTH] Iniciando verificação de autenticação...');
        
        // Verificar integridade dos dados antes de usar
        const { token, userData, integro } = await verificarIntegridadeDados();
        
        if (!integro) {
          console.log('[AUTH] Dados não íntegros ou inexistentes, limpando storage');
          // Limpar apenas se os dados estiverem corrompidos
          if (token) await AsyncStorage.removeItem('dibau_token');
          if (userData) await AsyncStorage.removeItem('dibau_user');
          setUser(null);
          setLoading(false);
          return;
        }

        // Verificar validade do token apenas se os dados estão íntegros
        if (token && userData && isTokenValid(token)) {
          try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            console.log('[AUTH] Autenticação restaurada com sucesso:', parsedUser.nome);
          } catch (parseError) {
            console.error('[AUTH] Erro ao parsear dados do usuário:', parseError);
            // Apenas limpar em caso de erro de parse
            await AsyncStorage.removeItem('dibau_token');
            await AsyncStorage.removeItem('dibau_user');
            setUser(null);
          }
        } else {
          console.log('[AUTH] Token inválido ou expirado - limpando dados expirados');
          // Só limpar se for realmente inválido/expirado
          if (token) await AsyncStorage.removeItem('dibau_token');
          if (userData) await AsyncStorage.removeItem('dibau_user');
          setUser(null);
        }
      } catch (error) {
        console.error('[AUTH] Erro ao restaurar autenticação:', error);
        // Em caso de erro geral, não limpar automaticamente
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadAuthData();
  }, []);

  // Função de login
  const login = async (email: string, senha: string): Promise<boolean> => {
    try {
      console.log('[AUTH] Tentativa de login iniciada');
      
      // Log de tentativa de login
      await LoggerService.getInstance().logAuth('login_attempt', true, { 
        attempting_email: email 
      });
      
      const response = await api.post('/usuarios/login', { email, senha });
      const { token, user } = response.data;
  
      // Garantir que estamos recebendo o ultimoAcesso no objeto do usuário
      await AsyncStorage.setItem('dibau_token', token);
      await AsyncStorage.setItem('dibau_user', JSON.stringify(user));
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      // Log de login bem-sucedido
      await LoggerService.getInstance().logAuth('login_success', true, { 
        user_email: user.email,
        user_id: user.id,
        user_name: user.nome,
        user_level: user.nivel,
        token_length: token?.length
      });
      
      console.log('[AUTH] Login realizado com sucesso:', user.nome);
      return true;
    } catch (error) {
      console.error('[AUTH] Erro no login:', error);
      
      // Log de erro no login
      await LoggerService.getInstance().logAuth('login_error', false, { 
        attempting_email: email,
        error_message: (error as any)?.message,
        error_status: (error as any)?.response?.status,
        error_data: (error as any)?.response?.data
      });
      
      throw error;
    }
  };

  // Função de logout
  const logout = async (): Promise<void> => {
    try {
      console.log('[AUTH] Realizando logout...');
      
      // Log de logout iniciado
      await LoggerService.getInstance().logAuth('logout_attempt', true, { 
        user_email: user?.email,
        user_id: user?.id
      });
      
      await AsyncStorage.removeItem('dibau_token');
      await AsyncStorage.removeItem('dibau_user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      
      // Redirecionar para login
      router.replace('/login');
      
      // Log de logout bem-sucedido
      await LoggerService.getInstance().logAuth('logout_success', true, { 
        user_email: user?.email,
        user_id: user?.id
      });
      
      console.log('[AUTH] Logout realizado com sucesso');
    } catch (error) {
      console.error('[AUTH] Erro ao fazer logout:', error);
      
      // Log de erro no logout
      await LoggerService.getInstance().logAuth('logout_error', false, { 
        user_email: user?.email,
        user_id: user?.id,
        error_message: (error as any)?.message
      });
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        login, 
        logout, 
        isAuthenticated: !!user 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar o contexto
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};