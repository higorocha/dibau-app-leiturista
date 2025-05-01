// src/components/leituras/ImagePreviewView.tsx
import React from 'react';
import { 
  Modal, 
  View, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  Text,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  if (!imageUri) return null;
  
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
          />
        </View>
        
        {/* Rodapé */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Imagem salva no dispositivo</Text>
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