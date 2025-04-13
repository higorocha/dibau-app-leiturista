// src/api/axiosConfig.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração de ambientes
type Environment = 'development' | 'production' | 'test';
const currentEnv: Environment = 'production'; // Mude para 'production' ao publicar

// URLs para cada ambiente
const config = {
  development: 'http://192.168.1.144:5001', // Seu IP local
  production: 'https://sistema-irrigacao-backend.onrender.com',
  test: 'http://localhost:5001'
};

// Criar instância do axios
const api = axios.create({
  baseURL: config[currentEnv],
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor para adicionar token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('dibau_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Erro ao recuperar token:', error);
      return config;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Limpar dados de autenticação
      await AsyncStorage.removeItem('dibau_token');
      await AsyncStorage.removeItem('dibau_user');
      
      // O redirecionamento será feito pelo mecanismo de autenticação do Expo Router
      console.log('Sessão expirada, redirecionando...');
    }
    
    return Promise.reject(error);
  }
);

export default api;