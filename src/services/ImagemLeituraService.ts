// src/services/ImagemLeituraService.ts - Versão completa

import api from "../api/axiosConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import axios from "axios";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import LoggerService from "./LoggerService";

interface ImageLeituraStatus {
  [key: number]: boolean;
}

interface ImageUploadCallbacks {
  onStart?: (total: number) => void;
  onProgress?: (processed: number, total: number) => void;
  onComplete?: (success: boolean, uploadedCount: number) => void;
  onCancel?: () => void;
  checkCancelled?: () => boolean;
  specificFaturaIds?: number[]; // Novo parâmetro para filtrar faturas específicas
}

/**
 * Serviço para gerenciar as imagens de leituras
 */
class ImagemLeituraService {
  // Diretório para salvar imagens localmente
  private imageDirectory = `${FileSystem.documentDirectory}imagens_leituras/`;

  constructor() {
    // Garantir que o diretório existe
    this.initializeDirectory();
  }

  /**
   * Inicializa o diretório de imagens
   */
  private async initializeDirectory() {
    try {
      // Garantir que o diretório existe
      const dirInfo = await FileSystem.getInfoAsync(this.imageDirectory);

      if (!dirInfo.exists) {
        console.log(`[IMAGENS] Criando diretório: ${this.imageDirectory}`);
        await FileSystem.makeDirectoryAsync(this.imageDirectory, {
          intermediates: true,
        });
        console.log("[IMAGENS] Diretório de imagens criado com sucesso");
      } else {
        console.log("[IMAGENS] Diretório de imagens já existe");
      }
    } catch (error) {
      console.error("[IMAGENS] Erro ao inicializar diretório:", error);
      // Log detalhado para diagnóstico
      if (error instanceof Error) {
        console.error(
          "[IMAGENS] Erro detalhado:",
          error.name,
          error.message,
          error.stack
        );
      }
      throw error; // Propagar o erro para tratamento adequado
    }
  }

  /**
   * Verifica quais faturas já possuem imagens de leitura
   * @param faturas Array de faturas para verificar
   * @returns Um objeto com os IDs das faturas e se possuem imagem
   */
  async verificarImagensFaturas(faturas: any[]): Promise<ImageLeituraStatus> {
    const imagensStatus: ImageLeituraStatus = {};

    try {
      console.log(
        "[DEBUG] Iniciando verificação de imagens para",
        faturas.length,
        "faturas"
      );

      // Definir todas como false por padrão primeiro
      for (const fatura of faturas) {
        imagensStatus[fatura.id] = false;
      }

      // Verificar apenas as primeiras 20 faturas para não sobrecarregar
      const faturasParaVerificar = faturas.slice(0, 20);

      for (const fatura of faturasParaVerificar) {
        if (fatura.Leitura && fatura.Leitura.id) {
          // Verificar primeiro localmente
          const existeLocalmente = await this.verificarImagemLocal(
            fatura.Leitura.id
          );

          if (existeLocalmente) {
            imagensStatus[fatura.id] = true;
            continue;
          }

          // Se não tem localmente, verificar se tem imagem_leitura diretamente no objeto Leitura
          if (
            fatura.Leitura &&
            typeof fatura.Leitura.imagem_leitura === "string" &&
            fatura.Leitura.imagem_leitura.length > 0
          ) {
            imagensStatus[fatura.id] = true;
          }
        }
      }

      const totalComImagem =
        Object.values(imagensStatus).filter(Boolean).length;
      console.log(
        `[DEBUG] Verificação rápida: ${totalComImagem} faturas com imagens de ${faturas.length} total`
      );
    } catch (error) {
      console.error("[DEBUG] Erro ao verificar imagens:", error);
    }

    return imagensStatus;
  }

