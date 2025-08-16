// src/api/axiosConfig.ts - Versão corrigida
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import LoggerService from '../services/LoggerService';

// Configuração de ambientes
type Environment = 'development' | 'production' | 'test';
const currentEnv: Environment = 'production'; // Mudado para development

// URLs para cada ambiente
const config = {
  development: 'http://192.168.88.23:5001', // IP atualizado conforme solicitado
  production: 'https://sistema-irrigacao-backend.onrender.com',
  test: 'http://localhost:5001'
};

// Criar instância do axios
const api = axios.create({
  baseURL: config[currentEnv],
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // Aumentar timeout para 60 segundos
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
      
      // REMOVIDO: Log de debug de requisições bem-sucedidas
      
      return config;
    } catch (error) {
      console.error('[API] Erro ao preparar requisição:', error);
      
      // Log estruturado do erro
      const logger = LoggerService.getInstance();
      await logger.error(
        'Erro na preparação da requisição',
        'Falha ao configurar headers ou verificar conectividade',
        {
          categoria: 'api-request',
          operacao: 'request_setup_error',
          stack_trace: error instanceof Error ? error.stack : undefined,
          dados_contexto: { error: error instanceof Error ? error.message : String(error) }
        }
      );
      
      return config;
    }
  },
  async (error) => {
    console.error('[API] Erro no interceptor de requisição:', error);
    
    // Log estruturado do erro do interceptor
    const logger = LoggerService.getInstance();
    await logger.error(
      'Erro no interceptor de requisição',
      'Falha antes do envio da requisição',
      {
        categoria: 'api-request',
        operacao: 'request_interceptor_error',
        stack_trace: error instanceof Error ? error.stack : undefined,
        dados_contexto: { error: error instanceof Error ? error.message : String(error) }
      }
    );
    
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros e logs de resposta
api.interceptors.response.use(
  async (response) => {
    console.log(`[API] Resposta recebida de ${response.config.url}, status: ${response.status}`);
    
    // REMOVIDO: Log de debug de respostas bem-sucedidas
    
    return response;
  },
  async (error) => {
    // Log detalhado do erro
    console.error('[API] Erro na requisição:', error.message);
    
    // Preparar dados para log estruturado
    const logger = LoggerService.getInstance();
    const requestUrl = error.config?.url || '';
    const statusCode = error.response?.status;
    const networkInfo = await NetInfo.fetch().catch(() => null);
    
    // Verificar tipo de erro e fazer log apropriado
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com status diferente de 2xx
      console.error(`[API] Erro de resposta: status ${error.response.status}, URL: ${error.config?.url}`);
      
      await logger.error(
        `Erro HTTP ${statusCode}: ${error.config?.method?.toUpperCase()} ${requestUrl}`,
        `Servidor respondeu com erro ${statusCode}`,
        {
          categoria: 'api-request',
          operacao: 'response_error',
          url_endpoint: requestUrl,
          metodo_http: error.config?.method?.toUpperCase(),
          codigo_status_http: statusCode,
          dados_requisicao: {
            headers: error.config?.headers,
            params: error.config?.params,
            hasData: !!error.config?.data
          },
          dados_resposta: {
            status: statusCode,
            data: error.response.data,
            headers: error.response.headers
          },
          stack_trace: error.stack
        }
      );
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error('[API] Sem resposta do servidor (timeout ou erro de rede)');
      
      // Verificar status atual da conexão
      if (networkInfo) {
        console.error(`[API] Status da rede após falha: ${networkInfo.isConnected ? 'Conectado' : 'Desconectado'}, tipo: ${networkInfo.type}`);
      }
      
      await logger.error(
        `Falha de rede: ${error.config?.method?.toUpperCase()} ${requestUrl}`,
        'Requisição não obteve resposta (timeout ou erro de rede)',
        {
          categoria: 'api-request',
          operacao: 'network_error',
          url_endpoint: requestUrl,
          metodo_http: error.config?.method?.toUpperCase(),
          dados_contexto: {
            errorType: 'NO_RESPONSE',
            isConnected: networkInfo?.isConnected,
            networkType: networkInfo?.type,
            timeout: error.code === 'ECONNABORTED'
          },
          stack_trace: error.stack
        }
      );
    } else {
      // Erro durante a configuração da requisição
      console.error('[API] Erro ao configurar requisição:', error.message);
      
      await logger.error(
        `Erro de configuração: ${requestUrl}`,
        'Falha ao configurar requisição',
        {
          categoria: 'api-request',
          operacao: 'config_error',
          url_endpoint: requestUrl,
          dados_contexto: {
            errorType: 'CONFIG_ERROR',
            errorMessage: error.message
          },
          stack_trace: error.stack
        }
      );
    }

    // CORREÇÃO: Tratamento mais inteligente de erro 401
    if (error.response?.status === 401) {
      console.log(`[API] Erro 401 detectado na URL: ${requestUrl}`);
      
      // Só limpar dados de autenticação se for erro específico de login
      // ou se for uma tentativa de verificação de autenticação
      if (requestUrl.includes('/login') || requestUrl.includes('/auth/verify')) {
        console.log('[API] Erro 401 em endpoint de autenticação - limpando dados');
        
        await logger.warning(
          'Erro de autenticação em endpoint de login',
          'Credenciais inválidas ou endpoint de autenticação com problema',
          {
            categoria: 'autenticacao',
            operacao: 'login_auth_error',
            url_endpoint: requestUrl,
            codigo_status_http: 401,
            dados_contexto: { action: 'clearing_auth_data' }
          }
        );
        
        await AsyncStorage.removeItem('dibau_token');
        await AsyncStorage.removeItem('dibau_user');
      } else {
        // Para outros endpoints, apenas logar o erro sem limpar automaticamente
        console.log('[API] Erro 401 em operação - token pode ter expirado, mas não limpando automaticamente');
        console.log('[API] URL da requisição que falhou:', requestUrl);
        
        await logger.warning(
          'Token possivelmente expirado',
          'Erro 401 em operação não relacionada ao login - token pode ter expirado',
          {
            categoria: 'autenticacao',
            operacao: 'token_expired_possible',
            url_endpoint: requestUrl,
            codigo_status_http: 401,
            dados_contexto: { 
              action: 'not_clearing_auth_data',
              requires_user_attention: true
            }
          }
        );
        
        // Marcar que houve problema de autenticação para tratamento posterior
        error.authenticationError = true;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;