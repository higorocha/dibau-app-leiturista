// src/components/leituras/ImagePreviewView.tsx - Componente melhorado
import React, { useEffect } from 'react';
import { 
  Modal, 
  View, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  Text,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

interface ImagePreviewViewProps {
  isVisible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

const ImagePreviewView: React.FC<ImagePreviewViewProps> = ({
  isVisible,
  imageUri,
  onClose
}) => {
  // Verificar o arquivo de imagem quando o componente for montado
  useEffect(() => {
    if (isVisible && imageUri) {
      console.log(`[IMAGENS] ImagePreviewView aberto com URI: ${imageUri}`);
      
      // ✅ LÓGICA CORRIGIDA: Só verificar FileSystem se for arquivo local
      const isRemoteUrl = imageUri.startsWith('http://') || imageUri.startsWith('https://');
      
      if (isRemoteUrl) {
        console.log(`[IMAGENS] URL remota detectada - pulando verificação FileSystem`);
        return; // URL remota - não verificar FileSystem
      }
      
      // Verificar se o arquivo LOCAL existe
      FileSystem.getInfoAsync(imageUri)
        .then(fileInfo => {
          console.log(`[IMAGENS] Verificação do arquivo local: existe=${fileInfo.exists}, ${fileInfo.exists ? `tamanho=${fileInfo.size} bytes` : 'não existe'}`);
          
          if (!fileInfo.exists) {
            Alert.alert("Erro", "O arquivo de imagem local não foi encontrado.", [
              { text: "OK", onPress: onClose }
            ]);
          }
        })
        .catch(error => {
          console.error("[IMAGENS] Erro ao verificar arquivo local:", error);
        });
    }
  }, [isVisible, imageUri]);

  if (!isVisible || !imageUri) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Visualização da Leitura</Text>
        </View>
        
        {/* Imagem */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            onLoad={() => console.log('[IMAGENS] Imagem carregada com sucesso')}
            onError={(e) => {
              console.error('[IMAGENS] Erro ao carregar imagem:', e.nativeEvent.error);
              Alert.alert("Erro", "Não foi possível carregar a imagem.", [
                { text: "OK", onPress: onClose }
              ]);
            }}
          />
        </View>
        
        {/* Rodapé */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {imageUri?.startsWith('http') ? 'Imagem do servidor' : 'Imagem salva no dispositivo'}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height * 0.7,
  },
  footer: {
    padding: 16,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  footerText: {
    color: '#aaa',
    fontSize: 14,
  }
});

export default ImagePreviewView;