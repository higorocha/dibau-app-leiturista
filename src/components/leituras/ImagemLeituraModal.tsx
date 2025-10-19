// src/components/leituras/ImagemLeituraModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Camera } from "expo-camera";
import NetInfo from "@react-native-community/netinfo";
import api from "../../api/axiosConfig";
import Toast from "react-native-toast-message";
import ImagePreviewModal from "./ImagePreviewModal";
import CameraPermissionRequestModal from "./CameraPermissionRequestModal";
import GalleryPermissionRequestModal from "./GalleryPermissionRequestModal";
import ImagePreviewView from "./ImagePreviewView";
import ImagemLeituraService from "@/src/services/ImagemLeituraService";
import * as FileSystem from "expo-file-system";
import SyncLoadingOverlay from "../common/SyncLoadingOverlay";
import { database } from "../../database";
import { Q } from "@nozbe/watermelondb";
import Imagem, { ImageSyncStatus } from "../../database/models/Imagem";
import FileSystemService from "../../services/FileSystemService";

interface ImagemLeituraModalProps {
  isVisible: boolean;
  onClose: () => void;
  faturaId: number | null;
  leituraId: number | null;
  hasExistingImage: boolean;
  onImageUploaded: (faturaId: number, hasImage?: boolean) => void;
}