  /**
   * Verifica se existe uma imagem local para uma leitura
   * @param leituraId ID da leitura
   * @returns Boolean indicando se existe imagem local
   */
  async verificarImagemLocal(leituraId: number): Promise<boolean> {
    try {
      const imagePath = `${this.imageDirectory}leitura_${leituraId}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(imagePath);
      return fileInfo.exists;
    } catch (error) {
      console.error("[IMAGENS] Erro ao verificar imagem local:", error);
      return false;
    }
  }

  /**
   * Salva uma imagem localmente
   * @param leituraId ID da leitura
   * @param imageUri URI da imagem temporária
   * @returns Caminho da imagem salva ou null em caso de erro
   */
  async salvarImagemLocal(
    leituraId: number,
    imageUri: string
  ): Promise<string | null> {
    try {
      // Garantir que o diretório existe
      await this.initializeDirectory();

      // Definir caminho de destino no diretório documentDirectory (acessível sem permissões especiais)
      const destPath = `${this.imageDirectory}leitura_${leituraId}.jpg`;

      console.log(
        `[IMAGENS] Tentando salvar imagem em: ${destPath} de origem: ${imageUri}`
      );

      try {
        // Copiar o arquivo temporário para o diretório permanente
        await FileSystem.copyAsync({
          from: imageUri,
          to: destPath,
        });

        console.log(
          `[IMAGENS] Imagem salva localmente com sucesso em: ${destPath}`
        );
        return destPath;
      } catch (copyError) {
        console.error("[IMAGENS] Erro ao copiar arquivo:", copyError);

        // Tentar abordagem alternativa se a cópia falhar
        try {
          // Ler o conteúdo do arquivo como base64
          const base64Data = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Escrever o arquivo no destino
          await FileSystem.writeAsStringAsync(destPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log(
            `[IMAGENS] Imagem salva via método alternativo em: ${destPath}`
          );
          return destPath;
        } catch (writeError) {
          console.error("[IMAGENS] Erro ao escrever arquivo:", writeError);
          throw writeError;
        }
      }
    } catch (error) {
      console.error("[IMAGENS] Erro ao salvar imagem local:", error);
      // Log detalhado do erro para diagnóstico
      if (error instanceof Error) {
        console.error(
          "[IMAGENS] Erro detalhado:",
          error.name,
          error.message,
          error.stack
        );
      }
      return null;
    }
  }

  /**
   * Obtém o caminho da imagem local de uma leitura
   * @param leituraId ID da leitura
   * @returns Caminho da imagem ou null se não existir
   */
  async obterCaminhoImagemLocal(leituraId: number): Promise<string | null> {
    try {
      const imagePath = `${this.imageDirectory}leitura_${leituraId}.jpg`;
      console.log(
        `[IMAGENS] Verificando existência da imagem em: ${imagePath}`
      );

      const fileInfo = await FileSystem.getInfoAsync(imagePath);

      if (fileInfo.exists) {
        console.log(
          `[IMAGENS] Imagem encontrada: ${imagePath}, tamanho: ${fileInfo.size} bytes`
        );
        // Importante: usar o URI retornado pelo FileSystem, que pode ser diferente em alguns dispositivos
        return fileInfo.uri;
      }

      console.log(
        `[IMAGENS] Imagem não encontrada localmente para leitura ${leituraId}`
      );
      return null;
    } catch (error) {
      console.error("[IMAGENS] Erro ao obter caminho da imagem:", error);
      return null;
    }
  }

  /**
   * Método otimizado para verificar se uma leitura tem imagem sem fazer requisição
   * @param leituraId ID da leitura a verificar
   * @returns Boolean indicando se existe ou não imagem associada
   */
  async leituraTemImagem(leituraId: number): Promise<boolean> {
    try {
      // 1. Verificar localmente primeiro
      const temLocalmente = await this.verificarImagemLocal(leituraId);
      if (temLocalmente) {
        return true;
      }

      // 2. Verificar cache local primeiro
      const cacheKey = `imagem_status_${leituraId}`;
      const cachedStatus = await AsyncStorage.getItem(cacheKey);

      if (cachedStatus) {
        const { tem, timestamp } = JSON.parse(cachedStatus);
        const agora = Date.now();
        const umDiaEmMS = 24 * 60 * 60 * 1000;

        // Se o cache tem menos de 1 dia, retornar o valor em cache
        if (agora - timestamp < umDiaEmMS) {
          return tem;
        }
      }

      // 3. Verificar nos meses carregados
      const mesesIndexStr = await AsyncStorage.getItem("leituras_meses_index");
      if (mesesIndexStr) {
        const mesesIndex = JSON.parse(mesesIndexStr);
        const MAX_MESES = 3; // Limita a quantidade de meses para verificar

        for (const mesAno of mesesIndex.slice(0, MAX_MESES)) {
          const chave = `leituras_mes_${mesAno.replace("/", "_")}`;
          const mesDataStr = await AsyncStorage.getItem(chave);

          if (mesDataStr) {
            try {
              const mesData = JSON.parse(mesDataStr);

              // Buscar na lista de faturas desse mês
              for (const fatura of mesData.faturas || []) {
                if (fatura.Leitura && fatura.Leitura.id === leituraId) {
                  // Encontrou a leitura, salvar no cache e retornar
                  const temImagem = !!fatura.Leitura.imagem_leitura;
                  await AsyncStorage.setItem(
                    cacheKey,
                    JSON.stringify({ tem: temImagem, timestamp: Date.now() })
                  );
                  return temImagem;
                }
              }
            } catch (error) {
              console.error(
                `[IMAGENS] Erro ao verificar mês ${mesAno}:`,
                error
              );
            }
          }
        }
      }

      // 4. Se não encontrou, assume que não tem
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ tem: false, timestamp: Date.now() })
      );
      return false;
    } catch (error) {
      console.error(
        "[IMAGENS] Erro ao verificar se leitura tem imagem:",
        error
      );
      return false;
    }
  }

  /**
   * Busca a URL da imagem de uma leitura
   * @param leituraId ID da leitura
   * @returns URL da imagem ou null se não existir
   */
  async obterUrlImagem(leituraId: number): Promise<string | null> {
    try {
      // Verificar cache primeiro
      const cacheKey = `imagem_url_${leituraId}`;
      const cachedUrl = await AsyncStorage.getItem(cacheKey);

      if (cachedUrl) {
        console.log(
          `[IMAGENS] URL em cache para leitura ${leituraId}: ${cachedUrl}`
        );
        return cachedUrl;
      }

      // MODIFICAÇÃO PRINCIPAL: Forçar a consulta à API mesmo se a verificação local diz que não tem imagem
      // Isso é necessário para imagens antigas que não têm status em cache
      console.log(
        `[IMAGENS] Cache não encontrado, consultando API diretamente para leitura ${leituraId}`
      );

      try {
        // Fazer a chamada à API diretamente
        const response = await api.get(`/leituras/${leituraId}/imagem`);

        if (response.data && response.data.imageUrl) {
          // Salvar URL em cache
          await AsyncStorage.setItem(cacheKey, response.data.imageUrl);
          console.log(
            `[IMAGENS] URL obtida da API e salva em cache: ${response.data.imageUrl}`
          );

          // Também atualizar status da imagem em cache
          await this.atualizarCacheImagem(leituraId, true);

          return response.data.imageUrl;
        } else {
          console.log(
            `[IMAGENS] API não retornou URL para leitura ${leituraId}`
          );
          // Atualizar cache para evitar novas requisições
          await this.atualizarCacheImagem(leituraId, false);
          return null;
        }
      } catch (apiError) {
        // Verificar se o erro foi 404 (imagem não encontrada)
        if (axios.isAxiosError(apiError) && apiError.response?.status === 404) {
          console.log(
            `[IMAGENS] API retornou 404 para leitura ${leituraId} - imagem não existe`
          );
          // Atualizar cache para evitar novas requisições
          await this.atualizarCacheImagem(leituraId, false);
          return null;
        }

        // Para outros erros, podemos rejeitar a promise para que seja tratado pelo chamador
        console.error(
          `[IMAGENS] Erro na API ao buscar URL para leitura ${leituraId}:`,
          apiError
        );
        throw apiError;
      }
    } catch (error) {
      console.error(
        `[IMAGENS] Erro ao obter URL da imagem para leitura ${leituraId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Baixa uma imagem do servidor e salva localmente
   * @param leituraId ID da leitura
   * @param forceDownload Forçar download mesmo se já existir localmente
   * @returns Caminho da imagem local ou null em caso de erro
   */
  async baixarImagem(
    leituraId: number,
    forceDownload = false
  ): Promise<string | null> {
    try {
      // Verificar se já temos a imagem localmente
      if (!forceDownload) {
        const caminhoLocal = await this.obterCaminhoImagemLocal(leituraId);
        if (caminhoLocal) {
          console.log(
            `[IMAGENS] Imagem já existe localmente em: ${caminhoLocal}`
          );
          return caminhoLocal;
        }
      }

      console.log(
        `[IMAGENS] Buscando URL da imagem no servidor para leitura: ${leituraId}`
      );

      // Buscar a URL da imagem no servidor (agora com consulta direta à API)
      const imageUrl = await this.obterUrlImagem(leituraId);
      if (!imageUrl) {
        console.log(
          `[IMAGENS] URL da imagem não encontrada para leitura: ${leituraId}`
        );
        return null;
      }

      console.log(`[IMAGENS] URL obtida: ${imageUrl}, iniciando download...`);

      // Definir o caminho de destino
      const destPath = `${this.imageDirectory}leitura_${leituraId}.jpg`;

      // Garantir que o diretório existe
      await this.initializeDirectory();

      try {
        // Fazer o download da imagem
        const downloadResult = await FileSystem.downloadAsync(
          imageUrl,
          destPath
        );

        if (downloadResult.status === 200) {
          console.log(`[IMAGENS] Download concluído com sucesso: ${destPath}`);
          return destPath;
        } else {
          console.log(
            `[IMAGENS] Download falhou, status: ${downloadResult.status}`
          );
          return null;
        }
      } catch (downloadError) {
        console.error(
          `[IMAGENS] Erro durante o download da imagem:`,
          downloadError
        );
        // Tentativa alternativa de download (apenas para debugging/log)
        console.log(`[IMAGENS] URL que tentamos baixar: ${imageUrl}`);
        console.log(`[IMAGENS] Destino tentado: ${destPath}`);
        return null;
      }
    } catch (error) {
      console.error("[IMAGENS] Erro ao baixar imagem:", error);
      if (error instanceof Error) {
        console.error(
          "[IMAGENS] Erro detalhado:",
          error.name,
          error.message,
          error.stack
        );
      }
      return null;
    }
  }

  /**
   * Atualiza cache do status de imagem para uma leitura
   */
  private async atualizarCacheImagem(
    leituraId: number,
    temImagem: boolean
  ): Promise<void> {
    try {
      const cacheKey = `imagem_status_${leituraId}`;
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ tem: temImagem, timestamp: Date.now() })
      );
    } catch (error) {
      console.error("[IMAGENS] Erro ao atualizar cache:", error);
    }
  }

