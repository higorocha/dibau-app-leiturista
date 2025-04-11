// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { router } from 'expo-router';
import api from '../api/axiosConfig';

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
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
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
        const token = await AsyncStorage.getItem('dibau_token');
        const userData = await AsyncStorage.getItem('dibau_user');

        if (token && userData && isTokenValid(token)) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('Autenticação restaurada:', parsedUser.nome);
        } else {
          if (token) await AsyncStorage.removeItem('dibau_token');
          if (userData) await AsyncStorage.removeItem('dibau_user');
          setUser(null);
        }
      } catch (error) {
        console.error('Erro ao restaurar autenticação:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAuthData();
  }, []);

  // Função de login
  const login = async (email: string, senha: string): Promise<boolean> => {
    try {
      const response = await api.post('/usuarios/login', { email, senha });
      const { token, user } = response.data;
  
      // Garantir que estamos recebendo o ultimoAcesso no objeto do usuário
      await AsyncStorage.setItem('dibau_token', token);
      await AsyncStorage.setItem('dibau_user', JSON.stringify(user));
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  };

  // Função de logout
  const logout = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('dibau_token');
      await AsyncStorage.removeItem('dibau_user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      
      // Redirecionar para login
      router.replace('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
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