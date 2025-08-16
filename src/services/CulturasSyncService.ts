// src/services/CulturasSyncService.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import { Lote, Cultura, LoteCultura } from '../types/models';
import LoggerService from './LoggerService';

// Interface para a estrutura de cultura no formato de envio
interface CulturaFormatada {
  culturaId: number;
  areaPlantada: number;
  areaProduzindo: number;
  isNew?: boolean;
}

// Interface para dados pendentes
interface PendingCulturaData {
  loteId: number;
  culturas: CulturaFormatada[];
  deletedCultureIds: number[];
  timestamp: string;
}

// Interface para callbacks de progresso
interface SyncProgressCallbacks {
  onStart?: (total: number) => void;
  onProgress?: (processed: number, total: number) => void;
  onComplete?: (success: boolean, syncedCount: number) => void;
  onCancel?: () => void;
}

// Variável para controlar cancelamento da sincronização
let syncCancelled = false;

// Função para salvar culturas offline com formato melhorado
export const saveCulturasOffline = async (
  loteId: number, 
  culturas: CulturaFormatada[], 
  deletedCultureIds: number[]
): Promise<boolean> => {
  try {
    // Buscar dados pendentes existentes
    const pendingDataStr = await AsyncStorage.getItem('pendingCulturasUpdates') || '{}';
    const pendingData = JSON.parse(pendingDataStr) as Record<string, PendingCulturaData>;
    
    // Adicionar/atualizar este lote com formato melhorado
    pendingData[loteId] = {
      loteId: loteId,
      culturas: culturas,
      deletedCultureIds: deletedCultureIds,
      timestamp: new Date().toISOString()
    };
    
    // Salvar no AsyncStorage
    await AsyncStorage.setItem('pendingCulturasUpdates', JSON.stringify(pendingData));
    
    // Atualizar lista de lotes pendentes
    const pendingLotsStr = await AsyncStorage.getItem('pendingLotesStatus') || '{}';
    const pendingLots = JSON.parse(pendingLotsStr);
    pendingLots[loteId] = true;
    await AsyncStorage.setItem('pendingLotesStatus', JSON.stringify(pendingLots));
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar culturas offline:', error);
    return false;
  }
};