  /**
   * Exclui a imagem de uma leitura
   * @param leituraId ID da leitura
   * @returns Se a exclusão foi bem-sucedida
   */
  async excluirImagem(leituraId: number): Promise<boolean> {
    try {
      await api.delete(`/leituras/${leituraId}/imagem`);

      // Limpar cache após excluir
      await AsyncStorage.removeItem(`imagem_status_${leituraId}`);
      await AsyncStorage.removeItem(`imagem_url_${leituraId}`);

      // Excluir a versão local, se existir
      await this.excluirImagemLocal(leituraId);

      return true;
    } catch (error) {
      console.error("Erro ao excluir imagem:", error);
      return false;
    }
  }

  /**
   * Exclui apenas a imagem local de uma leitura
   * @param leituraId ID da leitura
   * @returns Se a exclusão foi bem-sucedida
   */
  async excluirImagemLocal(leituraId: number): Promise<boolean> {
    try {
      const imagePath = `${this.imageDirectory}leitura_${leituraId}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(imagePath);

      if (fileInfo.exists) {
        await FileSystem.deleteAsync(imagePath);
        console.log(`[IMAGENS] Imagem local excluída: ${imagePath}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error("[IMAGENS] Erro ao excluir imagem local:", error);
      return false;
    }
  }

  /**
   * Limpa imagens locais de faturas fechadas
   * @param mesAno String no formato "MM/YYYY"
   * @param isAllFechada Flag indicando se todas as faturas do mês estão fechadas
   * @param faturas Lista de faturas para verificar IDs de leitura
   * @returns Número de imagens removidas
   */
  async limparImagensFaturasFechadas(
    mesAno: string,
    isAllFechada: boolean,
    faturas: any[]
  ): Promise<number> {
    if (!isAllFechada) {
      return 0; // Só limpa se todas as faturas estiverem fechadas
    }

    try {
      let imagensRemovidas = 0;

      // Remover imagens das faturas fechadas
      for (const fatura of faturas) {
        if (fatura.Leitura && fatura.Leitura.id) {
          const removido = await this.excluirImagemLocal(fatura.Leitura.id);
          if (removido) {
            imagensRemovidas++;
          }
        }
      }

      if (imagensRemovidas > 0) {
        console.log(
          `[IMAGENS] ${imagensRemovidas} imagens removidas para faturas fechadas de ${mesAno}`
        );
      }

      return imagensRemovidas;
    } catch (error) {
      console.error(
        "[IMAGENS] Erro ao limpar imagens de faturas fechadas:",
        error
      );
      return 0;
    }
  }

