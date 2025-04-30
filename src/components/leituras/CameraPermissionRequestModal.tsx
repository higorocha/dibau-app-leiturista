// src/components/leituras/CameraPermissionRequestModal.tsx
import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CameraPermissionRequestModalProps {
  isVisible: boolean;
  onRequestPermission: () => void;
  onCancel: () => void;
}

const CameraPermissionRequestModal: React.FC<CameraPermissionRequestModalProps> = ({
  isVisible,
  onRequestPermission,
  onCancel
}) => {
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="camera" size={60} color="#2a9d8f" />
          </View>
          
          <Text style={styles.title}>Acesso à Câmera</Text>
          
          <Text style={styles.description}>
            Para registrar fotos das leituras do hidrômetro, precisamos do seu 
            consentimento para acessar a câmera do dispositivo.
          </Text>
          
          <View style={styles.imageContainer}>
            <Image 
              source={require('../../../assets/images/camera-example.png')} 
              style={styles.image} 
              resizeMode="contain"
            />
          </View>
          
          <Text style={styles.securityNote}>
            As imagens são criptografadas e usadas apenas para confirmar as leituras registradas.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Agora não</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.allowButton]} 
              onPress={onRequestPermission}
            >
              <Text style={styles.allowButtonText}>Permitir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  content: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(42, 157, 143, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  imageContainer: {
    width: '100%',
    height: 150,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  securityNote: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  allowButton: {
    backgroundColor: '#2a9d8f',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  allowButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default CameraPermissionRequestModal;