// src/components/UpdateHandler.tsx
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  ActivityIndicator, 
  TouchableOpacity, 
  StyleSheet, 
  Platform,
  Dimensions,
  SafeAreaView,
  BackHandler,
  AppState,
  AppStateStatus,
  Alert,
  StatusBar,
  TouchableWithoutFeedback
} from 'react-native';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';

// Detecção de tablet adaptada ao padrão do app
const dimensions = Dimensions.get('window');
const smallerDimension = Math.min(dimensions.width, dimensions.height);
const largerDimension = Math.max(dimensions.width, dimensions.height);
const isTablet = smallerDimension >= 550 || largerDimension >= 900;

// Verifica se estamos rodando no Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Status do UpdateHandler
type UpdateStatus = 
  | 'checking'     // Verificando atualizações
  | 'dev-mode'     // Em ambiente de desenvolvimento
  | 'up-to-date'   // App atualizado
  | 'update-available' // Atualização disponível
  | 'downloading'  // Baixando atualização
  | 'error';       // Erro ao verificar/baixar

// Tipo específico para os ícones que usamos neste componente
type UpdateIconName = 
  | 'cloud-download-outline'
  | 'code-slash-outline'
  | 'checkmark-circle-outline'
  | 'cloud-download'
  | 'alert-circle-outline';

// Crie um serviço de atualização que pode ser acessado de qualquer lugar do app
export const UpdateService = {
  // Referência para a função de verificação manual
  checkManually: null as ((force?: boolean) => Promise<boolean>) | null,
  // Referência para mostrar modal manualmente
  showModal: null as ((show: boolean) => void) | null,
};