  /**
   * Salva informações sobre uma imagem pendente de upload
   */
  async salvarImagemPendente(
    leituraId: number,
    faturaId: number,
    imagePath: string
  ): Promise<boolean> {
    try {
      // Buscar pendências existentes
      const pendingImagesStr =
        (await AsyncStorage.getItem("pendingImagesUploads")) || "{}";
      const pendingImages = JSON.parse(pendingImagesStr);

      // Adicionar nova pendência
      pendingImages[leituraId] = {
        leituraId,
        faturaId,
        imagePath,
        timestamp: new Date().toISOString(),
      };

      // Salvar no AsyncStorage
      await AsyncStorage.setItem(
        "pendingImagesUploads",
        JSON.stringify(pendingImages)
      );
      console.log(
        `[IMAGENS] Imagem para leitura ${leituraId} marcada como pendente de upload`
      );

      return true;
    } catch (error) {
      console.error("[IMAGENS] Erro ao salvar imagem pendente:", error);
      return false;
    }
  }

  /**
   * Verifica se há imagens pendentes para upload
   */
  async verificarImagensPendentes(
    faturas?: any[]
  ): Promise<{ [key: number]: boolean }> {
    try {
      // Buscar pendências existentes
      const pendingImagesStr =
        (await AsyncStorage.getItem("pendingImagesUploads")) || "{}";
      const pendingImages = JSON.parse(pendingImagesStr);

      // Transformar para o formato esperado (ID da fatura -> boolean)
      const result: { [key: number]: boolean } = {};

      Object.values(pendingImages).forEach((item: any) => {
        if (!faturas || faturas.some((f) => f.id === item.faturaId)) {
          result[item.faturaId] = true;
        }
      });

      return result;
    } catch (error) {
      console.error("[IMAGENS] Erro ao verificar imagens pendentes:", error);
      return {};
    }
  }

