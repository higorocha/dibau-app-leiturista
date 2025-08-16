// src/services/LoggerService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Location from 'expo-location';

// Tipos para logs
export interface LogData {
  origem: 'app-irrigacao' | 'sistema-web' | 'app-irrigantes' | 'sistema-api' | 'outros';
  nivel?: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  categoria?: 'autenticacao' | 'sincronizacao' | 'upload' | 'download' | 'api-request' | 'storage' | 'validacao' | 'navegacao' | 'outros';
  titulo: string;
  mensagem: string;
  operacao?: string;
  url_endpoint?: string;
  metodo_http?: string;
  codigo_status_http?: number;
  stack_trace?: string;
  dados_contexto?: any;
  dados_requisicao?: any;
  dados_resposta?: any;
  usuario_id?: number;
  usuario_email?: string;
  sessao_id?: string;
  correlacao_id?: string;
  processo_id?: string;
}

interface LogCompleto extends LogData {
  id?: number; // Mudado de string para number
  versao_app?: string;
  dispositivo_info?: any;
  rede_info?: any;
  latitude?: number;
  longitude?: number;
  created_at?: Date;
}

class LoggerService {
  private static instance: LoggerService;
  private baseURL: string;
  private logsOffline: LogCompleto[] = [];
  private isOnline: boolean = true;
  private sessionId: string = '';
  private maxLogsOffline: number = 500;
  private minLogLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical' = 'warning'; // Novo: só loga warning+ por padrão

