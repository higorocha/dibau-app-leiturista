import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import api from '../api/axiosConfig';

class FileSystemService {
  private readonly IMAGES_DIR = `${FileSystem.documentDirectory}leituras_imagens/`;

  /**
   * Inicializa diretório de imagens
   */
  async init() {
    const dirInfo = await FileSystem.getInfoAsync(this.IMAGES_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.IMAGES_DIR, { intermediates: true });
      console.log('📁 Diretório de imagens criado:', this.IMAGES_DIR);
    }
  }

  /**
   * Salvar imagem localmente (com compressão)
   */
  async saveImage(uri: string, leituraServerId: number): Promise<{ localUri: string; fileSize: number }> {
    await this.init();

    // Comprimir imagem (80% quality, igual ImagemLeituraService)
    const compressed = await manipulateAsync(uri, [], {
      compress: 0.8,
      format: SaveFormat.JPEG,
    });

    const fileName = `leitura_${leituraServerId}_${Date.now()}.jpg`;
    const localUri = `${this.IMAGES_DIR}${fileName}`;

    await FileSystem.copyAsync({
      from: compressed.uri,
      to: localUri,
    });

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

    console.log(`💾 Imagem salva localmente: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);

    return { localUri, fileSize };
  }

  /**
   * Deletar imagem local
   */
  async deleteImage(localUri: string): Promise<void> {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri);
      console.log('🗑️ Imagem deletada:', localUri);
    }
  }

  /**
   * Obter tamanho total das imagens
   */
  async getTotalSize(): Promise<number> {
    await this.init();
    const files = await FileSystem.readDirectoryAsync(this.IMAGES_DIR);

    let totalSize = 0;
    for (const file of files) {
      const fileUri = `${this.IMAGES_DIR}${file}`;
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists && 'size' in info) {
        totalSize += info.size;
      }
    }

    return totalSize;
  }

  /**
   * Baixar imagem de URL (S3) e salvar localmente
   * Se URL é apenas path do S3, solicita signed URL primeiro
   */
  async downloadAndSaveImage(urlOrPath: string, leituraServerId: number): Promise<{ localUri: string; fileSize: number }> {
    await this.init();

    const fileName = `leitura_${leituraServerId}_${Date.now()}.jpg`;
    const localUri = `${this.IMAGES_DIR}${fileName}`;

    console.log(`📥 Iniciando download de imagem: ${urlOrPath}`);

    // Verificar se é URL completa ou apenas path do S3
    let downloadUrl: string;

    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      // Já é uma URL completa
      downloadUrl = urlOrPath;
      console.log('✅ URL completa detectada');
    } else {
      // É apenas o path do S3, precisamos obter signed URL
      console.log('🔑 Path do S3 detectado, obtendo signed URL...');

      try {
        const response = await api.get('/api/s3/signed-url', {
          params: { key: urlOrPath }
        });

        if (!response.data || !response.data.success || !response.data.data?.signedUrl) {
          throw new Error('Resposta inválida ao obter signed URL');
        }

        downloadUrl = response.data.data.signedUrl;
        console.log('✅ Signed URL obtida com sucesso');
      } catch (error: any) {
        console.error('❌ Erro ao obter signed URL:', error);
        throw new Error(`Erro ao obter URL de download: ${error.message}`);
      }
    }

    // Baixar imagem da URL assinada
    console.log(`📥 Baixando de: ${downloadUrl.substring(0, 100)}...`);
    const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Erro ao baixar imagem: HTTP ${downloadResult.status}`);
    }

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

    console.log(`✅ Imagem baixada e salva: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);

    return { localUri, fileSize };
  }

  /**
   * Limpar todas as imagens (se usuário quiser)
   */
  async clearAll(): Promise<void> {
    await this.init();
    const files = await FileSystem.readDirectoryAsync(this.IMAGES_DIR);

    for (const file of files) {
      await FileSystem.deleteAsync(`${this.IMAGES_DIR}${file}`);
    }

    console.log('🗑️ Todas as imagens locais deletadas');
  }
}

export default new FileSystemService();
