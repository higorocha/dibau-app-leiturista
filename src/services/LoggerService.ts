// src/services/LoggerService.ts - Versão Offline-First
// Sistema com cache WatermelonDB: salva logs localmente e sincroniza quando possível
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import Log from '../database/models/Log';

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
  versao_app?: string;
  dispositivo_info?: any;
  rede_info?: any;
  created_at?: Date;
}

class LoggerService {
  private static instance: LoggerService;
  private baseURL: string;
  private sessionId: string = '';
  private minLogLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical' = 'error';

  private constructor() {
    // Configurar URL baseada no ambiente
    this.baseURL = __DEV__
      ? 'http://192.168.1.144:5001/api/logs'
      : 'https://sistema-irrigacao-backend.onrender.com/api/logs';

    this.initializeService();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private initializeService(): void {
    // Gerar session ID único
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (__DEV__) {
      console.log('[LoggerService] ✅ Inicializado (offline-first com WatermelonDB)');
    }
  }

  private shouldLog(nivel: 'debug' | 'info' | 'warning' | 'error' | 'critical'): boolean {
    const levelOrder = { debug: 0, info: 1, warning: 2, error: 3, critical: 4 };
    return levelOrder[nivel] >= levelOrder[this.minLogLevel];
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

  /**
   * Enriquece dados do log com informações do dispositivo e rede
   */
  private async enrichLogData(logData: LogData): Promise<LogCompleto> {
    try {
      const [deviceInfo, networkInfo] = await Promise.all([
        this.getDeviceInfo(),
        this.getNetworkInfo()
      ]);

      return {
        ...logData,
        origem: 'app-irrigacao',
        nivel: logData.nivel || 'info',
        categoria: logData.categoria || 'outros',
        versao_app: Application.nativeApplicationVersion || 'unknown',
        dispositivo_info: deviceInfo,
        rede_info: networkInfo,
        sessao_id: this.sessionId,
        created_at: new Date()
      };
    } catch (error) {
      // Fallback em caso de erro
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

  /**
   * Envia log diretamente ao servidor
   */
  private async sendLogToServer(log: LogCompleto): Promise<boolean> {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Método principal para enviar logs
   * OFFLINE-FIRST: Salva no WatermelonDB primeiro, depois tenta enviar
   */
  public async log(logData: LogData): Promise<void> {
    try {
      const nivel = logData.nivel || 'info';

      // Verificar se deve logar baseado no nível mínimo
      if (!this.shouldLog(nivel)) {
        return;
      }

      const enrichedLog = await this.enrichLogData(logData);

      // 1. SALVAR NO WATERMELONDB (sempre)
      const logsCollection = database.get<Log>('logs');
      let logRecord: Log;

      await database.write(async () => {
        logRecord = await logsCollection.create((record) => {
          record.level = enrichedLog.nivel || 'info';
          record.category = enrichedLog.categoria || 'outros';
          record.message = enrichedLog.mensagem;
          record.details = JSON.stringify({
            titulo: enrichedLog.titulo,
            operacao: enrichedLog.operacao,
            url_endpoint: enrichedLog.url_endpoint,
            metodo_http: enrichedLog.metodo_http,
            codigo_status_http: enrichedLog.codigo_status_http,
            stack_trace: enrichedLog.stack_trace,
            dados_contexto: enrichedLog.dados_contexto,
            dados_requisicao: enrichedLog.dados_requisicao,
            dados_resposta: enrichedLog.dados_resposta,
          });
          record.deviceInfo = JSON.stringify(enrichedLog.dispositivo_info);
          record.appVersion = enrichedLog.versao_app || 'unknown';
          record.userEmail = enrichedLog.usuario_email || null;
          record.syncStatus = 'pending';
          record.errorMessage = null;
        });
      });

      // 2. LOG SALVO LOCALMENTE (SEM ENVIO AUTOMÁTICO)
      if (__DEV__ && (nivel === 'error' || nivel === 'critical')) {
        console.log(`[LOG ${nivel.toUpperCase()}] ${enrichedLog.titulo} - Salvo localmente, aguardando upload manual`);
      }
    } catch (error) {
      // Falha silenciosa para não gerar loop de erros
      if (__DEV__) {
        console.error('[LoggerService] Erro ao processar log:', error);
      }
    }
  }

  // ============================================
  // Métodos de conveniência para diferentes níveis
  // ============================================

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

  // ============================================
  // Métodos especializados por categoria
  // ============================================

  public async logAuth(operacao: string, success: boolean, details?: any): Promise<void> {
    // Só loga falhas de autenticação
    if (success) return;

    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error',
      categoria: 'autenticacao',
      titulo: `Autenticação: ${operacao} - FALHA`,
      mensagem: 'Falha na operação de autenticação',
      operacao,
      dados_contexto: details
    });
  }

  public async logApiRequest(url: string, method: string, statusCode: number, requestData?: any, responseData?: any): Promise<void> {
    // Só loga erros (4xx/5xx)
    if (statusCode < 400) return;

    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error',
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
    // Só loga falhas de sincronização
    if (success) return;

    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error',
      categoria: 'sincronizacao',
      titulo: `Sincronização: ${operacao} - FALHA`,
      mensagem: 'Falha na sincronização',
      operacao,
      dados_contexto: details
    });
  }

  public async logStorage(operacao: string, key: string, success: boolean, error?: any): Promise<void> {
    // Só loga falhas de storage
    if (success) return;

    return this.log({
      origem: 'app-irrigacao',
      nivel: 'error',
      categoria: 'storage',
      titulo: `Storage: ${operacao} - FALHA`,
      mensagem: `Falha na operação ${operacao} para chave ${key}`,
      operacao: `storage_${operacao}`,
      dados_contexto: { key, error: error?.message }
    });
  }

  // ============================================
  // Configuração
  // ============================================

  public setMinLogLevel(level: 'debug' | 'info' | 'warning' | 'error' | 'critical'): void {
    this.minLogLevel = level;
    console.log(`[LoggerService] Nível mínimo de log alterado para: ${level}`);
  }

  public getMinLogLevel(): string {
    return this.minLogLevel;
  }

  /**
   * Obter contagem de logs pendentes de sincronização
   */
  public async getPendingLogsCount(): Promise<number> {
    try {
      const logsCollection = database.get<Log>('logs');
      return await logsCollection
        .query(Q.where('sync_status', Q.oneOf(['pending', 'error'])))
        .fetchCount();
    } catch (error) {
      return 0;
    }
  }
}

export default LoggerService;