  // Adicionar ao final da classe ImagemLeituraService
  /**
   * Realiza o upload de imagens pendentes
   * @param callbacks Objeto com callbacks para acompanhar o progresso
   * @returns Resultado da operação
   */
  async uploadImagensPendentes(
    callbacks?: ImageUploadCallbacks
  ): Promise<{ success: boolean; uploadedCount: number }> {
    try {
      console.log(
        "[DEBUG IMAGENS] Iniciando verificação de pendências de imagens"
      );

      // Verificar conexão
      const netInfoState = await NetInfo.fetch();
      if (!netInfoState.isConnected) {
        console.log("[IMAGENS] Sem conexão, não é possível fazer upload");
        
        // Log de erro de conectividade
        await LoggerService.getInstance().warning('Upload Imagens', 'Sem conexão de rede para upload', {
          categoria: 'upload',
          dados_contexto: {
            network_state: netInfoState.type,
            operation: 'upload_images_no_network'
          }
        });
        
        return { success: false, uploadedCount: 0 };
      }

      // Buscar pendências existentes
      const pendingImagesStr =
        (await AsyncStorage.getItem("pendingImagesUploads")) || "{}";
      console.log("[DEBUG IMAGENS] pendingImagesUploads:", pendingImagesStr);
      const pendingImages = JSON.parse(pendingImagesStr);

      // Se não há pendências, retornar
      let pendingIds = Object.keys(pendingImages);

      // NOVO: Filtrar por faturas específicas se fornecidas
      if (callbacks?.specificFaturaIds) {
        const specificFaturaIds = callbacks.specificFaturaIds;
        if (specificFaturaIds.length > 0) {
          const faturaIdsSet = new Set(specificFaturaIds.map(id => Number(id)));
          
          pendingIds = pendingIds.filter(leituraId => {
            const pendingImage = pendingImages[leituraId];
            // Verificar se a imagem pertence a uma das faturas especificadas
            return pendingImage && faturaIdsSet.has(Number(pendingImage.faturaId));
          });
          
          console.log(`[IMAGENS] Filtrando para processar apenas ${pendingIds.length} imagens de faturas específicas`);
        }
      }

      if (pendingIds.length === 0) {
        return { success: true, uploadedCount: 0 };
      }

      console.log(
        `[IMAGENS] Iniciando upload de ${pendingIds.length} imagens pendentes`
      );

      // Notificar início, se houver callback
      if (callbacks?.onStart) {
        callbacks.onStart(pendingIds.length);
      }

      // Para cada imagem pendente, realizar upload
      let uploadedCount = 0;
      const newPendingImages = { ...pendingImages };

      // Processar em lotes para melhorar desempenho
      const BATCH_SIZE = 5; // Menor que o de leituras para não sobrecarregar
      const totalBatches = Math.ceil(pendingIds.length / BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Verificar cancelamento, se houver
        if (callbacks?.checkCancelled && callbacks.checkCancelled()) {
          console.log("[IMAGENS] Upload cancelado pelo usuário");
          if (callbacks?.onCancel) callbacks.onCancel();
          return { success: false, uploadedCount };
        }

        // Obter o lote atual
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, pendingIds.length);
        const batchIds = pendingIds.slice(startIdx, endIdx);

        // Processar cada imagem no lote sequencialmente
        for (const leituraId of batchIds) {
          // Verificar cancelamento
          if (callbacks?.checkCancelled && callbacks.checkCancelled()) {
            console.log("[IMAGENS] Upload cancelado pelo usuário");
            if (callbacks?.onCancel) callbacks.onCancel();
            return { success: false, uploadedCount };
          }

          const pendingImage = pendingImages[leituraId];

          try {
            // Verificar se o arquivo existe
            const fileInfo = await FileSystem.getInfoAsync(
              pendingImage.imagePath
            );
            if (!fileInfo.exists) {
              console.log(
                `[IMAGENS] Arquivo não encontrado: ${pendingImage.imagePath}`
              );
              delete newPendingImages[leituraId];
              continue;
            }

            // Pequeno atraso para não sobrecarregar
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Criar FormData para upload
            const formData = new FormData();

            // Extrair extensão e nome do arquivo
            const extensao =
              pendingImage.imagePath.split(".").pop()?.toLowerCase() || "jpg";
            const nomeArquivo = `leitura_${leituraId}_${Date.now()}.${extensao}`;

            // Adicionar arquivo ao FormData
            formData.append("imagem", {
              uri: pendingImage.imagePath,
              name: nomeArquivo,
              type: `image/${extensao}`,
            } as any);

            // Enviar para o servidor
            const response = await api.post(
              `/leituras/${leituraId}/imagem`,
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              }
            );

            if (response.status === 200) {
              // Remover da lista de pendentes
              delete newPendingImages[leituraId];
              uploadedCount++;

              // REMOVIDO: Log de sucesso individual (sucesso normal)

              // Notificar progresso, se houver callback
              if (callbacks?.onProgress) {
                callbacks.onProgress(uploadedCount, pendingIds.length);
              }

              console.log(
                `[IMAGENS] Upload da imagem ${leituraId} concluído com sucesso`
              );
            }
          } catch (error) {
            console.error(
              `[IMAGENS] Erro ao fazer upload da imagem ${leituraId}:`,
              error
            );

            // Log de erro individual
            await LoggerService.getInstance().error('Upload Imagem', `Erro no upload da imagem leitura ${leituraId}`, {
              categoria: 'upload',
              dados_contexto: {
                leitura_id: leituraId,
                fatura_id: pendingImage.faturaId,
                error_message: (error as any)?.message,
                error_status: (error as any)?.response?.status,
                file_path: pendingImage.imagePath,
                progress: `${uploadedCount}/${pendingIds.length}`,
                operation: 'upload_image_error'
              }
            });

            // Manter na lista de pendentes para tentar novamente depois
          }
        }

        // Atraso entre lotes
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Salvar lista atualizada de pendências
      await AsyncStorage.setItem(
        "pendingImagesUploads",
        JSON.stringify(newPendingImages)
      );

      // REMOVIDO: Log de conclusão do upload (sucesso normal)

      // Notificar conclusão, se houver callback
      if (callbacks?.onComplete) {
        callbacks.onComplete(true, uploadedCount);
      }

      return { success: true, uploadedCount };
    } catch (error) {
      console.error(
        "[IMAGENS] Erro ao fazer upload de imagens pendentes:",
        error
      );

      // Log de erro geral
      await LoggerService.getInstance().error('Upload Imagens', 'Erro geral no upload de imagens pendentes', {
        categoria: 'upload',
        dados_contexto: {
          error_message: (error as any)?.message,
          uploaded_count: 0,
          operation: 'upload_images_error'
        }
      });

      // Notificar erro, se houver callback
      if (callbacks?.onComplete) {
        callbacks.onComplete(false, 0);
      }

      return { success: false, uploadedCount: 0 };
    }
  }
}

export default new ImagemLeituraService();