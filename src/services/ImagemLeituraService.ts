// src/services/ImagemLeituraService.ts - Versão Offline-First
// Gerenciamento de imagens de leituras com WatermelonDB + FileSystem

import api from "../api/axiosConfig";
import NetInfo from "@react-native-community/netinfo";
import { database } from "../database";
import { Q } from "@nozbe/watermelondb";
import Imagem from "../database/models/Imagem";
import Leitura from "../database/models/Leitura";
import FileSystemService from "./FileSystemService";
import * as FileSystem from "expo-file-system"; // ✅ Adicionar import

/**
 * Serviço para gerenciar imagens de leituras (offline-first)
 */
class ImagemLeituraService {
  private static instance: ImagemLeituraService;

  public static getInstance(): ImagemLeituraService {
    if (!ImagemLeituraService.instance) {
      ImagemLeituraService.instance = new ImagemLeituraService();
    }
    return ImagemLeituraService.instance;
  }

  /**
   * Verifica quais faturas já possuem imagens (local, no S3, ou servidor)
   * ✅ NOVA LÓGICA: Considera imagemUrl como "tem imagem"
   * @param faturas Array de faturas para verificar
   * @returns Um objeto com os IDs das faturas e se possuem imagem
   */
  async verificarImagensFaturas(faturas: any[]): Promise<{ [key: number]: boolean }> {
    const imagensStatus: { [key: number]: boolean } = {};

    try {
      const imagensCollection = database.get('imagens');
      const leiturasCollection = database.get('leituras');

      for (const fatura of faturas) {
        // 1. Verificar imagem local primeiro (capturada no app ou já baixada)
        const imagemLocal = await imagensCollection
          .query(Q.where('leitura_server_id', fatura.id))
          .fetch();

        if (imagemLocal.length > 0) {
          imagensStatus[fatura.id] = true;
          continue;
        }

        // 2. Verificar se tem hasLocalImage ou imagemUrl no registro da leitura
        const leituraLocal = await leiturasCollection
          .query(Q.where('server_id', fatura.id))
          .fetch();

        if (leituraLocal.length > 0) {
          const leituraData = leituraLocal[0] as any;

          // ✅ PRIORIDADE 1: Tem imagem local já baixada
          if (leituraData.hasLocalImage) {
            imagensStatus[fatura.id] = true;
            continue;
          }

          // ✅ PRIORIDADE 2: Tem imagemUrl (no S3) - será baixada ao visualizar
          if (leituraData.imagemUrl) {
            imagensStatus[fatura.id] = true; // Mostrar botão de visualizar
            continue;
          }
        }

        // ✅ CORREÇÃO: Não tem imagem local nem imagemUrl = não tem imagem
        // Não precisamos verificar na API - após sincronização, imagemUrl estará preenchido
        imagensStatus[fatura.id] = false;
      }

      return imagensStatus;
    } catch (error) {
      console.error("[IMAGENS] Erro ao verificar imagens das faturas:", error);
      return imagensStatus;
    }
  }

