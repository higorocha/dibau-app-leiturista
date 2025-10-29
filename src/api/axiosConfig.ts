// src/api/axiosConfig.ts - Versão corrigida
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import LoggerService from '../services/LoggerService';
import Toast from 'react-native-toast-message';

// ========================================
// 🔧 CONFIGURAÇÃO DE AMBIENTES
// ========================================
type Environment = 'development' | 'preview' | 'production';

// ⚙️ ALTERE AQUI O AMBIENTE ATUAL:
// - 'development': Rede local (192.168.1.144:5001)
// - 'preview': Ngrok para testes externos
// - 'production': Servidor de produção (Render)
const currentEnv: Environment = 'preview';

// 🌐 URLs para cada ambiente
const config = {
  // Desenvolvimento: Rede local
  development: 'http://192.168.1.138:5001',

  // Preview: Ngrok (URL ativa)
  //preview: 'https://reissuable-oda-conscionably.ngrok-free.dev',
    preview: 'https://sistema-irrigacao-backend.onrender.com',
  // Produção: Servidor Render
  production: 'https://sistema-irrigacao-backend.onrender.com'
};

// Configurações de segurança
const SECURITY_CONFIG = {
  // Tamanho máximo de resposta em bytes (10MB)
  MAX_RESPONSE_SIZE: 10 * 1024 * 1024,
  // Tamanho máximo de request em bytes (5MB)
  MAX_REQUEST_SIZE: 5 * 1024 * 1024,
  // Tamanho máximo de URI data: em bytes (1MB)
  MAX_DATA_URI_SIZE: 1 * 1024 * 1024,
  // Timeout padrão em ms
  DEFAULT_TIMEOUT: 60000,
};

// 📢 Log do ambiente ativo
console.log(`\n🌍 [AXIOS CONFIG] Ambiente ativo: ${currentEnv.toUpperCase()}`);
console.log(`🔗 [AXIOS CONFIG] Base URL: ${config[currentEnv]}\n`);

// Criar instância do axios
const api = axios.create({
  baseURL: config[currentEnv],
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: SECURITY_CONFIG.DEFAULT_TIMEOUT,
  // Limitar tamanho máximo de conteúdo
  maxContentLength: SECURITY_CONFIG.MAX_RESPONSE_SIZE,
  maxBodyLength: SECURITY_CONFIG.MAX_REQUEST_SIZE,
});

// Função auxiliar para validar e sanitizar dados
const validateRequestData = (config: any): void => {
  // Validação 1: Verificar URIs data: maliciosas
  if (config.url && config.url.startsWith('data:')) {
    const dataUriSize = config.url.length;
    if (dataUriSize > SECURITY_CONFIG.MAX_DATA_URI_SIZE) {
      throw new Error(
        `URI data: excede o tamanho máximo permitido (${dataUriSize} bytes > ${SECURITY_CONFIG.MAX_DATA_URI_SIZE} bytes)`
      );
    }
  }

  // Validação 2: Verificar tamanho do body da requisição
  if (config.data) {
    const dataSize = JSON.stringify(config.data).length;
    if (dataSize > SECURITY_CONFIG.MAX_REQUEST_SIZE) {
      throw new Error(
        `Dados da requisição excedem o tamanho máximo permitido (${dataSize} bytes > ${SECURITY_CONFIG.MAX_REQUEST_SIZE} bytes)`
      );
    }
  }

  // Validação 3: Verificar se há URIs data: em parâmetros
  if (config.params) {
    for (const [key, value] of Object.entries(config.params)) {
      if (typeof value === 'string' && value.startsWith('data:')) {
        const dataUriSize = value.length;
        if (dataUriSize > SECURITY_CONFIG.MAX_DATA_URI_SIZE) {
          throw new Error(
            `Parâmetro '${key}' com URI data: excede o tamanho máximo permitido`
          );
        }
      }
    }
  }
};

// Interceptor para adicionar token e logs de requisição
api.interceptors.request.use(
  async (config) => {
    try {
      // Log da requisição
      console.log(`[API] Enviando requisição para: ${config.method?.toUpperCase()} ${config.url}`);
      
      // ✅ VALIDAÇÃO DE SEGURANÇA: Verificar dados antes de enviar
      validateRequestData(config);
      
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

// Função auxiliar para validar dados de resposta
const validateResponseData = (response: any): void => {
  // Validação 1: Verificar tamanho da resposta
  if (response.data) {
    try {
      const responseSize = JSON.stringify(response.data).length;
      if (responseSize > SECURITY_CONFIG.MAX_RESPONSE_SIZE) {
        console.warn(
          `[API SECURITY] Resposta excede o tamanho máximo permitido: ${responseSize} bytes`
        );
        // Logar o aviso mas não bloquear (já foi baixado)
      }
    } catch (error) {
      // Se não for JSON serializável, não há problema
      console.log('[API] Resposta não é JSON serializável, pulando validação de tamanho');
    }
  }

  // Validação 2: Verificar URIs data: na resposta
  if (response.data && typeof response.data === 'object') {
    const checkDataUris = (obj: any, path = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string' && value.startsWith('data:')) {
          const dataUriSize = value.length;
          if (dataUriSize > SECURITY_CONFIG.MAX_DATA_URI_SIZE) {
            console.warn(
              `[API SECURITY] URI data: no campo '${currentPath}' excede o tamanho máximo: ${dataUriSize} bytes`
            );
          }
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          checkDataUris(value, currentPath);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (item && typeof item === 'object') {
              checkDataUris(item, `${currentPath}[${index}]`);
            }
          });
        }
      }
    };
    
    checkDataUris(response.data);
  }
};

// Interceptor para tratar erros e logs de resposta
api.interceptors.response.use(
  async (response) => {
    console.log(`[API] Resposta recebida de ${response.config.url}, status: ${response.status}`);
    
    // ✅ VALIDAÇÃO DE SEGURANÇA: Verificar dados recebidos
    try {
      validateResponseData(response);
    } catch (error) {
      console.error('[API SECURITY] Erro ao validar resposta:', error);
    }
    
    // REMOVIDO: Log de debug de respostas bem-sucedidas
    
    return response;
  },
  async (error) => {
    // Preparar dados para log estruturado
    const logger = LoggerService.getInstance();
    const requestUrl = error.config?.url || '';
    const statusCode = error.response?.status;
    const networkInfo = await NetInfo.fetch().catch(() => null);

    // Verificar se é um erro 404 esperado (verificação de imagem)
    const isExpected404 =
      statusCode === 404 &&
      requestUrl.includes('/leituras/') &&
      requestUrl.includes('/imagem') &&
      error.config?.method?.toLowerCase() === 'get';

    // Não logar erros 404 esperados na verificação de imagens
    if (isExpected404) {
      // Apenas log silencioso para debug, não para erro
      console.log(`[API] Imagem não encontrada (esperado): ${requestUrl}`);
      return Promise.reject(error);
    }

    // Log detalhado do erro
    console.error('[API] Erro na requisição:', error.message);

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
        // Respeitar modo offline: nunca deslogar se offline
        const netInfoAuth = await NetInfo.fetch().catch(() => null);
        if (netInfoAuth && netInfoAuth.isConnected === false) {
          console.log('[API] 401 em autenticação, porém OFFLINE – não limpar dados nem deslogar');
          Toast.show({
            type: 'info',
            text1: 'Modo offline ativo',
            text2: 'Sessão preservada. Faça login quando reconectar.',
            visibilityTime: 4000
          });
          error.authenticationError = true;
          return Promise.reject(error);
        }
        console.log('[API] Erro 401 em endpoint de autenticação - limpando dados (online)');
        
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