  private constructor() {
    // Configurar URL baseada no ambiente
    this.baseURL = __DEV__ 
      ? 'http://192.168.88.23:5001/api/logs'  // IP atualizado para coincidir com axiosConfig
      : 'https://sistema-irrigacao-backend.onrender.com/api/logs';
    
    this.initializeService();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private async initializeService() {
    try {
      // Gerar session ID único
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Carregar logs offline salvos
      await this.loadOfflineLogs();
      
      // Monitorar conectividade
      this.setupNetworkListener();
      
      // Tentar sincronizar logs pendentes
      if (this.isOnline) {
        await this.syncOfflineLogs();
      }
      
      console.log('[LoggerService] Inicializado com sucesso');
    } catch (error) {
      console.error('[LoggerService] Erro na inicialização:', error);
    }
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected === true;
      
      // Se ficou online e tinha logs offline, sincronizar
      if (wasOffline && this.isOnline && this.logsOffline.length > 0) {
        this.syncOfflineLogs();
      }
    });
  }

  private shouldLog(nivel: 'debug' | 'info' | 'warning' | 'error' | 'critical'): boolean {
    const levelOrder = { debug: 0, info: 1, warning: 2, error: 3, critical: 4 };
    return levelOrder[nivel] >= levelOrder[this.minLogLevel];
  }

  private async loadOfflineLogs() {
    try {
      const storedLogs = await AsyncStorage.getItem('offline_logs');
      if (storedLogs) {
        this.logsOffline = JSON.parse(storedLogs);
        console.log(`[LoggerService] ${this.logsOffline.length} logs offline carregados`);
      }
    } catch (error) {
      console.error('[LoggerService] Erro ao carregar logs offline:', error);
      this.logsOffline = [];
    }
  }

  private async saveOfflineLogs() {
    try {
      // Limitar quantidade de logs offline
      if (this.logsOffline.length > this.maxLogsOffline) {
        this.logsOffline = this.logsOffline.slice(-this.maxLogsOffline);
      }
      
      await AsyncStorage.setItem('offline_logs', JSON.stringify(this.logsOffline));
    } catch (error) {
      console.error('[LoggerService] Erro ao salvar logs offline:', error);
    }
  }

  private async getDeviceInfo() {
    try {
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        modelName: Device.modelName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        totalMemory: Device.totalMemory,
        isDevice: Device.isDevice
      };

      return deviceInfo;
    } catch (error) {
      console.error('[LoggerService] Erro ao obter info do dispositivo:', error);
      return null;
    }
  }

  private async getNetworkInfo() {
    try {
      const networkState = await NetInfo.fetch();
      return {
        type: networkState.type,
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
        details: networkState.details
      };
    } catch (error) {
      console.error('[LoggerService] Erro ao obter info de rede:', error);
      return null;
    }
  }

  private async getLocationInfo() {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low
        });
        
        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
      }
      
      return null;
    } catch (error) {
      // Não logar erro de localização para evitar spam
      return null;
    }
  }

  private async enrichLogData(logData: LogData): Promise<LogCompleto> {
    try {
      const [deviceInfo, networkInfo, locationInfo] = await Promise.all([
        this.getDeviceInfo(),
        this.getNetworkInfo(),
        this.getLocationInfo()
      ]);

      const enrichedLog: LogCompleto = {
        ...logData,
        origem: 'app-irrigacao',
        nivel: logData.nivel || 'info',
        categoria: logData.categoria || 'outros',
        versao_app: Application.nativeApplicationVersion || 'unknown',
        dispositivo_info: deviceInfo,
        rede_info: networkInfo,
        sessao_id: this.sessionId,
        created_at: new Date(),
        ...locationInfo
      };

      return enrichedLog;
    } catch (error) {
      console.error('[LoggerService] Erro ao enriquecer dados do log:', error);
      return {
        ...logData,
        origem: 'app-irrigacao',
        nivel: logData.nivel || 'info',
        categoria: logData.categoria || 'outros',
        sessao_id: this.sessionId,
        created_at: new Date()
      };
    }
  }

  private async sendLogToServer(log: LogCompleto): Promise<boolean> {
    try {
      // Remover o campo 'id' antes de enviar para o servidor
      const { id, ...logData } = log;
      
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData)
      });

      if (response.ok) {
        return true;
      } else {
        console.error(`[LoggerService] Erro HTTP ${response.status} ao enviar log`);
        return false;
      }
    } catch (error) {
      console.error('[LoggerService] Erro de rede ao enviar log:', error);
      return false;
    }
  }

  public async log(logData: LogData): Promise<void> {
    try {
      const nivel = logData.nivel || 'info';
      
      // Verificar se deve logar baseado no nível mínimo
      if (!this.shouldLog(nivel)) {
        return; // Não loga se está abaixo do nível mínimo
      }

      const enrichedLog = await this.enrichLogData(logData);
      
      if (this.isOnline) {
        const success = await this.sendLogToServer(enrichedLog);
        
        if (!success) {
          // Se falhou, salvar offline
          this.logsOffline.push(enrichedLog);
          await this.saveOfflineLogs();
        }
      } else {
        // Salvar offline se não tem conexão
        this.logsOffline.push(enrichedLog);
        await this.saveOfflineLogs();
      }

      // Log local para debug
      if (__DEV__ && (enrichedLog.nivel === 'error' || enrichedLog.nivel === 'critical')) {
        console.error(`[APP LOG ${enrichedLog.nivel.toUpperCase()}]`, enrichedLog.titulo, enrichedLog.mensagem);
      }
    } catch (error) {
      console.error('[LoggerService] Erro ao processar log:', error);
    }
  }

  public async syncOfflineLogs(): Promise<void> {
    if (!this.isOnline || this.logsOffline.length === 0) {
      return;
    }

    try {
      console.log(`[LoggerService] Sincronizando ${this.logsOffline.length} logs offline...`);
      
      // Enviar em lotes para não sobrecarregar
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < this.logsOffline.length; i += batchSize) {
        batches.push(this.logsOffline.slice(i, i + batchSize));
      }

      let syncedCount = 0;
      let failedLogs: LogCompleto[] = [];

      for (const batch of batches) {
        try {
          // Remover campo 'id' de todos os logs do batch
          const cleanBatch = batch.map(log => {
            const { id, ...logData } = log;
            return logData;
          });
          
          const response = await fetch(`${this.baseURL}/bulk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ logs: cleanBatch })
          });

          if (response.ok) {
            syncedCount += batch.length;
          } else {
            failedLogs.push(...batch);
          }
        } catch (error) {
          console.error('[LoggerService] Erro ao sincronizar lote:', error);
          failedLogs.push(...batch);
        }
      }

      // Manter apenas logs que falharam
      this.logsOffline = failedLogs;
      await this.saveOfflineLogs();

      if (syncedCount > 0) {
        console.log(`[LoggerService] ${syncedCount} logs sincronizados com sucesso`);
      }

      if (failedLogs.length > 0) {
        console.warn(`[LoggerService] ${failedLogs.length} logs não puderam ser sincronizados`);
      }
    } catch (error) {
      console.error('[LoggerService] Erro na sincronização de logs:', error);
    }
  }

  // Métodos de conveniência para diferentes níveis de log
  public async debug(titulo: string, mensagem: string, extra?: Partial<LogData>): Promise<void> {
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'debug',
      titulo,
      mensagem,
      ...extra
    });
  }

  public async info(titulo: string, mensagem: string, extra?: Partial<LogData>): Promise<void> {
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'info',
      titulo,
      mensagem,
      ...extra
    });
  }

  public async warning(titulo: string, mensagem: string, extra?: Partial<LogData>): Promise<void> {
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'warning',
      titulo,
      mensagem,
      ...extra
    });
  }

  public async error(titulo: string, mensagem: string, extra?: Partial<LogData>): Promise<void> {
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error',
      titulo,
      mensagem,
      ...extra
    });
  }

  public async critical(titulo: string, mensagem: string, extra?: Partial<LogData>): Promise<void> {
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'critical',
      titulo,
      mensagem,
      ...extra
    });
  }

  // Métodos para logging específico de operações
  public async logAuth(operacao: string, success: boolean, details?: any): Promise<void> {
    // Só loga falhas de autenticação - sucessos não são logados
    if (success) {
      return;
    }
    
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error', // Sempre error para falhas de auth
      categoria: 'autenticacao',
      titulo: `Autenticação: ${operacao} - FALHA`,
      mensagem: 'Falha na operação de autenticação',
      operacao,
      dados_contexto: details
    });
  }

  public async logApiRequest(url: string, method: string, statusCode: number, requestData?: any, responseData?: any): Promise<void> {
    const isError = statusCode >= 400;
    
    // Só loga se for erro (4xx/5xx) - sucessos não são logados
    if (!isError) {
      return;
    }
    
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error', // Sempre error para falhas de API
      categoria: 'api-request',
      titulo: `${method} ${url} - Erro ${statusCode}`,
      mensagem: `Requisição falhou com status ${statusCode}`,
      url_endpoint: url,
      metodo_http: method,
      codigo_status_http: statusCode,
      dados_requisicao: requestData,
      dados_resposta: responseData
    });
  }

  public async logSync(operacao: string, success: boolean, details?: any): Promise<void> {
    // Só loga falhas de sincronização - sucessos não são logados
    if (success) {
      return;
    }
    
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error', // Sempre error para falhas de sync
      categoria: 'sincronizacao',
      titulo: `Sincronização: ${operacao} - FALHA`,
      mensagem: 'Falha na sincronização',
      operacao,
      dados_contexto: details
    });
  }

  public async logStorage(operacao: string, key: string, success: boolean, error?: any): Promise<void> {
    // Só loga falhas de storage - sucessos não são logados
    if (success) {
      return;
    }
    
    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error', // Sempre error para falhas de storage
      categoria: 'storage',
      titulo: `Storage: ${operacao} - FALHA`,
      mensagem: `Falha na operação ${operacao} para chave ${key}`,
      operacao: `storage_${operacao}`,
      dados_contexto: { key, error: error?.message }
    });
  }

  // Método para obter estatísticas dos logs offline
  public getOfflineStats(): { total: number; porNivel: Record<string, number> } {
    const stats = {
      total: this.logsOffline.length,
      porNivel: {} as Record<string, number>
    };

    this.logsOffline.forEach(log => {
      const nivel = log.nivel || 'info';
      stats.porNivel[nivel] = (stats.porNivel[nivel] || 0) + 1;
    });

    return stats;
  }

  // Método para limpar logs offline (usar com cuidado)
  public async clearOfflineLogs(): Promise<void> {
    this.logsOffline = [];
    await AsyncStorage.removeItem('offline_logs');
    console.log('[LoggerService] Logs offline limpos');
  }

  // Método para configurar nível mínimo de logging
  public setMinLogLevel(level: 'debug' | 'info' | 'warning' | 'error' | 'critical'): void {
    this.minLogLevel = level;
    console.log(`[LoggerService] Nível mínimo de log alterado para: ${level}`);
  }

  // Método para obter nível atual
  public getMinLogLevel(): string {
    return this.minLogLevel;
  }
}

export default LoggerService; 