// src/components/UpdateHandler.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ActivityIndicator, 
  Modal, 
  TouchableOpacity, 
  StyleSheet, 
  Platform,
  Dimensions,
  SafeAreaView
} from 'react-native';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const UpdateHandler: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!__DEV__) {
      // Verificar atualizações quando o app abre
      checkForUpdates();
      
      // Verificar atualizações periodicamente (a cada 30 minutos)
      const interval = setInterval(() => {
        checkForUpdates();
      }, 30 * 60 * 1000);
      
      return () => clearInterval(interval);
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
      animationType="fade"
      statusBarTranslucent={true}
      hardwareAccelerated={true}
      onRequestClose={() => setShowModal(false)}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <View style={styles.iconWrapper}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="cloud-download-outline" size={48} color="#2a9d8f" />
                  </View>
                </View>
                
                <View style={styles.contentWrapper}>
                  <Text style={styles.modalTitle}>Nova atualização disponível</Text>
                  <Text style={styles.modalDescription}>
                    Uma nova versão do aplicativo está disponível. Recomendamos que você atualize agora para ter acesso às últimas funcionalidades e correções.
                  </Text>

                  {isDownloading && (
                    <View style={styles.progressContainer}>
                      <Text style={styles.progressText}>Baixando atualização...</Text>
                      <ActivityIndicator size="small" color="#2a9d8f" style={styles.progressIndicator} />
                    </View>
                  )}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                      style={[styles.button, styles.cancelButton]} 
                      onPress={() => setShowModal(false)}
                      disabled={isDownloading}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelButtonText}>Atualizar depois</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.button, styles.updateButton]} 
                      onPress={downloadAndInstallUpdate}
                      disabled={isDownloading}
                      activeOpacity={0.8}
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
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
  },
  modalBackground: {
    width: width > 600 ? '60%' : '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 20,
    ...Platform.select({
      android: {
        elevation: 30,
      },
    }),
  },
  modalContainer: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  modalContent: {
    padding: 24,
  },
  iconWrapper: {
    marginBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: 'rgba(42, 157, 143, 0.1)',
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#4a4a4a',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  progressText: {
    color: '#2a9d8f',
    marginRight: 8,
    fontSize: 16,
  },
  progressIndicator: {
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  updateButton: {
    backgroundColor: '#2a9d8f',
    shadowColor: '#2a9d8f',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cancelButtonText: {
    color: '#4a4a4a',
    fontWeight: '600',
    fontSize: 16,
  },
  updateButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default UpdateHandler;