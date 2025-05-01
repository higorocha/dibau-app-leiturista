// src/api/axiosConfig.ts - Versão corrigida
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

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
  timeout: 30000, // Aumentar timeout para 30 segundos
});

// Interceptor para adicionar token e logs de requisição
api.interceptors.request.use(
  async (config) => {
    try {
      // Log da requisição
      console.log(`[API] Enviando requisição para: ${config.method?.toUpperCase()} ${config.url}`);
      
      // Verificar conectividade antes de enviar
      const netInfo = await NetInfo.fetch();
      console.log(`[API] Status da rede: ${netInfo.isConnected ? 'Conectado' : 'Desconectado'}, tipo: ${netInfo.type}`);
      
      // Adicionar token de autenticação
      const token = await AsyncStorage.getItem('dibau_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      
      return config;
    } catch (error) {
      console.error('[API] Erro ao preparar requisição:', error);
      return config;
    }
  },
  (error) => {
    console.error('[API] Erro no interceptor de requisição:', error);
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros e logs de resposta
api.interceptors.response.use(
  (response) => {
    console.log(`[API] Resposta recebida de ${response.config.url}, status: ${response.status}`);
    return response;
  },
  async (error) => {
    // Log detalhado do erro
    console.error('[API] Erro na requisição:', error.message);
    
    // Verificar tipo de erro
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com status diferente de 2xx
      console.error(`[API] Erro de resposta: status ${error.response.status}`);
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error('[API] Sem resposta do servidor (timeout ou erro de rede)');
      
      // Verificar status atual da conexão
      try {
        const netInfo = await NetInfo.fetch();
        console.error(`[API] Status da rede após falha: ${netInfo.isConnected ? 'Conectado' : 'Desconectado'}, tipo: ${netInfo.type}`);
      } catch (e) {
        // Ignorar erro ao verificar conexão
      }
    } else {
      // Erro durante a configuração da requisição
      console.error('[API] Erro ao configurar requisição:', error.message);
    }

    // Tratar erro 401 (não autorizado)
    if (error.response?.status === 401) {
      console.log('[API] Sessão expirada (401), redirecionando para login');
      // Limpar dados de autenticação
      await AsyncStorage.removeItem('dibau_token');
      await AsyncStorage.removeItem('dibau_user');
    }
    
    return Promise.reject(error);
  }
);

export default api;