import api from '../api/axiosConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface ImageLeituraStatus {
  [key: number]: boolean;
}

/**
 * Serviço para gerenciar as imagens de leituras
 */
class ImagemLeituraService {
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
        // Verificar se tem imagem_leitura diretamente no objeto Leitura
        if (fatura.Leitura && typeof fatura.Leitura.imagem_leitura === 'string' && fatura.Leitura.imagem_leitura.length > 0) {
          imagensStatus[fatura.id] = true;
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
   * Método otimizado para verificar se uma leitura tem imagem sem fazer requisição
   * @param leituraId ID da leitura a verificar
   * @returns Boolean indicando se existe ou não imagem associada
   */
  async leituraTemImagem(leituraId: number): Promise<boolean> {
    try {
      // 1. Verificar cache local primeiro
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
      
      // 2. Verificar nos meses carregados
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
      
      // 3. Se não encontrou, assume que não tem
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
      
      return true;
    } catch (error) {
      console.error('Erro ao excluir imagem:', error);
      return false;
    }
  }
}

export default new ImagemLeituraService();