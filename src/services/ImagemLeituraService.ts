import api from '../api/axiosConfig';

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
      // Verificar cada fatura individualmente
      for (const fatura of faturas) {
        if (fatura.Leitura && fatura.Leitura.id) {
          try {
            const response = await api.get(`/leituras/${fatura.Leitura.id}/imagem`);
            imagensStatus[fatura.id] = !!response.data.imageUrl;
          } catch (error) {
            // Provavelmente não tem imagem
            imagensStatus[fatura.id] = false;
          }
        } else {
          imagensStatus[fatura.id] = false;
        }
      }
    } catch (error) {
      console.error('Erro ao verificar imagens:', error);
    }
    
    return imagensStatus;
  }
  
  /**
   * Busca a URL da imagem de uma leitura
   * @param leituraId ID da leitura
   * @returns URL da imagem ou null se não existir
   */
  async obterUrlImagem(leituraId: number): Promise<string | null> {
    try {
      const response = await api.get(`/leituras/${leituraId}/imagem`);
      return response.data.imageUrl || null;
    } catch (error) {
      console.error('Erro ao obter URL da imagem:', error);
      return null;
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
      return true;
    } catch (error) {
      console.error('Erro ao excluir imagem:', error);
      return false;
    }
  }
}

export default new ImagemLeituraService();