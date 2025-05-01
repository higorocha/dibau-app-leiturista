// src/services/CulturasSyncService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import { Lote, Cultura, LoteCultura } from '../types/models';

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
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar culturas offline:', error);
    return false;
  }
};

// Função para sincronizar culturas pendentes
export const syncPendingCulturas = async (): Promise<{success: boolean, syncedCount: number}> => {
  try {
    // Verificar se há conexão
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('Sem conexão, não é possível sincronizar culturas');
      return { success: false, syncedCount: 0 };
    }
    
    // Buscar atualizações pendentes
    const pendingDataStr = await AsyncStorage.getItem('pendingCulturasUpdates');
    if (!pendingDataStr) {
      console.log('Nenhuma atualização de culturas pendente');
      return { success: true, syncedCount: 0 };
    }
    
    const pendingData = JSON.parse(pendingDataStr) as Record<string, PendingCulturaData>;
    const pendingLoteIds = Object.keys(pendingData);
    
    if (pendingLoteIds.length === 0) {
      return { success: true, syncedCount: 0 };
    }
    
    console.log(`Sincronizando culturas de ${pendingLoteIds.length} lotes pendentes`);
    
    // Para cada atualização pendente, enviar para a API
    let syncedCount = 0;
    const newPendingData = { ...pendingData };
    
    for (const loteId of pendingLoteIds) {
      const update = pendingData[loteId];
      try {
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
          // Não precisa enviar deletedCultureIds pois a API substitui todas as culturas
        });
        
        // Remover do objeto de pendentes
        delete newPendingData[loteId];
        syncedCount++;
      } catch (error) {
        console.error(`Erro ao sincronizar culturas do lote ${loteId}:`, error);
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
    
    if (syncedCount > 0) {
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
    return { success: false, syncedCount: 0 };
  }
};

// Função para verificar e iniciar sincronização
export const checkAndSyncCulturas = async (): Promise<void> => {
  try {
    // Verificar se há conexão
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return;
    }
    
    // Verificar timestamp de última sincronização
    const ultimaSincronizacao = await AsyncStorage.getItem('culturas_ultima_sincronizacao');
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
    const pendingDataStr = await AsyncStorage.getItem('pendingCulturasUpdates');
    if (!pendingDataStr) {
      return;
    }
    
    const pendingData = JSON.parse(pendingDataStr);
    const pendingCount = Object.keys(pendingData).length;
    
    if (pendingCount > 0) {
      // Mostrar toast informativo discreto
      Toast.show({
        type: 'info',
        text1: 'Sincronizando culturas',
        text2: `Enviando culturas de ${pendingCount} lotes pendentes...`,
        visibilityTime: 2000,
      });
      
      // Iniciar sincronização
      const resultado = await syncPendingCulturas();
      
      // Registrar timestamp de sincronização bem-sucedida
      if (resultado.success) {
        await AsyncStorage.setItem('culturas_ultima_sincronizacao', new Date().toISOString());
      }
    }
  } catch (error) {
    console.error('Erro ao verificar sincronização de culturas:', error);
  }
};

// Função para aplicar alterações pendentes aos lotes locais (para LotesScreen usar)
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
          
          // Adicionar novas culturas (que não existiam antes)
          const existingCultureIds = lote.Culturas.map((c: Cultura) => c.id);
          const newCultures = pendingUpdate.culturas.filter(
            (c: CulturaFormatada) => !existingCultureIds.includes(c.culturaId) && c.isNew
          );
          
          // Informação não usada diretamente, mas pode ser útil para debug
          if (newCultures.length > 0) {
            console.log(`Lote ${lote.id} tem ${newCultures.length} novas culturas pendentes`);
          }
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