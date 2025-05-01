// src/services/ImagemLeituraService.ts - Versão completa

import api from '../api/axiosConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Permissions from 'expo-permissions';
import axios from 'axios';
import { Platform } from 'react-native';

interface ImageLeituraStatus {
  [key: number]: boolean;
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
          intermediates: true 
        });
        console.log("[IMAGENS] Diretório de imagens criado com sucesso");
      } else {
        console.log("[IMAGENS] Diretório de imagens já existe");
      }
    } catch (error) {
      console.error("[IMAGENS] Erro ao inicializar diretório:", error);
      // Log detalhado para diagnóstico
      if (error instanceof Error) {
        console.error('[IMAGENS] Erro detalhado:', error.name, error.message, error.stack);
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
      console.log("[DEBUG] Iniciando verificação de imagens para", faturas.length, "faturas");
      
      // Definir todas como false por padrão primeiro
      for (const fatura of faturas) {
        imagensStatus[fatura.id] = false;
      }
      
      // Verificar apenas as primeiras 20 faturas para não sobrecarregar
      const faturasParaVerificar = faturas.slice(0, 20);
      
      for (const fatura of faturasParaVerificar) {
        if (fatura.Leitura && fatura.Leitura.id) {
          // Verificar primeiro localmente
          const existeLocalmente = await this.verificarImagemLocal(fatura.Leitura.id);
          
          if (existeLocalmente) {
            imagensStatus[fatura.id] = true;
            continue;
          }
          
          // Se não tem localmente, verificar se tem imagem_leitura diretamente no objeto Leitura
          if (fatura.Leitura && typeof fatura.Leitura.imagem_leitura === 'string' && 
              fatura.Leitura.imagem_leitura.length > 0) {
            imagensStatus[fatura.id] = true;
          }
        }
      }
      
      const totalComImagem = Object.values(imagensStatus).filter(Boolean).length;
      console.log(`[DEBUG] Verificação rápida: ${totalComImagem} faturas com imagens de ${faturas.length} total`);
    } catch (error) {
      console.error('[DEBUG] Erro ao verificar imagens:', error);
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
      console.error('[IMAGENS] Erro ao verificar imagem local:', error);
      return false;
    }
  }
  
  /**
   * Salva uma imagem localmente
   * @param leituraId ID da leitura
   * @param imageUri URI da imagem temporária
   * @returns Caminho da imagem salva ou null em caso de erro
   */
  async salvarImagemLocal(leituraId: number, imageUri: string): Promise<string | null> {
    try {
      // Garantir que o diretório existe
      await this.initializeDirectory();
      
      // Definir caminho de destino no diretório documentDirectory (acessível sem permissões especiais)
      const destPath = `${this.imageDirectory}leitura_${leituraId}.jpg`;
      
      console.log(`[IMAGENS] Tentando salvar imagem em: ${destPath} de origem: ${imageUri}`);
      
      try {
        // Copiar o arquivo temporário para o diretório permanente
        await FileSystem.copyAsync({
          from: imageUri,
          to: destPath
        });
        
        console.log(`[IMAGENS] Imagem salva localmente com sucesso em: ${destPath}`);
        return destPath;
      } catch (copyError) {
        console.error('[IMAGENS] Erro ao copiar arquivo:', copyError);
        
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
          
          console.log(`[IMAGENS] Imagem salva via método alternativo em: ${destPath}`);
          return destPath;
        } catch (writeError) {
          console.error('[IMAGENS] Erro ao escrever arquivo:', writeError);
          throw writeError;
        }
      }
    } catch (error) {
      console.error('[IMAGENS] Erro ao salvar imagem local:', error);
      // Log detalhado do erro para diagnóstico
      if (error instanceof Error) {
        console.error('[IMAGENS] Erro detalhado:', error.name, error.message, error.stack);
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
      console.log(`[IMAGENS] Verificando existência da imagem em: ${imagePath}`);
      
      const fileInfo = await FileSystem.getInfoAsync(imagePath);
      
      if (fileInfo.exists) {
        console.log(`[IMAGENS] Imagem encontrada: ${imagePath}, tamanho: ${fileInfo.size} bytes`);
        // Importante: usar o URI retornado pelo FileSystem, que pode ser diferente em alguns dispositivos
        return fileInfo.uri;
      }
      
      console.log(`[IMAGENS] Imagem não encontrada localmente para leitura ${leituraId}`);
      return null;
    } catch (error) {
      console.error('[IMAGENS] Erro ao obter caminho da imagem:', error);
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
      const mesesIndexStr = await AsyncStorage.getItem('leituras_meses_index');
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
                  await AsyncStorage.setItem(cacheKey, 
                                           JSON.stringify({tem: temImagem, timestamp: Date.now()}));
                  return temImagem;
                }
              }
            } catch (error) {
              console.error(`[IMAGENS] Erro ao verificar mês ${mesAno}:`, error);
            }
          }
        }
      }
      
      // 4. Se não encontrou, assume que não tem
      await AsyncStorage.setItem(cacheKey, 
                                JSON.stringify({tem: false, timestamp: Date.now()}));
      return false;
    } catch (error) {
      console.error('[IMAGENS] Erro ao verificar se leitura tem imagem:', error);
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
        console.log(`[IMAGENS] URL em cache para leitura ${leituraId}: ${cachedUrl}`);
        return cachedUrl;
      }
      
      // Verificar se leitura tem imagem antes de fazer requisição
      const temImagem = await this.leituraTemImagem(leituraId);
      
      if (!temImagem) {
        console.log(`[IMAGENS] Leitura ${leituraId} não tem imagem (verificado em cache)`);
        return null;
      }
      
      // Fazer requisição só se confirmado que tem imagem
      console.log(`[IMAGENS] Buscando URL da imagem para leitura ${leituraId}`);
      const response = await api.get(`/leituras/${leituraId}/imagem`);
      
      if (response.data && response.data.imageUrl) {
        // Salvar URL em cache
        await AsyncStorage.setItem(cacheKey, response.data.imageUrl);
        return response.data.imageUrl;
      }
      
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`[IMAGENS] Imagem não encontrada para leitura ${leituraId}`);
        // Atualizar cache para evitar novas requisições
        await this.atualizarCacheImagem(leituraId, false);
      } else {
        console.error(`[IMAGENS] Erro ao obter URL da imagem para leitura ${leituraId}:`, error);
      }
      return null;
    }
  }
  
  /**
   * Baixa uma imagem do servidor e salva localmente
   * @param leituraId ID da leitura
   * @param forceDownload Forçar download mesmo se já existir localmente
   * @returns Caminho da imagem local ou null em caso de erro
   */
  async baixarImagem(leituraId: number, forceDownload = false): Promise<string | null> {
    try {
      // Verificar se já temos a imagem localmente
      if (!forceDownload) {
        const caminhoLocal = await this.obterCaminhoImagemLocal(leituraId);
        if (caminhoLocal) {
          console.log(`[IMAGENS] Imagem já existe localmente em: ${caminhoLocal}`);
          return caminhoLocal;
        }
      }
      
      console.log(`[IMAGENS] Buscando URL da imagem no servidor para leitura: ${leituraId}`);
      
      // Buscar a URL da imagem no servidor
      const imageUrl = await this.obterUrlImagem(leituraId);
      if (!imageUrl) {
        console.log(`[IMAGENS] URL da imagem não encontrada para leitura: ${leituraId}`);
        return null;
      }
      
      console.log(`[IMAGENS] URL obtida: ${imageUrl}, iniciando download...`);
      
      // Definir o caminho de destino
      const destPath = `${this.imageDirectory}leitura_${leituraId}.jpg`;
      
      // Garantir que o diretório existe
      await this.initializeDirectory();
      
      // Fazer o download da imagem
      const downloadResult = await FileSystem.downloadAsync(
        imageUrl,
        destPath
      );
      
      if (downloadResult.status === 200) {
        console.log(`[IMAGENS] Download concluído com sucesso: ${destPath}`);
        return destPath;
      } else {
        console.log(`[IMAGENS] Download falhou, status: ${downloadResult.status}`);
        return null;
      }
    } catch (error) {
      console.error('[IMAGENS] Erro ao baixar imagem:', error);
      if (error instanceof Error) {
        console.error('[IMAGENS] Erro detalhado:', error.name, error.message, error.stack);
      }
      return null;
    }
  }
  
  /**
   * Atualiza cache do status de imagem para uma leitura
   */
  private async atualizarCacheImagem(leituraId: number, temImagem: boolean): Promise<void> {
    try {
      const cacheKey = `imagem_status_${leituraId}`;
      await AsyncStorage.setItem(cacheKey, 
                                JSON.stringify({tem: temImagem, timestamp: Date.now()}));
    } catch (error) {
      console.error('[IMAGENS] Erro ao atualizar cache:', error);
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
      console.error('Erro ao excluir imagem:', error);
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
      console.error('[IMAGENS] Erro ao excluir imagem local:', error);
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
  async limparImagensFaturasFechadas(mesAno: string, isAllFechada: boolean, faturas: any[]): Promise<number> {
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
        console.log(`[IMAGENS] ${imagensRemovidas} imagens removidas para faturas fechadas de ${mesAno}`);
      }
      
      return imagensRemovidas;
    } catch (error) {
      console.error('[IMAGENS] Erro ao limpar imagens de faturas fechadas:', error);
      return 0;
    }
  }
}

export default new ImagemLeituraService();