  /**
   * Salva imagem localmente e tenta fazer upload para servidor
   * @param imageUri URI da imagem capturada
   * @param leituraId ID da leitura (server_id)
   * @param faturaId ID da fatura
   * @returns Promise com o resultado
   */
  async uploadImagem(
    imageUri: string,
    leituraId: number,
    faturaId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[IMAGENS] Salvando imagem para fatura ${faturaId}`);

      // 1. SALVAR IMAGEM LOCALMENTE
      // ✅ CORREÇÃO: Desestruturar retorno correto de saveImage()
      const { localUri, fileSize } = await FileSystemService.saveImage(imageUri, faturaId);

      console.log(`✅ Imagem salva localmente: ${localUri} (${(fileSize / 1024).toFixed(2)} KB)`);

      // 2. REGISTRAR NO WATERMELONDB
      const imagensCollection = database.get('imagens');
      const leiturasCollection = database.get('leituras');

      // ✅ BUSCAR ID DA LEITURA NO BACKEND (leitura_backend_id)
      const leituras = await leiturasCollection
        .query(Q.where('server_id', faturaId))
        .fetch();

      let leituraBackendId: number | null = null;
      if (leituras.length > 0) {
        const leituraData = leituras[0] as any;
        leituraBackendId = leituraData.leituraBackendId || null;
        console.log(`📋 [IMAGENS] ID da leitura no backend: ${leituraBackendId} (fatura ${faturaId})`);
      } else {
        console.warn(`⚠️ [IMAGENS] Leitura não encontrada no WatermelonDB para fatura ${faturaId}`);
      }

      // ✅ CORREÇÃO: Deletar registros antigos ANTES de criar novo
      const existingImagens = await imagensCollection
        .query(Q.where('leitura_server_id', faturaId))
        .fetch();

      await database.write(async () => {
        // Deletar todos os registros antigos para evitar duplicatas
        for (const oldImage of existingImagens) {
          console.log(`🗑️ Deletando registro antigo de imagem: ${oldImage.id}`);
          await oldImage.markAsDeleted();
        }

        // CRIAR novo registro único
        await imagensCollection.create((record: any) => {
          record.leituraServerId = faturaId; // ID da fatura (para relacionamento local)
          record.leituraBackendId = leituraBackendId; // ✅ ID da leitura no backend (para upload)
          record.localUri = localUri; // ✅ Agora é string correta!
          record.fileSize = fileSize;
          record.uploadedUrl = undefined;
          record.mimeType = 'image/jpeg';
          record.syncStatus = 'uploading';
          record.errorMessage = undefined;
        });
        console.log(`✅ Nova imagem registrada no WatermelonDB (leituraBackendId: ${leituraBackendId})`);

        // Marcar leitura como tendo imagem local
        const leituras = await leiturasCollection
          .query(Q.where('server_id', faturaId))
          .fetch();

        if (leituras.length > 0) {
          await leituras[0].update((record: any) => {
            record.hasLocalImage = true;
          });
        }
      });

      // 3. NOTIFICAR SUCESSO (OFFLINE-FIRST: SEMPRE SALVA LOCALMENTE)
      console.log(`✅ Imagem salva localmente. Aguardando upload manual via botão de sincronização.`);
      return {
        success: true,
        // ✅ Removido o campo 'error' que estava confundindo - não é erro, é sucesso!
      };
    } catch (error: any) {
      console.error('[IMAGENS] Erro ao salvar imagem:', error);

      return {
        success: false,
        error: error.message || 'Erro ao salvar imagem'
      };
    }
  }

  /**
   * Obtém a URL de uma imagem (local ou remota)
   * ✅ CORREÇÃO: SEMPRE prioriza imagem local pendente de upload (sync_status = 'uploading')
   * @param leituraId ID da leitura
   * @returns Promise com a URL da imagem local ou null
   */
  async obterUrlImagem(leituraId: number): Promise<string | null> {
    try {
      console.log(`[IMAGENS] Iniciando visualização da imagem para leitura ID: ${leituraId}`);

      const imagensCollection = database.get('imagens');
      const leiturasCollection = database.get('leituras');

      // 1. ✅ PRIORIDADE MÁXIMA: Imagem local pendente de upload (sync_status = 'uploading')
      const imagensPendentes = await imagensCollection
        .query(
          Q.where('leitura_server_id', leituraId),
          Q.where('sync_status', 'uploading')
        )
        .fetch();

      if (imagensPendentes.length > 0) {
        const imagemPendente = imagensPendentes[0] as any;
        console.log(`🆕 [IMAGENS] Imagem LOCAL PENDENTE encontrada (prioridade): ${imagemPendente.localUri}`);
        console.log(`📊 [IMAGENS] Status: ${imagemPendente.syncStatus}, fileSize: ${imagemPendente.fileSize} bytes`);

        // Validar se arquivo realmente existe
        const fileInfo = await FileSystem.getInfoAsync(imagemPendente.localUri);
        if (fileInfo.exists) {
          console.log(`✅ [IMAGENS] Arquivo validado no FileSystem`);
          return imagemPendente.localUri;
        } else {
          console.log(`⚠️ [IMAGENS] Arquivo local não encontrado (será usado fallback): ${imagemPendente.localUri}`);
          // Deletar registro corrompido
          await database.write(async () => {
            await imagemPendente.markAsDeleted();
          });
        }
      }

      // 2. ✅ SEGUNDA PRIORIDADE: Imagem local já sincronizada (sync_status = 'synced')
      const imagensSincronizadas = await imagensCollection
        .query(
          Q.where('leitura_server_id', leituraId),
          Q.where('sync_status', 'synced')
        )
        .fetch();

      if (imagensSincronizadas.length > 0) {
        const imagemLocal = imagensSincronizadas[0] as any;
        console.log(`📱 [IMAGENS] Imagem local SINCRONIZADA encontrada: ${imagemLocal.localUri}`);

        // Validar se arquivo realmente existe
        const fileInfo = await FileSystem.getInfoAsync(imagemLocal.localUri);
        if (fileInfo.exists) {
          return imagemLocal.localUri;
        } else {
          console.warn(`⚠️ [IMAGENS] Arquivo sincronizado não existe, será baixado novamente`);
          // Deletar registro corrompido
          await database.write(async () => {
            await imagemLocal.markAsDeleted();
          });
        }
      }

      // 3. ✅ TERCEIRA PRIORIDADE: Baixar do S3 se tiver imagemUrl no banco
      const leiturasSincronizadas = await leiturasCollection
        .query(Q.where('server_id', leituraId))
        .fetch();

      if (leiturasSincronizadas.length > 0) {
        const leituraData = leiturasSincronizadas[0] as any;

        if (leituraData.imagemUrl) {
          console.log(`☁️ [IMAGENS] imagemUrl encontrada no banco: ${leituraData.imagemUrl}`);

          // Verificar conexão antes de baixar
          const netInfo = await NetInfo.fetch();
          if (!netInfo.isConnected) {
            console.log(`❌ [IMAGENS] Sem conexão - não pode baixar imagem do S3`);
            return null;
          }

          // ✅ BAIXAR IMAGEM DO S3 E SALVAR LOCALMENTE
          console.log(`📥 [IMAGENS] Baixando imagem do S3...`);

          try {
            const { localUri, fileSize } = await FileSystemService.downloadAndSaveImage(
              leituraData.imagemUrl,
              leituraId
            );

            // ✅ CORREÇÃO: Deletar registros antigos ANTES de criar novo
            const existingImagens = await imagensCollection
              .query(Q.where('leitura_server_id', leituraId))
              .fetch();

            await database.write(async () => {
              // Deletar registros antigos (não deveria ter, mas garantir)
              for (const oldImage of existingImagens) {
                console.log(`🗑️ Deletando registro antigo antes de criar nova entrada`);
                await oldImage.markAsDeleted();
              }

              // Criar registro único na tabela imagens
              await imagensCollection.create((record: any) => {
                record.leituraServerId = leituraId;
                record.localUri = localUri;
                record.fileSize = fileSize;
                record.mimeType = 'image/jpeg';
                record.syncStatus = 'synced'; // Já está no servidor
                record.uploadedUrl = leituraData.imagemUrl; // URL original do S3
              });

              // Marcar leitura como tendo imagem local
              await leiturasSincronizadas[0].update((record: any) => {
                record.hasLocalImage = true;
              });

              console.log(`✅ [IMAGENS] Imagem baixada e registrada no WatermelonDB`);
            });

            return localUri;
          } catch (downloadError: any) {
            console.error(`❌ [IMAGENS] Erro ao baixar imagem do S3:`, downloadError);
            // Se falhar o download, retornar a URL do S3 para tentar exibir diretamente
            return leituraData.imagemUrl;
          }
        }
      }

      // 4. Fallback: Se não tem local nem imagemUrl, tentar buscar do servidor via API
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        console.log(`🔍 [IMAGENS] Buscando imagem no servidor via API...`);
        const response = await api.get(`/leituras/${leituraId}/imagem`);

        if (response.status === 200 && response.data?.imageUrl) {
          console.log(`☁️ [IMAGENS] Imagem encontrada via API: ${response.data.imageUrl}`);
          // Retornar URL direta (não baixar aqui, deixar para próxima visualização)
          return response.data.imageUrl;
        }
      }

      console.log(`❌ [IMAGENS] Nenhuma imagem encontrada para leitura ${leituraId}`);
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`❌ [IMAGENS] Imagem não encontrada (404) para leitura ${leituraId}`);
        return null;
      }

      console.error('[IMAGENS] Erro ao obter URL da imagem:', error);
      return null;
    }
  }

  /**
   * Exclui uma imagem (local e do servidor)
   * @param leituraId ID da leitura cuja imagem será excluída
   * @returns Promise com o resultado da exclusão
   */
  async excluirImagem(leituraId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const imagensCollection = database.get('imagens');
      const leiturasCollection = database.get('leituras');

      // 1. Buscar imagem local
      const imagensLocais = await imagensCollection
        .query(Q.where('leitura_server_id', leituraId))
        .fetch();

      // 2. Excluir arquivo local
      if (imagensLocais.length > 0 && (imagensLocais[0] as any).localUri) {
        await FileSystemService.deleteImage((imagensLocais[0] as any).localUri);
        console.log(`🗑️ Imagem local excluída`);
      }

      // 3. Excluir do WatermelonDB
      await database.write(async () => {
        for (const imagem of imagensLocais) {
          await imagem.markAsDeleted();
        }

        // Desmarcar leitura como tendo imagem
        const leituras = await leiturasCollection
          .query(Q.where('server_id', leituraId))
          .fetch();

        if (leituras.length > 0) {
          await leituras[0].update((record: any) => {
            record.hasLocalImage = false;
          });
        }
      });

      // 4. Tentar excluir do servidor (se online)
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        try {
          await api.delete(`/leituras/${leituraId}/imagem`);
          console.log(`✅ Imagem excluída do servidor`);
        } catch (error) {
          console.warn(`⚠️ Não foi possível excluir do servidor (pode não existir lá ainda)`);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('[IMAGENS] Erro ao excluir imagem:', error);

      return {
        success: false,
        error: error.message || 'Erro ao excluir imagem'
      };
    }
  }
}

export default ImagemLeituraService;
