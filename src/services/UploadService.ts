import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import axios from '../api/axiosConfig';
import Leitura from '../database/models/Leitura';
import Imagem from '../database/models/Imagem';
import Log from '../database/models/Log';
import Observacao from '../database/models/Observacao';
import ObservacaoComentario from '../database/models/ObservacaoComentario';
import * as FileSystem from 'expo-file-system';

export interface UploadProgress {
  leiturasTotal: number;
  leiturasEnviadas: number;
  imagensTotal: number;
  imagensEnviadas: number;
  leiturasComErro: number;
  imagensComErro: number;
  observacoesTotal: number;
  observacoesEnviadas: number;
  observacoesComErro: number;
  comentariosTotal: number;
  comentariosEnviados: number;
  comentariosComErro: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
}

class UploadService {
  private progressCallback?: (progress: UploadProgress) => void;

  /**
   * Fazer upload manual de todas as pendências
   */
  async uploadAll(onProgress?: (progress: UploadProgress) => void): Promise<UploadProgress> {
    this.progressCallback = onProgress;

    const progress: UploadProgress = {
      leiturasTotal: 0,
      leiturasEnviadas: 0,
      imagensTotal: 0,
      imagensEnviadas: 0,
      leiturasComErro: 0,
      imagensComErro: 0,
      observacoesTotal: 0,
      observacoesEnviadas: 0,
      observacoesComErro: 0,
      comentariosTotal: 0,
      comentariosEnviados: 0,
      comentariosComErro: 0,
      status: 'uploading',
    };

    try {
      // 1. Upload de Leituras
      await this.uploadLeituras(progress);

      // 2. Upload de Imagens
      await this.uploadImagens(progress);

      // 3. Upload de Observações + Comentários (UNIFICADO - transacional)
      await this.uploadObservacoesEComentarios(progress);

      // 4. Upload de Logs (silencioso, sem progresso visual)
      await this.uploadLogs();

      progress.status = 'completed';
      this.notifyProgress(progress);

      return progress;
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      progress.status = 'error';
      this.notifyProgress(progress);
      return progress;
    }
  }

  /**
   * Upload de Leituras
   */
  private async uploadLeituras(progress: UploadProgress) {
    const leiturasCollection = database.get('leituras');
    const leiturasPendentes = await leiturasCollection
      .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
      .fetch();

    progress.leiturasTotal = leiturasPendentes.length;
    this.notifyProgress(progress);

    console.log(`📤 Enviando ${leiturasPendentes.length} leituras...`);

    for (const leitura of leiturasPendentes) {
      try {
        const leituraData = leitura as any;
        
        // Marcar como "uploading"
        await database.write(async () => {
          await leitura.update((record: any) => {
            record.syncStatus = 'uploading';
          });
        });

        // Enviar para API (campos que a API espera)
        await axios.put(`/faturamensal/app/atualizar-leitura/${leituraData.serverId}`, {
          leitura: leituraData.leituraAtual,       // ✅ API espera "leitura"
          data_leitura: leituraData.dataLeitura,   // ✅ API espera "data_leitura" (snake_case)
        });

        // Marcar como "synced"
        await database.write(async () => {
          await leitura.update((record: any) => {
            record.syncStatus = 'synced';
            record.errorMessage = undefined;
            record.lastSyncAt = Date.now();
          });
        });

        progress.leiturasEnviadas++;
        this.notifyProgress(progress);

        console.log(`✅ Leitura ${leituraData.serverId} enviada`);
      } catch (error: any) {
        const leituraData = leitura as any;
        console.error(`❌ Erro ao enviar leitura ${leituraData.serverId}:`, error.message);

        await database.write(async () => {
          await leitura.update((record: any) => {
            record.syncStatus = 'error';
            record.errorMessage = error.message || 'Erro desconhecido';
          });
        });

        progress.leiturasComErro++;
        this.notifyProgress(progress);
      }
    }
  }

