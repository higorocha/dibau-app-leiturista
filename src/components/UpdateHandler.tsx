// src/components/UpdateHandler.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';

const UpdateHandler: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!__DEV__) {
      checkForUpdates();
    }
  }, []);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        setUpdateAvailable(true);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const downloadAndInstallUpdate = async () => {
    try {
      setIsDownloading(true);
      
      const result = await Updates.fetchUpdateAsync();
      
      if (result.isNew) {
        setShowModal(false);
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.error('Erro ao baixar atualização:', error);
      alert('Erro ao baixar atualização. Tente novamente mais tarde.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!showModal && !isChecking) return null;

  return (
    <Modal
      visible={showModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-download-outline" size={48} color="#2a9d8f" />
          </View>
          
          <Text style={styles.modalTitle}>Nova atualização disponível</Text>
          <Text style={styles.modalDescription}>
            Uma nova versão do aplicativo está disponível. Recomendamos que você atualize agora para ter acesso às últimas funcionalidades e correções.
          </Text>

          {isDownloading && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>Baixando...</Text>
              <ActivityIndicator size="small" color="#2a9d8f" style={styles.progressIndicator} />
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={() => setShowModal(false)}
              disabled={isDownloading}
            >
              <Text style={styles.cancelButtonText}>Atualizar depois</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.updateButton]} 
              onPress={downloadAndInstallUpdate}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.updateButtonText}>Atualizar agora</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(42, 157, 143, 0.1)',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressText: {
    color: '#2a9d8f',
    marginRight: 8,
  },
  progressIndicator: {
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  updateButton: {
    backgroundColor: '#2a9d8f',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default UpdateHandler;