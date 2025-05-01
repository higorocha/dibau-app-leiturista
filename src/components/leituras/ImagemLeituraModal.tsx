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
import ImagePreviewView from "./ImagePreviewView";
import ImagemLeituraService from "@/src/services/ImagemLeituraService";
import * as FileSystem from 'expo-file-system';

interface ImagemLeituraModalProps {
  isVisible: boolean;
  onClose: () => void;
  faturaId: number | null;
  leituraId: number | null;
  hasExistingImage: boolean;
  onImageUploaded: (faturaId: number) => void;
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
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(
    null
  );
  const [showCamera, setShowCamera] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);

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
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Precisamos de permissão para acessar suas fotos."
        );
        return;
      }

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

  const uploadImagem = async () => {
    if (!capturedImage || !leituraId || !faturaId) {
      return;
    }

    setUploading(true);

    try {
      // 1. Salvar a imagem localmente primeiro
      const caminhoLocal = await ImagemLeituraService.salvarImagemLocal(
        leituraId,
        capturedImage
      );

      // 2. Verificar conexão para upload
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert(
          "Sem conexão",
          "Você está offline. A imagem foi salva localmente e será enviada quando houver conexão."
        );
        // Marcar como pendente de upload (implementar mecanismo)
        onImageUploaded(faturaId);
        setCapturedImage(null);
        setShowPreview(false);
        onClose();
        return;
      }

      // 3. Criar FormData para o upload online
      const formData = new FormData();

      // Extrair extensão e nome do arquivo
      const extensao = capturedImage.split(".").pop()?.toLowerCase() || "jpg";
      const nomeArquivo = `leitura_${leituraId}_${Date.now()}.${extensao}`;

      // Adicionar o arquivo
      formData.append("imagem", {
        uri: capturedImage,
        name: nomeArquivo,
        type: `image/${extensao}`,
      } as any);

      // 4. Enviar para o servidor
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
        onImageUploaded(faturaId);

        Toast.show({
          type: "success",
          text1: "Imagem salva com sucesso!",
          text2: "Imagem salva localmente e enviada ao servidor",
          position: "bottom",
          visibilityTime: 2000,
        });
      }

      setCapturedImage(null);
      setShowPreview(false);
      onClose();
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      // Mesmo com erro no upload, a imagem já está salva localmente
      Alert.alert(
        "Atenção",
        "Não foi possível enviar a imagem para o servidor, mas ela foi salva no dispositivo. Tente sincronizar novamente quando houver conexão."
      );
      onImageUploaded(faturaId);
      setCapturedImage(null);
      setShowPreview(false);
      onClose();
    } finally {
      setUploading(false);
    }
  };

  // Função visualizarImagemExistente modificada
  const visualizarImagemExistente = async () => {
    if (!leituraId || !faturaId) {
      console.log("[IMAGENS] Erro: leituraId ou faturaId não definidos");
      return;
    }
  
    try {
      console.log(`[IMAGENS] Iniciando visualização da imagem para leitura ID: ${leituraId}`);
      setUploading(true); // Mostrar indicador de carregamento
  
      // 1. Verificar se a imagem existe localmente
      let caminhoLocal = await ImagemLeituraService.obterCaminhoImagemLocal(leituraId);
      console.log(`[IMAGENS] Caminho local: ${caminhoLocal || 'não encontrado'}`);
  
      // 2. Se não existir localmente, tentar baixar do servidor
      if (!caminhoLocal) {
        const netInfo = await NetInfo.fetch();
        
        if (netInfo.isConnected) {
          console.log('[IMAGENS] Não encontrado localmente, tentando baixar do servidor...');
          Toast.show({
            type: 'info',
            text1: 'Baixando imagem...',
            text2: 'Aguarde enquanto baixamos a imagem do servidor',
            position: 'bottom',
            visibilityTime: 2000,
          });
          
          // Tentar baixar a imagem
          caminhoLocal = await ImagemLeituraService.baixarImagem(leituraId);
          console.log(`[IMAGENS] Download concluído, caminho: ${caminhoLocal || 'falha no download'}`);
        } else {
          console.log('[IMAGENS] Sem conexão e imagem não disponível localmente');
          Alert.alert(
            "Sem conexão",
            "Você está offline e a imagem não está disponível no dispositivo."
          );
          setUploading(false);
          return;
        }
      }
  
      // 3. Se conseguimos obter a imagem, exibir
      if (caminhoLocal) {
        console.log(`[IMAGENS] Preparando para exibir imagem de: ${caminhoLocal}`);
        
        // Verificar se o arquivo realmente existe
        const fileInfo = await FileSystem.getInfoAsync(caminhoLocal);
        if (!fileInfo.exists) {
          console.log(`[IMAGENS] ERRO: Arquivo não existe apesar do caminho ser válido`);
          Alert.alert("Erro", "Arquivo de imagem não encontrado no dispositivo.");
          setUploading(false);
          return;
        }
        
        console.log(`[IMAGENS] Arquivo existe, tamanho: ${fileInfo.size} bytes`);
        
        // Importante: Fechar qualquer modal que esteja aberto antes de mostrar o preview
        setShowConfirmOverwrite(false);
        
        // Pequeno timeout para garantir que o primeiro modal foi fechado
        setTimeout(() => {
          setImagePreviewUri(caminhoLocal);
          setShowImagePreview(true);
          console.log('[IMAGENS] Estados atualizados: showImagePreview=true, uri definido');
          setUploading(false);
        }, 300);
      } else {
        console.log('[IMAGENS] Não foi possível obter a imagem de nenhuma fonte');
        Alert.alert(
          "Erro",
          "Não foi possível carregar a imagem. Tente novamente mais tarde."
        );
        setUploading(false);
      }
    } catch (error) {
      console.error('[IMAGENS] Erro ao visualizar imagem:', error);
      // Log mais detalhado para diagnóstico
      if (error instanceof Error) {
        console.error('[IMAGENS] Erro detalhado:', error.name, error.message, error.stack);
      }
      
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar imagem',
        text2: 'Ocorreu um erro inesperado. Tente novamente.',
        position: 'bottom',
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

  return (
    <>
      <Modal
        visible={
          isVisible &&
          !showPreview &&
          !showConfirmOverwrite &&
          !showPermissionModal
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
            <Text style={styles.confirmTitle}>Imagem já existente</Text>
            <Text style={styles.confirmText}>
              Já existe uma imagem para esta leitura. O que deseja fazer?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: "#2a9d8f" }]}
                onPress={visualizarImagemExistente}
              >
                {/* Substituir texto por ícone de olhos */}
                <Ionicons name="eye-outline" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: "#f4a261" }]}
                onPress={handleConfirmOverwrite}
              >
                {/* Substituir texto por ícone de setas em direções contrárias */}
                <Ionicons name="sync-outline" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: "#e63946" }]}
                onPress={onClose}
              >
                {/* Substituir texto por ícone X */}
                <Ionicons name="close-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
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
        onClose={() => setShowImagePreview(false)}
      />

      {/* Modal de permissão de câmera personalizado */}
      <CameraPermissionRequestModal
        isVisible={showPermissionModal}
        onRequestPermission={solicitarPermissaoCamera}
        onCancel={() => setShowPermissionModal(false)}
      />
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
});

export default ImagemLeituraModal;