const ImagemLeituraModal: React.FC<ImagemLeituraModalProps> = ({
  isVisible,
  onClose,
  faturaId,
  leituraId,
  hasExistingImage,
  onImageUploaded,
}) => {
  const [showConfirmOverwrite, setShowConfirmOverwrite] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showGalleryPermissionModal, setShowGalleryPermissionModal] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(
    null
  );
  const [showCamera, setShowCamera] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [showSyncOverlay, setShowSyncOverlay] = useState(false);
  const [syncOverlayType, setSyncOverlayType] = useState<'loading' | 'success' | 'error'>('loading');
  const [syncOverlayTitle, setSyncOverlayTitle] = useState('');
  const [syncOverlaySubtitle, setSyncOverlaySubtitle] = useState('');
  const [showInternalToast, setShowInternalToast] = useState(false);
  const [internalToastMessage, setInternalToastMessage] = useState('');
  const [internalToastType, setInternalToastType] = useState<'error' | 'success'>('error');

  useEffect(() => {
    // Quando o modal é aberto e já existe uma imagem, mostrar confirmação
    if (isVisible && hasExistingImage) {
      setShowConfirmOverwrite(true);
    } else {
      setShowConfirmOverwrite(false);
    }
  }, [isVisible, hasExistingImage]);

  // Verificar se já temos permissão de câmera (sem solicitar)
  const verificarPermissaoCamera = async (): Promise<boolean> => {
    const { status } = await Camera.getCameraPermissionsAsync();
    setCameraPermission(status === "granted");
    return status === "granted";
  };

  // Solicitar permissão após o usuário confirmar no modal personalizado
  const solicitarPermissaoCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === "granted");

    if (status === "granted") {
      setShowPermissionModal(false);
      await abrirCamera();
    } else {
      Alert.alert(
        "Permissão Negada",
        "Não é possível capturar imagens sem acesso à câmera. Você pode alterar isso nas configurações do dispositivo.",
        [{ text: "OK" }]
      );
    }
  };

  // Função para abrir a câmera após verificar/obter permissão
  const abrirCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Redimensionar a imagem para otimizar o upload
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1000 } }], // redimensiona para largura de 1000px
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        setCapturedImage(manipResult.uri);
        setShowPreview(true);
      }
    } catch (error) {
      console.error("Erro ao capturar imagem:", error);
      Alert.alert("Erro", "Não foi possível capturar a imagem.");
    }
  };

  // Função para iniciar o processo de captura
  const capturarImagem = async () => {
    try {
      if (!faturaId) {
        return;
      }

      // Verificar se já tem permissão
      const temPermissao = await verificarPermissaoCamera();

      if (!temPermissao) {
        // Mostrar modal personalizado em vez de solicitar permissão diretamente
        setShowPermissionModal(true);
        return;
      }

      // Se já tem permissão, abrir câmera diretamente
      await abrirCamera();
    } catch (error) {
      console.error("Erro ao capturar imagem:", error);
      Alert.alert("Erro", "Não foi possível capturar a imagem.");
    }
  };

  const selecionarDaGaleria = async () => {
    try {
      // Verificar se já temos permissão
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      if (status === "granted") {
        // Já temos permissão, prosseguir direto
        await abrirGaleria();
      } else {
        // Mostrar modal educativo antes de solicitar permissão
        setShowGalleryPermissionModal(true);
      }
    } catch (error) {
      console.error("Erro ao verificar permissão da galeria:", error);
      Alert.alert("Erro", "Não foi possível verificar as permissões.");
    }
  };

  // Solicitar permissão após o usuário confirmar no modal personalizado
  const solicitarPermissaoGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status === "granted") {
      setShowGalleryPermissionModal(false);
      await abrirGaleria();
    } else {
      Alert.alert(
        "Permissão Negada",
        "Não é possível acessar a galeria sem permissão. Você pode alterar isso nas configurações do dispositivo.",
        [{ text: "OK" }]
      );
    }
  };

  const abrirGaleria = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Redimensionar a imagem
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        setCapturedImage(manipResult.uri);
        setShowPreview(true);
      }
    } catch (error) {
      console.error("Erro ao selecionar imagem:", error);
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  };

  /**
   * ✅ CORRIGIDO: Salva imagem localmente SEMPRE (offline-first)
   * Upload para servidor será feito posteriormente via UploadService
   */
  const uploadImagem = async () => {
    if (!capturedImage || !leituraId || !faturaId) {
      return;
    }

    setUploading(true);

    try {
      // ✅ SALVAR LOCALMENTE SEMPRE (sem verificar conexão)
      const service = ImagemLeituraService.getInstance();
      const result = await service.uploadImagem(capturedImage, leituraId, faturaId);

      if (result.success) {
        onImageUploaded(faturaId, true); // Imagem foi ADICIONADA

        Toast.show({
          type: "success",
          text1: "Imagem salva localmente!",
          text2: "Use o botão de upload na tela principal para enviar ao servidor",
          position: "bottom",
          visibilityTime: 3000,
        });

        setCapturedImage(null);
        setShowPreview(false);
        onClose();
      } else {
        Alert.alert(
          "Erro ao salvar",
          result.error || "Não foi possível salvar a imagem localmente. Tente novamente.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("[UPLOAD] Erro ao processar imagem:", error);
      Alert.alert(
        "Erro",
        "Ocorreu um erro inesperado ao salvar a imagem. Tente novamente.",
        [{ text: "OK" }]
      );
    } finally {
      setUploading(false);
    }
  };

  /**
   * ✅ CORRIGIDO: Visualizar imagem (local primeiro, depois servidor se online)
   * Funciona offline para imagens já capturadas localmente
   */
  const visualizarImagemExistente = async () => {
    if (!leituraId || !faturaId) {
      console.log("[IMAGENS] Erro: leituraId ou faturaId não definidos");
      return;
    }

    try {
      console.log(
        `[IMAGENS] Iniciando visualização da imagem para leitura ID: ${leituraId}`
      );
      setUploading(true);

      Toast.show({
        type: "info",
        text1: "Carregando imagem...",
        text2: "Buscando imagem local ou do servidor",
        position: "bottom",
        visibilityTime: 1500,
      });

      // ✅ BUSCAR IMAGEM (local primeiro, servidor depois se necessário)
      const service = ImagemLeituraService.getInstance();
      const urlImagem = await service.obterUrlImagem(leituraId);

      if (urlImagem) {
        console.log(`[IMAGENS] URL obtida: ${urlImagem}`);

        // Fechar modal de confirmação
        setShowConfirmOverwrite(false);

        // Exibir imagem
        setImagePreviewUri(urlImagem);
        setShowImagePreview(true);
        setUploading(false);
      } else {
        console.log("[IMAGENS] Nenhuma imagem encontrada");
        
        // ✅ MENSAGEM MAIS CLARA: Pode ser por estar offline OU por não ter imagem
        const netInfo = await NetInfo.fetch();
        const mensagem = !netInfo.isConnected 
          ? "Nenhuma imagem local encontrada. Conecte-se à internet para buscar imagens do servidor."
          : "Nenhuma imagem encontrada para esta leitura.";
          
        Alert.alert("Imagem não encontrada", mensagem, [{ text: "OK" }]);
        setUploading(false);
      }
    } catch (error) {
      console.error("[IMAGENS] Erro ao visualizar imagem:", error);

      Toast.show({
        type: "error",
        text1: "Erro ao carregar imagem",
        text2: "Ocorreu um erro inesperado. Tente novamente.",
        position: "bottom",
        visibilityTime: 3000,
      });

      setUploading(false);
    }
  };

  const handleConfirmOverwrite = () => {
    setShowConfirmOverwrite(false);
  };

  const handleClosePreview = () => {
    setCapturedImage(null);
    setShowPreview(false);
  };

  /**
   * Verifica o status de sincronização de uma imagem
   * @param leituraId ID da leitura para verificar
   * @returns Promise com o status da imagem ou null se não encontrada
   */
  const verificarStatusImagem = async (leituraId: number): Promise<ImageSyncStatus | null> => {
    try {
      const imagensCollection = database.get('imagens');
      
      // Buscar imagem pela leitura_server_id (faturaId)
      const imagens = await imagensCollection
        .query(Q.where('leitura_server_id', leituraId))
        .fetch();

      if (imagens.length > 0) {
        return (imagens[0] as any).syncStatus as ImageSyncStatus;
      }

      return null;
    } catch (error) {
      console.error('[IMAGENS] Erro ao verificar status da imagem:', error);
      return null;
    }
  };

  /**
   * Mostra toast interno dentro do modal
   */
  const showInternalToastMessage = (message: string, type: 'error' | 'success' = 'error') => {
    setInternalToastMessage(message);
    setInternalToastType(type);
    setShowInternalToast(true);
    
    // Auto-hide após 3 segundos
    setTimeout(() => {
      setShowInternalToast(false);
    }, 3000);
  };

  /**
   * Exclui imagem SOMENTE LOCAL (sem tentar excluir do servidor)
   * @param leituraId ID da leitura cuja imagem será excluída
   * @returns Promise com o resultado da exclusão
   */
  const excluirImagemLocal = async (leituraId: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const imagensCollection = database.get('imagens');
      const leiturasCollection = database.get('leituras');

      // 1. Buscar imagem local
      const imagensLocais = await imagensCollection
        .query(Q.where('leitura_server_id', leituraId))
        .fetch();

      // 2. Excluir arquivo local do FileSystem
      if (imagensLocais.length > 0 && (imagensLocais[0] as any).localUri) {
        await FileSystemService.deleteImage((imagensLocais[0] as any).localUri);
        console.log(`🗑️ Imagem local excluída do FileSystem`);
      }

      // 3. Excluir do WatermelonDB
      await database.write(async () => {
        for (const imagem of imagensLocais) {
          await imagem.markAsDeleted();
        }

        // Desmarcar leitura como tendo imagem local
        const leituras = await leiturasCollection
          .query(Q.where('server_id', leituraId))
          .fetch();

        if (leituras.length > 0) {
          await leituras[0].update((record: any) => {
            record.hasLocalImage = false;
          });
        }
      });

      console.log(`✅ Imagem local excluída com sucesso (ID: ${leituraId})`);
      return { success: true };
    } catch (error: any) {
      console.error('[IMAGENS] Erro ao excluir imagem local:', error);
      return {
        success: false,
        error: error.message || 'Erro ao excluir imagem local'
      };
    }
  };

  /**
   * Lida com a solicitação de exclusão de imagem
   * Verifica o status e permite exclusão apenas se não foi sincronizada
   */
  const handleExcluirImagem = () => {
    if (!leituraId || !faturaId) {
      console.error('[IMAGENS] leituraId ou faturaId não definidos para exclusão');
      return;
    }

    console.log(`[IMAGENS] Iniciando processo de exclusão para fatura ${faturaId}`);
    
    // Mostrar loading overlay (mantém modal de confirmação aberto)
    setShowSyncOverlay(true);
    setSyncOverlayType('loading');
    setSyncOverlayTitle('Verificando imagem...');
    setSyncOverlaySubtitle('Aguarde um momento');

    // Pequeno delay para garantir que o overlay apareça
    setTimeout(async () => {
      try {

        // Verificar status da imagem local
        const statusImagemLocal = await verificarStatusImagem(faturaId);
        console.log(`[IMAGENS] Status da imagem local: ${statusImagemLocal}`);

        // Verificar se existe imagem online (na tabela leituras)
        const leiturasCollection = database.get('leituras');
        const leituras = await leiturasCollection
          .query(Q.where('server_id', faturaId))
          .fetch();

        let existeImagemOnline = false;
        if (leituras.length > 0) {
          const leituraData = leituras[0] as any;
          existeImagemOnline = !!leituraData.imagemUrl;
        }

        console.log(`[IMAGENS] Existe imagem online: ${existeImagemOnline}`);

        // LÓGICA CONFORME ESPECIFICADO:
        if (!statusImagemLocal && existeImagemOnline) {
          // Não existe local, mas existe online -> não pode excluir
          setShowSyncOverlay(false); // Fechar overlay
          
          showInternalToastMessage(
            "Esta imagem já foi enviada ao servidor e não pode ser excluída, apenas alterada.",
            'error'
          );
          return;
        }

        if (!statusImagemLocal && !existeImagemOnline) {
          // Não existe nem local nem online - erro
          setShowSyncOverlay(false); // Fechar overlay
          
          Toast.show({
            type: "error",
            text1: "Imagem não encontrada",
            text2: "Não foi possível localizar a imagem para exclusão",
            position: "bottom",
            visibilityTime: 3000,
          });
          return;
        }

        if (statusImagemLocal === 'synced') {
          // Existe local mas já foi transmitida -> não pode excluir
          setShowSyncOverlay(false); // Fechar overlay
          
          showInternalToastMessage(
            "Esta imagem já foi enviada ao servidor e não pode ser excluída, apenas alterada.",
            'error'
          );
          return;
        }

        // Existe local e não foi transmitida ('uploading' ou 'error') - PODE EXCLUIR
        console.log(`[IMAGENS] Imagem local com status '${statusImagemLocal}' pode ser excluída - iniciando exclusão...`);
        
        setSyncOverlayTitle('Excluindo imagem...');
        setSyncOverlaySubtitle('Removendo arquivo local');

        // Excluir imagem SOMENTE LOCAL (não do servidor)
        const result = await excluirImagemLocal(faturaId);

        if (result.success) {
          // Sucesso na exclusão - fechar overlay e modal imediatamente
          setShowSyncOverlay(false);
          setShowConfirmOverwrite(false);
          onClose();

          // Verificar se ainda existe imagem do servidor (imagemUrl na tabela leituras)
          const leiturasCollection = database.get('leituras');
          const leituras = await leiturasCollection
            .query(Q.where('server_id', faturaId))
            .fetch();

          let aindaTemImagemServidor = false;
          if (leituras.length > 0) {
            const leituraData = leituras[0] as any;
            aindaTemImagemServidor = !!leituraData.imagemUrl;
          }

          // Se ainda tem imagemUrl do servidor, mantém hasImage = true
          // Se não tem, define como false
          onImageUploaded(faturaId, aindaTemImagemServidor);

          console.log(`[IMAGENS] Imagem local excluída. Ainda tem no servidor: ${aindaTemImagemServidor}`);

          // Toast de sucesso
          Toast.show({
            type: "success",
            text1: "Imagem excluída",
            text2: aindaTemImagemServidor 
              ? "Imagem local removida. Imagem do servidor disponível para visualização."
              : "A imagem foi removida com sucesso",
            position: "bottom",
            visibilityTime: 2000,
          });

        } else {
          // Erro na exclusão
          setShowSyncOverlay(false); // Fechar overlay
          
          Toast.show({
            type: "error",
            text1: "Erro ao excluir",
            text2: result.error || 'Não foi possível excluir a imagem',
            position: "bottom",
            visibilityTime: 3000,
          });
        }

      } catch (error: any) {
        console.error('[IMAGENS] Erro inesperado ao excluir imagem:', error);
        
        setShowSyncOverlay(false); // Fechar overlay
        
        Toast.show({
          type: "error",
          text1: "Erro inesperado",
          text2: "Ocorreu um erro ao processar a exclusão",
          position: "bottom",
          visibilityTime: 3000,
        });
      }
    }, 50); // Pequeno delay para garantir que o overlay apareça
  };

  return (
    <>
      <Modal
        visible={
          isVisible &&
          !showPreview &&
          !showConfirmOverwrite &&
          !showPermissionModal &&
          !showImagePreview &&
          !showSyncOverlay
        }
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Capturar Imagem</Text>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={capturarImagem}
            >
              <Ionicons name="camera" size={24} color="#2a9d8f" />
              <Text style={styles.optionText}>Usar câmera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={selecionarDaGaleria}
            >
              <Ionicons name="images" size={24} color="#2a9d8f" />
              <Text style={styles.optionText}>Escolher da galeria</Text>
            </TouchableOpacity>

            {hasExistingImage && (
              <TouchableOpacity
                style={styles.optionButton}
                onPress={visualizarImagemExistente}
              >
                <Ionicons name="eye" size={24} color="#2a9d8f" />
                <Text style={styles.optionText}>Ver imagem existente</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.optionButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmação para substituir imagem */}
      <Modal
        visible={showConfirmOverwrite}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmOverwrite(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.confirmDialog}>
            {/* Botão X no cabeçalho para fechar */}
            <TouchableOpacity
              style={styles.confirmCloseButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>

            <Text style={styles.confirmTitle}>Imagem já existente</Text>
            <Text style={styles.confirmText}>
              Já existe uma imagem para esta leitura. O que deseja fazer?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: "#2a9d8f" }]}
                onPress={visualizarImagemExistente}
              >
                {/* Ícone de olhos para visualizar */}
                <Ionicons name="eye-outline" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: "#f4a261" }]}
                onPress={handleConfirmOverwrite}
              >
                {/* Ícone de sync para substituir */}
                <Ionicons name="sync-outline" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: "#e63946" }]}
                onPress={handleExcluirImagem}
              >
                {/* Ícone de lixeira para excluir */}
                <Ionicons name="trash-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Botão Fechar na parte inferior */}
            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={onClose}
            >
              <Text style={styles.confirmCancelText}>Fechar</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Modal de preview da imagem */}
      <ImagePreviewModal
        isVisible={showPreview}
        imageUri={capturedImage}
        isUploading={uploading}
        onConfirm={uploadImagem}
        onCancel={handleClosePreview}
      />
      <ImagePreviewView
        isVisible={showImagePreview}
        imageUri={imagePreviewUri}
        onClose={() => {
          setShowImagePreview(false); // Fecha a visualização da imagem
          onClose(); // Fecha o modal principal (atualiza `isVisible`)
        }}
      />

      {/* Modal de permissão de câmera personalizado */}
      <CameraPermissionRequestModal
        isVisible={showPermissionModal}
        onRequestPermission={solicitarPermissaoCamera}
        onCancel={() => setShowPermissionModal(false)}
      />

      <GalleryPermissionRequestModal
        isVisible={showGalleryPermissionModal}
        onRequestPermission={solicitarPermissaoGaleria}
        onCancel={() => setShowGalleryPermissionModal(false)}
      />

      {/* Overlay de sincronização para exclusão - renderizado por último para ficar na frente */}
      {showSyncOverlay && (
        <SyncLoadingOverlay
          visible={showSyncOverlay}
          type={syncOverlayType}
          title={syncOverlayTitle}
          subtitle={syncOverlaySubtitle}
          iconName={syncOverlayType === 'error' ? 'alert-circle' : undefined}
        />
      )}

      {/* Toast na base da tela - fora dos modais */}
      {showInternalToast && (
        <View style={styles.screenToast}>
          <View style={[
            styles.internalToastContent,
            { backgroundColor: internalToastType === 'error' ? '#e63946' : '#28a745' }
          ]}>
            <Ionicons 
              name={internalToastType === 'error' ? 'alert-circle' : 'checkmark-circle'} 
              size={20} 
              color="#fff" 
              style={styles.internalToastIcon}
            />
            <Text style={styles.internalToastText}>{internalToastMessage}</Text>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  optionText: {
    fontSize: 16,
    marginLeft: 10,
    color: "#333",
  },
  cancelButton: {
    borderBottomWidth: 0,
    marginTop: 10,
  },
  cancelText: {
    color: "#e63946",
    fontSize: 16,
    fontWeight: "bold",
  },
  confirmDialog: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    position: "relative",
  },
  confirmCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  confirmText: {
    fontSize: 16,
    marginBottom: 20,
    color: "#555",
  },
  confirmButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  confirmCancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    alignSelf: "center",
    minWidth: 120,
  },
  confirmCancelText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  screenToast: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  internalToastContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  internalToastIcon: {
    marginRight: 8,
  },
  internalToastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
});

export default ImagemLeituraModal;
