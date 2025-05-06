// src/services/SyncService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../api/axiosConfig';
import Toast from 'react-native-toast-message';

// Função para sincronizar leituras pendentes
export const syncPendingLeituras = async (): Promise<{success: boolean, syncedCount: number}> => {
  try {
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
    
    // Para cada atualização pendente, enviar para a API
    let syncedCount = 0;
    const newPendingData = { ...pendingData };
    const syncStatusData = await AsyncStorage.getItem('pendingLeiturasSyncs') || '{}';
    const syncStatus = JSON.parse(syncStatusData);
    
    for (const id of pendingIds) {
      const update = pendingData[id];
      try {
        // Enviar para a API
        await api.put(`/faturamensal/atualizar-leitura/${id}`, {
          leitura: update.leitura,
          data_leitura: update.data_leitura,
        });
        
        // Remover do objeto de pendentes
        delete newPendingData[id];
        delete syncStatus[id];
        syncedCount++;
      } catch (error) {
        console.error(`Erro ao sincronizar leitura ${id}:`, error);
        // Manter na lista de pendentes
      }
    }
    
    // Salvar o objeto atualizado (sem os que foram sincronizados)
    await AsyncStorage.setItem('pendingLeituraUpdates', JSON.stringify(newPendingData));
    await AsyncStorage.setItem('pendingLeiturasSyncs', JSON.stringify(syncStatus));
    
    if (syncedCount > 0) {
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
    return { success: false, syncedCount: 0 };
  }
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