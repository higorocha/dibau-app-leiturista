// src/services/SyncService.ts - Versão modificada com suporte a progresso

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

interface SyncProgressCallbacks {
  onProgress?: (processed: number, total: number) => void;
  onStart?: (total: number) => void;
  onComplete?: (success: boolean, syncedCount: number) => void;
  onCancel?: () => void;
}

// Variável para controlar cancelamento
let syncCancelled = false;

// Função para sincronizar leituras pendentes
export const syncPendingLeituras = async (callbacks?: SyncProgressCallbacks): Promise<{success: boolean, syncedCount: number}> => {
  try {
    // Resetar estado de cancelamento
    syncCancelled = false;
    
    // Verificar se há conexão
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Sem conexão, não é possível sincronizar');
      return { success: false, syncedCount: 0 };
    }
    
    // Buscar atualizações pendentes
    const pendingDataStr = await AsyncStorage.getItem('pendingLeituraUpdates');
    if (!pendingDataStr) {
      console.log('Nenhuma atualização pendente');
      return { success: true, syncedCount: 0 };
    }
    
    const pendingData = JSON.parse(pendingDataStr);
    const pendingIds = Object.keys(pendingData);
    
    if (pendingIds.length === 0) {
      return { success: true, syncedCount: 0 };
    }
    
    console.log(`Sincronizando ${pendingIds.length} leituras pendentes`);
    
    // Chamar callback de início, se existir
    if (callbacks?.onStart) {
      callbacks.onStart(pendingIds.length);
    }
    
    // Para cada atualização pendente, enviar para a API
    let syncedCount = 0;
    const newPendingData = { ...pendingData };
    const syncStatusData = await AsyncStorage.getItem('pendingLeiturasSyncs') || '{}';
    const syncStatus = JSON.parse(syncStatusData);
    
    for (let i = 0; i < pendingIds.length; i++) {
      // Verificar se a sincronização foi cancelada
      if (syncCancelled) {
        console.log('Sincronização cancelada pelo usuário');
        if (callbacks?.onCancel) {
          callbacks.onCancel();
        }
        return { success: false, syncedCount };
      }
      
      const id = pendingIds[i];
      const update = pendingData[id];
      
      try {
        // Pequeno atraso para permitir atualização da UI entre itens
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Enviar para a API
        await api.put(`/faturamensal/atualizar-leitura/${id}`, {
          leitura: update.leitura,
          data_leitura: update.data_leitura,
        });
        
        // Remover do objeto de pendentes
        delete newPendingData[id];
        delete syncStatus[id];
        syncedCount++;
        
        // Chamar callback de progresso, se existir
        if (callbacks?.onProgress) {
          callbacks.onProgress(syncedCount, pendingIds.length);
        }
      } catch (error) {
        console.error(`Erro ao sincronizar leitura ${id}:`, error);
        // Manter na lista de pendentes para tentar novamente depois
      }
    }
    
    // Salvar o objeto atualizado (sem os que foram sincronizados)
    await AsyncStorage.setItem('pendingLeituraUpdates', JSON.stringify(newPendingData));
    await AsyncStorage.setItem('pendingLeiturasSyncs', JSON.stringify(syncStatus));
    
    // Chamar callback de conclusão, se existir
    if (callbacks?.onComplete) {
      callbacks.onComplete(true, syncedCount);
    }
    
    if (syncedCount > 0 && !syncCancelled) {
      Toast.show({
        type: 'success',
        text1: 'Sincronização concluída',
        text2: `${syncedCount} leituras sincronizadas com sucesso`,
        visibilityTime: 3000,
      });
    }
    
    return { success: true, syncedCount };
  } catch (error) {
    console.error('Erro ao sincronizar leituras pendentes:', error);
    
    // Chamar callback de conclusão com erro, se existir
    if (callbacks?.onComplete) {
      callbacks.onComplete(false, 0);
    }
    
    return { success: false, syncedCount: 0 };
  }
};

// Função para cancelar sincronização em andamento
export const cancelSync = () => {
  syncCancelled = true;
};

/* Adicionar função para verificar e iniciar sincronização
export const checkAndSync = async (): Promise<void> => {
  try {
    // Verificar se há conexão
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return;
    }
    
    // Verificar timestamp de última sincronização
    const ultimaSincronizacao = await AsyncStorage.getItem('leituras_ultima_sincronizacao');
    if (ultimaSincronizacao) {
      const ultimaData = new Date(ultimaSincronizacao).getTime();
      const agora = new Date().getTime();
      const duasHorasEmMS = 2 * 60 * 60 * 1000;
      
      // Se não passou o tempo mínimo, não sincroniza
      if ((agora - ultimaData) <= duasHorasEmMS) {
        return;
      }
    }
    
    // Verificar se há atualizações pendentes
    const pendingDataStr = await AsyncStorage.getItem('pendingLeituraUpdates');
    if (!pendingDataStr) {
      return;
    }
    
    const pendingData = JSON.parse(pendingDataStr);
    const pendingCount = Object.keys(pendingData).length;
    
    if (pendingCount > 0) {
      // Mostrar toast informativo discreto
      Toast.show({
        type: 'info',
        text1: 'Sincronizando em segundo plano',
        text2: `Enviando ${pendingCount} leituras pendentes...`,
        visibilityTime: 2000,
      });
      
      // Iniciar sincronização
      const resultado = await syncPendingLeituras();
      
      // Registrar timestamp de sincronização bem-sucedida
      if (resultado.success) {
        await AsyncStorage.setItem('leituras_ultima_sincronizacao', new Date().toISOString());
      }
    }
  } catch (error) {
    console.error('Erro ao verificar sincronização:', error);
  }
};*/