// Função para sincronizar culturas pendentes (modificada para suportar callbacks)
export const syncPendingCulturas = async (callbacks?: SyncProgressCallbacks): Promise<{success: boolean, syncedCount: number}> => {
  try {
    // Resetar estado de cancelamento
    syncCancelled = false;
    
    // Verificar se há conexão
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Sem conexão, não é possível sincronizar culturas');
      
      // Log de erro de conectividade
      await LoggerService.getInstance().logSync('culturas_sync_no_network', false, { 
        network_state: netInfo.type,
        operation: 'culturas_sync'
      });
      
      return { success: false, syncedCount: 0 };
    }
    
    // Buscar atualizações pendentes
    const pendingDataStr = await AsyncStorage.getItem('pendingCulturasUpdates');
    if (!pendingDataStr) {
      console.log('Nenhuma atualização de culturas pendente');
      return { success: true, syncedCount: 0 };
    }
    
    const pendingData = JSON.parse(pendingDataStr) as Record<string, PendingCulturaData>;
    const pendingLoteIds = Object.keys(pendingData).map(id => Number(id));
    
    if (pendingLoteIds.length === 0) {
      return { success: true, syncedCount: 0 };
    }
    
    console.log(`Sincronizando culturas de ${pendingLoteIds.length} lotes pendentes`);
    
    // Notificar início, se houver callback
    if (callbacks?.onStart) {
      callbacks.onStart(pendingLoteIds.length);
    }
    
    // Para cada atualização pendente, enviar para a API
    let syncedCount = 0;
    const newPendingData = { ...pendingData };
    
    for (let i = 0; i < pendingLoteIds.length; i++) {
      // Verificar se cancelou sincronização
      if (syncCancelled) {
        console.log('Sincronização cancelada pelo usuário');
        if (callbacks?.onCancel) callbacks.onCancel();
        return { success: false, syncedCount };
      }
      
      const loteId = pendingLoteIds[i];
      const update = pendingData[loteId];
      
      try {
        // Adicionar pequeno delay para UI conseguir atualizar
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Buscar dados completos do lote para incluir na atualização
        const loteResponse = await api.get(`/lotesagricolas/${loteId}`);
        const lote = loteResponse.data as Lote;
        
        // Enviar para a API com formato atualizado, incluindo identificação de consórcio
        await api.put(`/lotesagricolas/${loteId}`, {
          id: lote.id,
          nomeLote: lote.nomeLote,
          responsavelId: lote.responsavelId,
          areaTotal: lote.areaTotal,
          areaLote: lote.areaLote || 0,
          sobraarea: lote.sobraarea || 0,
          consorcioCulturas: update.culturas.length > 1,
          categoria: lote.categoria || "Colono",
          situacao: lote.situacao || "Operacional",
          culturas: update.culturas
        });
        
        // Remover do objeto de pendentes
        delete newPendingData[loteId];
        syncedCount++;
        
        // Notificar progresso, se houver callback
        if (callbacks?.onProgress) {
          callbacks.onProgress(syncedCount, pendingLoteIds.length);
        }
      } catch (error) {
        console.error(`Erro ao sincronizar culturas do lote ${loteId}:`, error);
        
        // Log de erro individual
        await LoggerService.getInstance().logSync('culturas_sync_item_error', false, { 
          lote_id: loteId,
          culturas_count: update.culturas.length,
          deleted_cultures: update.deletedCultureIds.length,
          error_message: (error as any)?.message,
          error_status: (error as any)?.response?.status,
          operation: 'culturas_sync'
        });
        
        // Manter na lista de pendentes para tentar novamente depois
      }
    }
    
    // Salvar o objeto atualizado (sem os que foram sincronizados)
    await AsyncStorage.setItem('pendingCulturasUpdates', JSON.stringify(newPendingData));
    
    // Atualizar a lista de lotes pendentes no AsyncStorage
    const updatedPendingLoteIds = Object.keys(newPendingData);
    const pendingLotesObj = updatedPendingLoteIds.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {} as {[key: string]: boolean});
    
    await AsyncStorage.setItem('pendingLotesStatus', JSON.stringify(pendingLotesObj));
    
    // Notificar conclusão, se houver callback
    if (callbacks?.onComplete) {
      callbacks.onComplete(true, syncedCount);
    } else if (syncedCount > 0) {
      Toast.show({
        type: 'success',
        text1: 'Sincronização concluída',
        text2: `Culturas de ${syncedCount} lotes sincronizadas com sucesso`,
        visibilityTime: 3000,
      });
    }
    
    return { success: true, syncedCount };
  } catch (error) {
    console.error('Erro ao sincronizar culturas pendentes:', error);
    
    // Log de erro geral na sincronização
    await LoggerService.getInstance().logSync('culturas_sync_error', false, { 
      error_message: (error as any)?.message,
      synced_count: 0,
      operation: 'culturas_sync'
    });
    
    // Notificar erro, se houver callback
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

// Aplicar alterações pendentes aos lotes locais (para LotesScreen usar)
export const applyPendingChangesToLotes = async (lotes: Lote[]): Promise<Lote[]> => {
  try {
    const pendingDataStr = await AsyncStorage.getItem('pendingCulturasUpdates') || '{}';
    const pendingData = JSON.parse(pendingDataStr) as Record<string, PendingCulturaData>;
    const pendingLoteIds = Object.keys(pendingData).map(id => Number(id));
    
    if (pendingLoteIds.length === 0) return lotes;
    
    // Aplicar modificações pendentes aos lotes
    const updatedLotes = lotes.map(lote => {
      if (pendingLoteIds.includes(lote.id)) {
        const pendingUpdate = pendingData[lote.id];
        
        // Se houver Culturas no lote
        if (lote.Culturas) {
          // Remover culturas marcadas para exclusão
          if (pendingUpdate.deletedCultureIds && pendingUpdate.deletedCultureIds.length > 0) {
            lote.Culturas = lote.Culturas.filter((cultura: Cultura) => 
              !pendingUpdate.deletedCultureIds.includes(cultura.id)
            );
          }
          
          // Atualizar áreas para culturas existentes
          lote.Culturas = lote.Culturas.map((cultura: Cultura) => {
            const updatedCultura = pendingUpdate.culturas.find((c: CulturaFormatada) => c.culturaId === cultura.id);
            
            if (updatedCultura) {
              return {
                ...cultura,
                LotesCulturas: {
                  ...cultura.LotesCulturas,
                  areaPlantada: updatedCultura.areaPlantada,
                  areaProduzindo: updatedCultura.areaProduzindo
                }
              };
            }
            return cultura;
          });
        }
        
        // Marcar como pendente de sincronização
        return {
          ...lote,
          isPendingSync: true
        };
      }
      return lote;
    });
    
    return updatedLotes;
  } catch (error) {
    console.error('Erro ao aplicar alterações pendentes:', error);
    return lotes; // Retorna os lotes originais em caso de erro
  }
};

// IMPORTANTE: Função para verificar quais lotes têm culturas pendentes (para o badge)
export const verificarLotesPendentes = async (): Promise<{[id: number]: boolean}> => {
  try {
    // Buscar dados pendentes do AsyncStorage
    const pendingDataStr = await AsyncStorage.getItem('pendingCulturasUpdates') || '{}';
    const pendingData = JSON.parse(pendingDataStr);
    
    // Converter as keys para números e criar mapa de lotes pendentes
    const pendingLotes: {[id: number]: boolean} = {};
    Object.keys(pendingData).forEach(id => {
      pendingLotes[Number(id)] = true;
    });
    
    return pendingLotes;
  } catch (error) {
    console.error('Erro ao verificar lotes pendentes:', error);
    return {};
  }
};