  /**
   * Upload de Imagens
   */
  private async uploadImagens(progress: UploadProgress) {
    const imagensCollection = database.get('imagens');
    const imagensPendentes = await imagensCollection
      .query(Q.where('sync_status', Q.oneOf(['uploading', 'error'])))
      .fetch();

    // Filtrar apenas imagens que ainda não foram sincronizadas
    const imagensParaEnviar = imagensPendentes.filter((img) => img.syncStatus !== 'synced');

    progress.imagensTotal = imagensParaEnviar.length;
    this.notifyProgress(progress);

    console.log(`📤 Enviando ${imagensParaEnviar.length} imagens...`);

    for (const imagem of imagensParaEnviar) {
      try {
        const imagemData = imagem as any;
        console.log(`📸 [UPLOAD] Processando imagem da fatura ${imagemData.leituraServerId}`);
        console.log(`📊 [UPLOAD] localUri: ${imagemData.localUri}`);
        console.log(`📊 [UPLOAD] syncStatus: ${imagemData.syncStatus}`);
        console.log(`📊 [UPLOAD] leituraBackendId: ${imagemData.leituraBackendId}`);

        // ✅ VALIDAÇÃO ROBUSTA do arquivo local
        const fileInfo = await FileSystem.getInfoAsync(imagemData.localUri);
        console.log(`📊 [UPLOAD] Verificação do arquivo:`, {
          exists: fileInfo.exists,
          uri: fileInfo.uri,
          size: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 'N/A',
          isDirectory: fileInfo.exists && 'isDirectory' in fileInfo ? fileInfo.isDirectory : 'N/A'
        });

        if (!fileInfo.exists) {
          throw new Error(`Arquivo não encontrado no caminho: ${imagemData.localUri}`);
        }

        if ('size' in fileInfo && fileInfo.size === 0) {
          throw new Error('Arquivo está vazio (0 bytes)');
        }

        // Marcar como "uploading"
        await database.write(async () => {
          await imagem.update((record: any) => {
            record.syncStatus = 'uploading';
          });
        });

        console.log(`📤 [UPLOAD] Criando FormData para upload...`);

        // ✅ VALIDAÇÃO: Verificar se temos o ID da leitura no backend
        if (!imagemData.leituraBackendId) {
          throw new Error(
            `leituraBackendId não disponível para fatura ${imagemData.leituraServerId}. ` +
            `Sincronize novamente para obter o ID correto da leitura.`
          );
        }

        // Criar FormData
        const formData = new FormData();
        formData.append('imagem', {
          uri: imagemData.localUri,
          type: imagemData.mimeType,
          name: `leitura_${imagemData.leituraBackendId}.jpg`,
        } as any);

        console.log(`🚀 [UPLOAD] Enviando para API: POST /leituras/${imagemData.leituraBackendId}/imagem`);

        // Enviar para API
        const response = await axios.post(
          `/leituras/${imagemData.leituraBackendId}/imagem`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000,
          }
        );

        console.log(`✅ [UPLOAD] Resposta da API:`, response.data);

        // Marcar como "synced"
        await database.write(async () => {
          await imagem.update((record: any) => {
            record.syncStatus = 'synced';
            record.uploadedUrl = response.data.imageUrl || undefined;
            record.errorMessage = undefined;
          });
        });

        // Atualizar leitura correspondente
        const leiturasCollection = database.get('leituras');
        const leituras = await leiturasCollection
          .query(Q.where('server_id', imagemData.leituraServerId))
          .fetch();

        if (leituras.length > 0) {
          await database.write(async () => {
            await leituras[0].update((record: any) => {
              record.imagemUrl = response.data.imageUrl || undefined;
              record.hasLocalImage = true;
            });
          });
        }

        progress.imagensEnviadas++;
        this.notifyProgress(progress);

        console.log(`✅ Imagem da leitura ${imagemData.leituraServerId} enviada com sucesso`);
      } catch (error: any) {
        const imagemData = imagem as any;
        console.error(`❌ [UPLOAD] Erro ao enviar imagem ${imagemData.leituraServerId}:`, error);
        console.error(`❌ [UPLOAD] Stack trace:`, error.stack);
        console.error(`❌ [UPLOAD] Detalhes do erro:`, {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });

        await database.write(async () => {
          await imagem.update((record: any) => {
            record.syncStatus = 'error';
            record.errorMessage = error.message || 'Erro desconhecido';
          });
        });

        progress.imagensComErro++;
        this.notifyProgress(progress);
      }
    }
  }

  /**
   * Upload UNIFICADO de Observações + Comentários (TRANSACIONAL)
   *
   * ✅ SOLUÇÃO DEFINITIVA para o problema de observações criadas offline com comentários:
   * - Backend processa tudo em uma transação SQL
   * - Cria mapping local_id → server_id no backend
   * - Vincula comentários corretamente usando o mapping
   * - Rollback automático em caso de erro
   */
  private async uploadObservacoesEComentarios(progress: UploadProgress) {
    const observacoesCollection = database.get('observacoes');
    const comentariosCollection = database.get('observacoes_comentarios');

    // Buscar observações pendentes
    const observacoesPendentes = await observacoesCollection
      .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
      .fetch();

    // Buscar comentários pendentes
    const comentariosPendentes = await comentariosCollection
      .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
      .fetch();

    progress.observacoesTotal = observacoesPendentes.length;
    progress.comentariosTotal = comentariosPendentes.length;
    this.notifyProgress(progress);

    console.log(`📤 [SYNC UNIFICADO] Enviando ${observacoesPendentes.length} observação(ões) + ${comentariosPendentes.length} comentário(s)...`);

    // Preparar payload unificado
    const observacoesPayload: any[] = [];
    const comentariosPayload: any[] = [];

    // Mapear observações pendentes
    for (const observacao of observacoesPendentes) {
      const obsData = observacao as any;
      observacoesPayload.push({
        local_id: obsData.id, // ID local do WatermelonDB (usado como chave de mapping)
        id: obsData.serverId || undefined,
        lote_id: obsData.loteId,
        tipo: obsData.tipo,
        status: obsData.status,
        titulo: obsData.titulo,
        descricao: obsData.descricao || '',
        usuario_criador_id: obsData.usuarioCriadorId,
        usuario_finalizador_id: obsData.usuarioFinalizadorId || undefined,
        data_finalizacao: obsData.dataFinalizacao ? new Date(obsData.dataFinalizacao).toISOString() : undefined,
      });
    }

    // Mapear comentários pendentes
    for (const comentario of comentariosPendentes) {
      const comData = comentario as any;

      // ✅ CRÍTICO: Buscar observação local para pegar o local_id correto
      const observacaoLocal = await observacoesCollection.find(comData.observacaoId);
      const observacaoLocalData = observacaoLocal as any;

      comentariosPayload.push({
        local_id: comData.id, // ID local do comentário
        id: comData.serverId || undefined,
        observacao_local_id: observacaoLocalData.id, // ✅ Referência ao local_id da observação
        observacao_server_id: comData.observacaoServerId || undefined,
        comentario: comData.comentario,
        usuario_id: comData.usuarioId,
      });
    }

    try {
      // ✅ ENVIAR TUDO EM UMA ÚNICA REQUISIÇÃO (backend processa transacionalmente)
      const response = await axios.post('/api/observacoes/app/sync', {
        observacoes: observacoesPayload,
        comentarios: comentariosPayload
      });

      const resultados = response.data.data;

      // Processar resultados de OBSERVAÇÕES
      for (const resultado of resultados.observacoes.sucesso) {
        const localId = resultado.local_id;
        const serverId = resultado.server_id;

        // Encontrar observação local pelo ID do WatermelonDB
        const observacaoLocal = await observacoesCollection.find(localId);

        await database.write(async () => {
          await observacaoLocal.update((record: any) => {
            record.syncStatus = 'synced';
            record.serverId = serverId;
            record.errorMessage = undefined;
            record.syncedAt = new Date(Date.now());
          });
        });

        progress.observacoesEnviadas++;
        this.notifyProgress(progress);

        console.log(`✅ [SYNC] Observação ${serverId} ${resultado.acao}`);
      }

      // Processar erros de OBSERVAÇÕES
      for (const erro of resultados.observacoes.erros) {
        const obsErro = erro.observacao;
        const observacaoLocal = await observacoesCollection.find(obsErro.local_id);

        await database.write(async () => {
          await observacaoLocal.update((record: any) => {
            record.syncStatus = 'error';
            record.errorMessage = erro.erro;
          });
        });

        progress.observacoesComErro++;
        this.notifyProgress(progress);

        console.error(`❌ [SYNC] Erro em observação ${obsErro.local_id}:`, erro.erro);
      }

      // Processar resultados de COMENTÁRIOS
      for (const resultado of resultados.comentarios.sucesso) {
        const localId = resultado.local_id;
        const serverId = resultado.server_id;

        // Encontrar comentário local pelo ID do WatermelonDB
        const comentarioLocal = await comentariosCollection.find(localId);

        await database.write(async () => {
          await comentarioLocal.update((record: any) => {
            record.syncStatus = 'synced';
            record.serverId = serverId;
            record.errorMessage = undefined;
            record.syncedAt = new Date(Date.now());
          });
        });

        progress.comentariosEnviados++;
        this.notifyProgress(progress);

        console.log(`✅ [SYNC] Comentário ${serverId} ${resultado.acao}`);
      }

      // Processar erros de COMENTÁRIOS
      for (const erro of resultados.comentarios.erros) {
        const comErro = erro.comentario;

        try {
          const comentarioLocal = await comentariosCollection.find(comErro.local_id);

          await database.write(async () => {
            await comentarioLocal.update((record: any) => {
              record.syncStatus = 'error';
              record.errorMessage = erro.erro;
            });
          });
        } catch (findError) {
          console.error(`❌ [SYNC] Não foi possível marcar comentário ${comErro.local_id} como erro`);
        }

        progress.comentariosComErro++;
        this.notifyProgress(progress);

        console.error(`❌ [SYNC] Erro em comentário ${comErro.local_id}:`, erro.erro);
      }

      console.log(`✅ [SYNC UNIFICADO] Concluído: ${progress.observacoesEnviadas} obs + ${progress.comentariosEnviados} com enviados`);
    } catch (error: any) {
      console.error(`❌ [SYNC UNIFICADO] Erro crítico:`, error.message);

      // Marcar TODAS as observações e comentários pendentes como erro
      for (const obs of observacoesPendentes) {
        await database.write(async () => {
          await obs.update((record: any) => {
            record.syncStatus = 'error';
            record.errorMessage = error.message || 'Erro na sincronização unificada';
          });
        });
        progress.observacoesComErro++;
      }

      for (const com of comentariosPendentes) {
        await database.write(async () => {
          await com.update((record: any) => {
            record.syncStatus = 'error';
            record.errorMessage = error.message || 'Erro na sincronização unificada';
          });
        });
        progress.comentariosComErro++;
      }

      this.notifyProgress(progress);
    }
  }

  /**
   * Upload de Logs (silencioso, sem progresso visual)
   */
  private async uploadLogs() {
    const logsCollection = database.get('logs');
    const logsPendentes = await logsCollection
      .query(Q.where('sync_status', Q.oneOf(['pending', 'error'])))
      .fetch();

    console.log(`📤 Enviando ${logsPendentes.length} logs...`);

    for (const log of logsPendentes) {
      try {
        const logData = log as any;
        
        await database.write(async () => {
          await log.update((record: any) => {
            record.syncStatus = 'uploading';
          });
        });

        // Enviar para API (mapear campos locais para formato da API)
        await axios.post(
          '/api/logs',
          {
            origem: 'app-irrigacao',                    // ✅ Campo obrigatório da API
            titulo: `[${logData.category.toUpperCase()}] ${logData.message.substring(0, 100)}`, // ✅ Campo obrigatório
            mensagem: logData.message,                      // ✅ Campo obrigatório
            nivel: logData.level,                           // ✅ Opcional: debug, info, warning, error, critical
            categoria: logData.category,                    // ✅ Opcional: categoria livre
            dados_adicionais: JSON.stringify({          // ✅ Opcional: dados extras
              details: logData.details ? JSON.parse(logData.details) : null,
              deviceInfo: logData.deviceInfo ? JSON.parse(logData.deviceInfo) : null,
              appVersion: logData.appVersion,
              userEmail: logData.userEmail,
            }),
          },
          { timeout: 5000 }
        );

        // Deletar após envio bem-sucedido
        await database.write(async () => {
          await log.markAsDeleted();
        });

        console.log(`✅ Log ${logData.id} enviado e deletado`);
      } catch (error: any) {
        const logData = log as any;
        console.error(`❌ Erro ao enviar log ${logData.id}:`, error.message);

        await database.write(async () => {
          await log.update((record: any) => {
            record.syncStatus = 'error';
            record.errorMessage = error.message || 'Erro desconhecido';
          });
        });
      }
    }
  }

  /**
   * Notificar callback de progresso
   */
  private notifyProgress(progress: UploadProgress) {
    if (this.progressCallback) {
      this.progressCallback({ ...progress });
    }
  }
}

export default new UploadService();