const UpdateHandler: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const appState = useRef(AppState.currentState);
  
  // Listener do botão voltar
  useEffect(() => {
    const backAction = () => {
      if (visible) {
        console.log("Botão voltar pressionado com modal visível");
        setVisible(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [visible]);

  // Verificar se estamos em ambiente de desenvolvimento
  useEffect(() => {
    if (isExpoGo || __DEV__) {
      setStatus('dev-mode');
    }
  }, []);
  
  // Registrar função para mostrar modal
  useEffect(() => {
    UpdateService.showModal = setVisible;
    
    return () => {
      UpdateService.showModal = null;
    };
  }, []);
  
  // Função principal de verificação de atualizações
  const checkForUpdates = async (force = false): Promise<boolean> => {
    // Evitar múltiplas verificações simultâneas
    if (isChecking && !force) return false;
    
    try {
      setIsChecking(true);
      setStatus('checking');
      console.log('Verificando atualizações...');
      
      // Se estamos no Expo Go, mostrar mensagem de aviso
      if (isExpoGo || __DEV__) {
        console.log('Verificação de atualizações não suportada no Expo Go');
        setStatus('dev-mode');
        
        if (force) {
          console.log("Mostrando modal de modo de desenvolvimento");
          setVisible(true);
        }
        
        return false;
      }
      
      // Em builds de produção, verificar atualizações normalmente
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        console.log('Atualização disponível!');
        setUpdateAvailable(true);
        setStatus('update-available');
        
        if (force) {
          console.log("Mostrando modal de atualização disponível");
          setVisible(true);
        }
        
        return true;
      } else {
        console.log('Nenhuma atualização disponível');
        setStatus('up-to-date');
        
        if (force) {
          console.log("Mostrando modal de app atualizado");
          setVisible(true);
        }
        
        return false;
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
      setStatus('error');
      
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Erro desconhecido');
      }
      
      if (force) {
        console.log("Mostrando modal de erro");
        setVisible(true);
      }
      
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Função para baixar e instalar a atualização
  const downloadAndInstallUpdate = async () => {
    if (isDownloading) return; // Evitar múltiplos downloads
    
    try {
      setIsDownloading(true);
      setStatus('downloading');
      console.log('Baixando atualização...');
      
      // Se estamos no Expo Go, isso não deveria acontecer, mas por segurança
      if (isExpoGo || __DEV__) {
        return;
      }
      
      const result = await Updates.fetchUpdateAsync();
      
      if (result.isNew) {
        console.log('Atualização baixada, reiniciando app...');
        
        // Pequeno atraso para garantir que o modal seja fechado
        setTimeout(async () => {
          setVisible(false);
          await Updates.reloadAsync();
        }, 500);
      } else {
        console.log('Nenhuma atualização nova disponível');
        setStatus('up-to-date');
      }
    } catch (error) {
      console.error('Erro ao baixar atualização:', error);
      setStatus('error');
      
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Erro desconhecido ao baixar atualização');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // Registrar a função de verificação no serviço
  useEffect(() => {
    UpdateService.checkManually = checkForUpdates;
    
    return () => {
      UpdateService.checkManually = null;
    };
  }, [isChecking, isDownloading]);
  
  // Verificar atualizações quando o app inicia
  useEffect(() => {
    // Não verificar no Expo Go ou em ambiente de desenvolvimento
    if (!isExpoGo && !__DEV__) {
      // Verificar na inicialização com um pequeno atraso
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 3000);
      
      // Verificar quando o app volta para o primeiro plano
      const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App voltou para o primeiro plano
          checkForUpdates();
        }
        appState.current = nextAppState;
      });
      
      // Verificar a cada 30 minutos
      const interval = setInterval(() => {
        checkForUpdates();
      }, 30 * 60 * 1000);
      
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        subscription.remove();
      };
    }
  }, []);

  // Obter ícone e cor baseado no status
  const getIconAndColor = (): { name: UpdateIconName; color: string } => {
    switch (status) {
      case 'checking':
        return { name: 'cloud-download-outline', color: '#008bac' };
      case 'dev-mode':
        return { name: 'code-slash-outline', color: '#6200ee' };
      case 'up-to-date':
        return { name: 'checkmark-circle-outline', color: '#2a9d8f' };
      case 'update-available':
        return { name: 'cloud-download', color: '#008bac' };
      case 'downloading':
        return { name: 'cloud-download', color: '#008bac' };
      case 'error':
        return { name: 'alert-circle-outline', color: '#e63946' };
      default:
        return { name: 'cloud-download-outline', color: '#008bac' };
    }
  };

  // Obter título baseado no status
  const getTitle = () => {
    switch (status) {
      case 'checking':
        return 'Verificando Atualizações';
      case 'dev-mode':
        return 'Ambiente de Desenvolvimento';
      case 'up-to-date':
        return 'Aplicativo Atualizado';
      case 'update-available':
        return 'Nova Atualização Disponível';
      case 'downloading':
        return 'Baixando Atualização';
      case 'error':
        return 'Erro na Atualização';
      default:
        return 'Atualização do Aplicativo';
    }
  };

  // Obter mensagem baseada no status
  const getMessage = () => {
    switch (status) {
      case 'checking':
        return 'Estamos verificando se há novas atualizações disponíveis para o seu aplicativo. Isso levará apenas alguns instantes...';
      case 'dev-mode':
        return 'A verificação de atualizações não está disponível no ambiente de desenvolvimento. Esta funcionalidade só funciona em builds de produção.';
      case 'up-to-date':
        return 'Seu aplicativo já está na versão mais recente. Não há novas atualizações disponíveis no momento.';
      case 'update-available':
        return 'Uma nova versão do aplicativo está disponível. Recomendamos que você atualize agora para ter acesso às últimas funcionalidades e correções.';
      case 'downloading':
        return 'Baixando e instalando a nova versão do aplicativo. O aplicativo será reiniciado automaticamente após a conclusão.';
      case 'error':
        return `Ocorreu um erro ao verificar ou baixar atualizações. ${errorMessage}`;
      default:
        return 'Verifique regularmente se há atualizações para manter seu aplicativo funcionando corretamente.';
    }
  };

  // Se não estiver visível, não renderize nada
  if (!visible) return null;
  
  // Obter ícone e cor para o status atual
  const { name: iconName, color: iconColor } = getIconAndColor();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.7)" barStyle="light-content" />
      
      {/* Overlay (background escuro) com efeito de toque para fechar */}
      <TouchableWithoutFeedback onPress={() => setVisible(false)}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      
      {/* Conteúdo do modal - não é afetado pelo toque no overlay */}
      <View style={[styles.modalView, isTablet && styles.tabletModalView]}>
        {/* Cabeçalho com ícone */}
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          {status === 'checking' || status === 'downloading' ? (
            <ActivityIndicator size={isTablet ? "large" : "small"} color={iconColor} />
          ) : (
            <Ionicons name={iconName} size={isTablet ? 60 : 48} color={iconColor} />
          )}
        </View>
        
        {/* Título */}
        <Text style={[styles.modalTitle, isTablet && styles.tabletTitle, { color: iconColor }]}>
          {getTitle()}
        </Text>
        
        {/* Mensagem */}
        <Text style={[styles.modalDescription, isTablet && styles.tabletDescription]}>
          {getMessage()}
        </Text>
        
        {/* Botões de ação */}
        {status === 'update-available' ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton, isTablet && styles.tabletButton]} 
              onPress={() => setVisible(false)}
              disabled={isDownloading}
            >
              <Text style={[styles.cancelButtonText, isTablet && styles.tabletButtonText]}>
                Mais tarde
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.updateButton, isTablet && styles.tabletButton, { backgroundColor: iconColor }]} 
              onPress={downloadAndInstallUpdate}
              disabled={isDownloading}
            >
              <Text style={[styles.updateButtonText, isTablet && styles.tabletButtonText]}>
                Atualizar agora
              </Text>
            </TouchableOpacity>
          </View>
        ) : status === 'downloading' ? (
          <View style={styles.progressText}>
            <Text style={styles.progressInfo}>Por favor, aguarde enquanto instalamos a atualização...</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.singleButton, isTablet && styles.tabletButton, { backgroundColor: iconColor }]} 
            onPress={() => setVisible(false)}
          >
            <Text style={[styles.updateButtonText, isTablet && styles.tabletButtonText]}>
              {status === 'dev-mode' ? 'Entendi' : 'Fechar'}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Versão do app (opcional) */}
        <Text style={styles.versionText}>
          Versão atual: {Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalView: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  tabletModalView: {
    width: '70%',
    maxWidth: 600,
    padding: 32,
  },
  iconContainer: {
    width: isTablet ? 120 : 90,
    height: isTablet ? 120 : 90,
    borderRadius: isTablet ? 60 : 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isTablet ? 30 : 20,
    marginTop: isTablet ? 10 : 0,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  tabletTitle: {
    fontSize: 28,
    marginBottom: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#4a4a4a',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 24,
  },
  tabletDescription: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 40,
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
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  tabletButton: {
    paddingVertical: 18,
    minHeight: 60,
  },
  singleButton: {
    width: '100%',
    marginBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  updateButton: {
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
  tabletButtonText: {
    fontSize: 18,
  },
  progressText: {
    marginBottom: 30,
    alignItems: 'center',
  },
  progressInfo: {
    color: '#666',
    fontSize: isTablet ? 16 : 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  versionText: {
    color: '#999',
    fontSize: isTablet ? 14 : 12,
    marginTop: 10,
  },
});

export default UpdateHandler;