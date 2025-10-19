// src/screens/leituras/LeiturasScreen.tsx
// VERSÃO OFFLINE-FIRST: WatermelonDB + Sincronização manual

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLeiturasContext } from "../../contexts/LeiturasContext";
import LeituraCard from "../../components/leituras/LeituraCard";
import ErrorMessage from "../../components/ErrorMessage";
import { useTheme } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import { formatMesAno } from "@/src/utils/formatters";
import { database } from "../../database";
import { Q } from "@nozbe/watermelondb";
import Leitura from "../../database/models/Leitura";
import SyncService from "../../services/SyncService";
import UploadService, { UploadProgress } from "../../services/UploadService";
import UploadProgressModal from "../../components/upload/UploadProgressModal";
import SyncLoadingOverlay from "../../components/common/SyncLoadingOverlay";

// Storage keys
const FATURAS_STORAGE_KEY = "leituras_faturas_selecionadas";
const MES_ANO_STORAGE_KEY = "leituras_mes_ano_selecionado";

// Interfaces
interface Fatura {
  id: number;
  valor_leitura_m3: number;
  valor_monetario: number;
  valor_parte_fixa: number;
  valor_total: number;
  status: string;
  fechada: string;
  Tarifas?: any[];
  mes_leitura: number;
  ano_leitura: number;
  [key: string]: any;
}

interface LeituraMensal {
  mesAno: string;
  valorTotal: number;
  valorMonetario: number;
  valorParteFixa: number;
  volumeTotal: number;
  leiturasInformadas: number;
  totalLeituras: number;
  faturas: Fatura[];
  isAllFechada: boolean;
  temDadosPendentes?: boolean;
}

const LeiturasScreen: React.FC = () => {
  // Estados essenciais
  const [leituras, setLeituras] = useState<LeituraMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0); // Contador de pendências
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    leiturasTotal: 0,
    leiturasEnviadas: 0,
    imagensTotal: 0,
    imagensEnviadas: 0,
    leiturasComErro: 0,
    imagensComErro: 0,
    observacoesTotal: 0,
    observacoesEnviadas: 0,
    observacoesComErro: 0,
    comentariosTotal: 0,
    comentariosEnviados: 0,
    comentariosComErro: 0,
    status: 'idle',
  });
  
  // Estados para o overlay de sincronização profissional
  const [syncOverlay, setSyncOverlay] = useState({
    visible: false,
    title: '',
    subtitle: '',
    type: 'loading' as 'loading' | 'success' | 'error',
  });

  const { user } = useAuth();
  const { colors } = useTheme();
  const { setFaturasSelecionadas, setMesAnoSelecionado, mesAnoSelecionado } =
    useLeiturasContext();

  /**
   * Funções auxiliares para controle do overlay de sincronização
   */
  const showSyncOverlay = (title: string, subtitle?: string, type: 'loading' | 'success' | 'error' = 'loading') => {
    setSyncOverlay({ visible: true, title, subtitle: subtitle || '', type });
  };

  const hideSyncOverlay = () => {
    setSyncOverlay(prev => ({ ...prev, visible: false }));
  };

  const updateSyncOverlay = (updates: Partial<typeof syncOverlay>) => {
    setSyncOverlay(prev => ({ ...prev, ...updates }));
  };

  /**
   * Verificar status da conexão
   */
  const checkConnection = async () => {
    const netInfo = await NetInfo.fetch();
    setIsOffline(!netInfo.isConnected);
    return netInfo.isConnected;
  };

  /**
   * Contar leituras, imagens, observações e comentários pendentes de upload
   */
  const contarPendencias = async () => {
    try {
      const leiturasCollection = database.get('leituras');
      const leiturasPendentes = await leiturasCollection
        .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
        .fetchCount();

      const imagensCollection = database.get('imagens');
      const imagensPendentes = await imagensCollection
        .query(Q.where('sync_status', Q.oneOf(['uploading', 'error'])))
        .fetchCount();

      // ✅ Contar observações pendentes
      const observacoesCollection = database.get('observacoes');
      const observacoesPendentes = await observacoesCollection
        .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
        .fetchCount();

      // ✅ Contar comentários pendentes
      const comentariosCollection = database.get('observacoes_comentarios');
      const comentariosPendentes = await comentariosCollection
        .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
        .fetchCount();

      const total = leiturasPendentes + imagensPendentes + observacoesPendentes + comentariosPendentes;
      setPendingCount(total);
      return total;
    } catch (error) {
      console.error('[PENDENCIAS] Erro ao contar:', error);
      return 0;
    }
  };


  /**
   * Calcular volume positivo (para exibição)
   */
  const calcularVolumePositivo = (faturas: any[]) => {
    if (!faturas || !faturas.length) return 0;
    return faturas.reduce((sum, fatura) => {
      const volume = parseFloat(fatura.valor_leitura_m3) || 0;
      return sum + (volume > 0 ? volume : 0);
    }, 0);
  };

  /**
   * Verificar se há consumos negativos
   */
  const verificarConsumosNegativos = (faturas: any[]) => {
    if (!faturas || !faturas.length) return false;
    return faturas.some((fatura) => {
      const volume = parseFloat(fatura.valor_leitura_m3) || 0;
      return volume < 0;
    });
  };

  /**
   * Carregar resumo de faturas fechadas do AsyncStorage (cache visual)
   */
  const carregarResumosFechados = async (): Promise<LeituraMensal[]> => {
    try {
      const indexStr = await AsyncStorage.getItem('leituras_meses_fechados_index');
      if (!indexStr) return [];

      const mesesFechados = JSON.parse(indexStr) as string[];
      const resumos: LeituraMensal[] = [];

      for (const mesAno of mesesFechados) {
        // CORREÇÃO: Converter "10/2025" para "leituras_resumo_10_2025" (igual ao SyncService)
        const [mes, ano] = mesAno.split('/');
        const key = `leituras_resumo_${mes}_${ano}`;
        
        const resumoStr = await AsyncStorage.getItem(key);

        if (resumoStr) {
          const resumo = JSON.parse(resumoStr);
          
          resumos.push({
            mesAno: `${resumo.mes}/${resumo.ano}`,
            valorTotal: 0,
            valorMonetario: 0,
            valorParteFixa: 0,
            volumeTotal: resumo.volumeTotal || 0,
            leiturasInformadas: resumo.leiturasInformadas || 0,
            totalLeituras: resumo.totalLeituras || 0,
            faturas: [],
            isAllFechada: true,
            temDadosPendentes: false,
          });
        }
      }

      return resumos;
    } catch (error) {
      console.error('[CACHE] Erro ao carregar resumos fechados:', error);
      return [];
    }
  };

  /**
   * Carregar dados do WatermelonDB e agrupar por mês
   */
  const carregarDadosDoWatermelon = async () => {
    try {
      const leiturasCollection = database.get('leituras');
      const todasLeituras = await leiturasCollection.query().fetch();

      // Agrupar leituras por mês/ano
      const leiturasPorMes = new Map<string, any[]>();

      for (const leitura of todasLeituras) {
        const leituraData = leitura as any;
        const mesAno = `${leituraData.mesReferencia}/${leituraData.anoReferencia}`;
        if (!leiturasPorMes.has(mesAno)) {
          leiturasPorMes.set(mesAno, []);
        }
        leiturasPorMes.get(mesAno)?.push(leituraData);
      }

      // Converter para formato de LeituraMensal
      const leiturasAbertas: LeituraMensal[] = Array.from(leiturasPorMes.entries()).map(
        ([mesAno, leituras]) => {
          // ✅ CORREÇÃO: Só considera informada se leituraAtual > 0 (não basta ter dataLeitura)
          const leiturasInformadas = leituras.filter(
            (l: any) => l.leituraAtual > 0
          ).length;
          const volumeTotal = leituras.reduce((sum: number, l: any) => sum + l.consumo, 0);
          const temPendentes = leituras.some(
            (l: any) => l.syncStatus !== 'synced'
          );

          // Converter leituras para formato de Fatura (compatibilidade)
          const faturas: Fatura[] = leituras.map((l: any) => ({
            id: l.serverId,
            // ✅ CORREÇÃO: valor_leitura_m3 é o consumo (calculado no SyncService)
            valor_leitura_m3: l.consumo || 0,
            valor_monetario: 0,
            valor_parte_fixa: 0,
            valor_total: 0,
            status: l.status || 'pendente', // ✅ Usar status real do banco
            fechada: l.fechada || 'Não', // ✅ Usar fechada real do banco
            mes_leitura: parseInt(l.mesReferencia) || 0, // ✅ Usar mes correto
            ano_leitura: l.anoReferencia || 0, // ✅ Usar ano correto

            // ✅ Objetos aninhados com dados REAIS do banco (com valores padrão seguros)
            LoteAgricola: {
              id: l.loteId || 0, // ✅ CORREÇÃO: Usar loteId do banco (migration v7)
              nomeLote: l.loteNome || 'Lote não identificado',
              situacao: l.loteSituacao || 'Operacional', // ✅ NOVO: Situação do lote
              mapa_leitura: l.loteMapaLeitura || undefined, // ✅ NOVO: Mapa de leitura
            },
            Cliente: {
              id: 0, // Campo não disponível no modelo simplificado
              nome: l.irriganteNome || 'Cliente não identificado',
            },
            Hidrometro: {
              id: 0, // Campo não disponível no modelo simplificado
              codHidrometro: l.hidrometroCodigo || 'N/D',
              modelo: '', // Campo não disponível no modelo simplificado
              registro_atual: l.leituraAnterior || 0,
              x10: l.hidrometroX10 === true, // ✅ Garantir boolean (não null/undefined)
            },
            Leitura: l.leituraAtual > 0 ? {
              leitura: l.leituraAtual,
              data_leitura: l.dataLeitura || new Date().toISOString().split('T')[0],
              imagem_leitura: l.hasLocalImage || l.imagemUrl ? (l.imagemUrl || 'local') : null, // ✅ Informação de imagem
            } : undefined,

            // Campos legados (compatibilidade - com valores seguros)
            leitura_anterior: l.leituraAnterior || 0,
            data_leitura_anterior: l.dataLeituraAnterior || null,
          }));

          return {
            mesAno,
            valorTotal: 0,
            valorMonetario: 0,
            valorParteFixa: 0,
            volumeTotal,
            leiturasInformadas,
            totalLeituras: leituras.length,
            faturas,
            isAllFechada: false,
            temDadosPendentes: temPendentes,
          };
        }
      );

      // Carregar resumos de faturas fechadas
      const faturasFechadas = await carregarResumosFechados();

      // Combinar abertas + fechadas
      const todasFaturas = [...leiturasAbertas, ...faturasFechadas];

      // Ordenar por data (mais recente primeiro)
      todasFaturas.sort((a, b) => {
        const [mesA, anoA] = a.mesAno.split('/').map(Number);
        const [mesB, anoB] = b.mesAno.split('/').map(Number);
        if (anoA !== anoB) return anoB - anoA;
        return mesB - mesA;
      });

      setLeituras(todasFaturas);

      // Atualizar timestamp
      const timestamp = await AsyncStorage.getItem('leituras_timestamp');
      setLastSyncTime(timestamp);

      // Contar pendências
      await contarPendencias();
    } catch (error) {
      console.error('[WATERMELON] Erro ao carregar dados:', error);
      throw error;
    }
  };

  /**
   * Carregar leituras (WatermelonDB + sincronização opcional)
   */
  const carregarLeituras = useCallback(
    async (forcarServidor: boolean = false) => {
      try {
        if (!refreshing) {
          setLoading(true);
        }

        setError('');

        // Carregar do WatermelonDB primeiro (sempre rápido)
        await carregarDadosDoWatermelon();

        // Verificar conexão
        const isConnected = await checkConnection();

        // Se online e forçou atualização, sincronizar
        if (isConnected && forcarServidor) {
          showSyncOverlay('Sincronizando...', 'Buscando dados atualizados do servidor', 'loading');
          
          const result = await SyncService.syncLeituras();

          if (result.success) {
            await carregarDadosDoWatermelon(); // Recarregar após sync
            updateSyncOverlay({ 
              title: 'Sincronizado!', 
              subtitle: result.mensagem, 
              type: 'success' 
            });
            
            // Esconder overlay após 2 segundos
            setTimeout(() => hideSyncOverlay(), 2000);
          } else {
            throw new Error(result.mensagem);
          }
        } else if (!isConnected && leituras.length === 0) {
          // Sem conexão e sem dados locais
          setError('Sem conexão e nenhum dado local');
        }
      } catch (error: any) {
        console.error('[LEITURAS] Erro ao carregar:', error);

        if (leituras.length === 0) {
          setError('Falha ao carregar. Verifique sua conexão.');
        } else {
          updateSyncOverlay({ 
            title: 'Erro na sincronização', 
            subtitle: error.message || 'Tente novamente mais tarde', 
            type: 'error' 
          });
          
          // Esconder overlay após 3 segundos para erros
          setTimeout(() => hideSyncOverlay(), 3000);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshing, leituras.length]
  );

  /**
   * Pull-to-refresh simplificado (sempre tenta sincronizar)
   */
  const onRefresh = async () => {
    setRefreshing(true);
    await carregarLeituras(true);
  };

  /**
   * Navegar para detalhes de um mês
   */
  const handleCardPress = async (leitura: LeituraMensal) => {
    // Verificar se é fatura fechada e se está offline
    if (leitura.isAllFechada && isOffline) {
      showSyncOverlay('Sem conexão', 'Visualização de faturas fechadas requer conexão', 'error');
      setTimeout(() => hideSyncOverlay(), 3000);
      return;
    }

    // ✅ MELHORIA: Feedback visual profissional para navegação
    if (leitura.isAllFechada) {
      showSyncOverlay('Carregando...', 'Buscando detalhes das faturas fechadas', 'loading');
    } else {
      showSyncOverlay('Carregando...', 'Preparando dados das leituras', 'loading');
    }
    
    try {
      // CORREÇÃO: Para faturas fechadas, sempre limpar estado para forçar reload
      if (leitura.isAllFechada) {
        // Limpar AsyncStorage para forçar carregamento da API
        await AsyncStorage.removeItem(FATURAS_STORAGE_KEY);
        // Limpar contexto (array vazio) para forçar reload no useEffect
        setFaturasSelecionadas([]);
        setMesAnoSelecionado(leitura.mesAno);
        
        // Delay mínimo para feedback visual
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        // Para faturas abertas, salvar normalmente + delay visual para consistência
        await AsyncStorage.setItem(
          FATURAS_STORAGE_KEY,
          JSON.stringify(leitura.faturas)
        );
        setFaturasSelecionadas(leitura.faturas);
        setMesAnoSelecionado(leitura.mesAno);
        
        // ✅ Delay mínimo para feedback visual (dados locais são rápidos)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      router.push('/LeiturasDetalhes');
    } finally {
      hideSyncOverlay();
    }
  };

  /**
   * Abrir modal de upload (mostra resumo)
   */
  const handleUpload = async () => {
    if (pendingCount === 0) {
      showSyncOverlay('Nada para enviar', 'Todas as leituras estão sincronizadas', 'success');
      setTimeout(() => hideSyncOverlay(), 2000);
      return;
    }

    if (isOffline) {
      showSyncOverlay('Sem conexão', 'Conecte-se à internet para enviar', 'error');
      setTimeout(() => hideSyncOverlay(), 3000);
      return;
    }

    // Contar pendências para mostrar no modal
    const leiturasCollection = database.get('leituras');
    const leiturasPendentes = await leiturasCollection
      .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
      .fetchCount();

    const imagensCollection = database.get('imagens');
    const imagensPendentes = await imagensCollection
      .query(Q.where('sync_status', Q.oneOf(['uploading', 'error'])))
      .fetchCount();

    // ✅ Contar observações pendentes
    const observacoesCollection = database.get('observacoes');
    const observacoesPendentes = await observacoesCollection
      .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
      .fetchCount();

    // ✅ Contar comentários pendentes
    const comentariosCollection = database.get('observacoes_comentarios');
    const comentariosPendentes = await comentariosCollection
      .query(Q.where('sync_status', Q.oneOf(['local_edited', 'error'])))
      .fetchCount();

    // Atualizar estado com totais (status idle para mostrar resumo)
    setUploadProgress({
      leiturasTotal: leiturasPendentes,
      leiturasEnviadas: 0,
      imagensTotal: imagensPendentes,
      imagensEnviadas: 0,
      leiturasComErro: 0,
      imagensComErro: 0,
      observacoesTotal: observacoesPendentes,
      observacoesEnviadas: 0,
      observacoesComErro: 0,
      comentariosTotal: comentariosPendentes,
      comentariosEnviados: 0,
      comentariosComErro: 0,
      status: 'idle', // Status idle mostra tela de resumo
    });

    // Abrir modal
    setShowUploadModal(true);
  };

  /**
   * Iniciar upload após confirmação do usuário
   */
  const handleStartUpload = async () => {
    const result = await UploadService.uploadAll((progress) => {
      setUploadProgress(progress);
    });

    // Após conclusão, atualizar contadores
    await contarPendencias();
    await carregarDadosDoWatermelon();
  };

  /**
   * Componente de lista vazia
   */
  const EmptyListComponent = React.memo(() => {
    const handleRetry = useCallback(() => {
      carregarLeituras(true);
    }, []);

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>Nenhuma leitura encontrada</Text>
        {!isOffline && (
          <TouchableOpacity style={styles.reloadButton} onPress={handleRetry}>
            <Ionicons name="reload" size={18} color="#fff" />
            <Text style={styles.reloadButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  });

  /**
   * Recarregar dados quando a tela receber foco (volta de outras telas)
   */
  useFocusEffect(
    useCallback(() => {
      // ✅ CORREÇÃO: Recarregar dados do WatermelonDB quando volta de tela de detalhes
      // Isso atualiza o volume total após edições locais
      carregarDadosDoWatermelon();
    }, [])
  );

  /**
   * Inicialização ao montar componente
   */
  useEffect(() => {
    const inicializar = async () => {
      try {
        // Carregar dados locais primeiro (rápido)
        await carregarDadosDoWatermelon();
        setLoading(false);

        // Verificar conexão
        const isConnected = await checkConnection();
        if (isConnected) {
          // ✅ Sincronizar em background COM feedback visual profissional
          showSyncOverlay('Sincronizando...', 'Buscando dados atualizados', 'loading');

          SyncService.syncLeituras()
            .then((result) => {
              if (result.success) {
                carregarDadosDoWatermelon();
                updateSyncOverlay({ 
                  title: 'Sincronizado!', 
                  subtitle: result.mensagem, 
                  type: 'success' 
                });
                
                // Esconder overlay após 2 segundos
                setTimeout(() => hideSyncOverlay(), 2000);
              }
            })
            .catch((err) => {
              console.warn('[INIT] Erro ao sincronizar em background', err);
              updateSyncOverlay({ 
                title: 'Erro na sincronização', 
                subtitle: 'Usando dados locais', 
                type: 'error' 
              });
              
              // Esconder overlay após 3 segundos para erros
              setTimeout(() => hideSyncOverlay(), 3000);
            });
        }
      } catch (error) {
        console.error('[INIT] Erro na inicialização:', error);
        setLoading(false);
      }
    };

    inicializar();

    // Verificar conexão periodicamente
    const intervalId = setInterval(checkConnection, 15000); // A cada 15s

    // Contar pendências periodicamente
    const contadorId = setInterval(contarPendencias, 5000); // A cada 5s

    return () => {
      clearInterval(intervalId);
      clearInterval(contadorId);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Banner de status de conexão */}
      {isOffline && (
        <View style={styles.offlineBar}>
          <Ionicons name="cloud-offline" size={18} color="#fff" />
          <Text style={styles.offlineText}>
            Modo Offline - Apenas visualização
          </Text>
        </View>
      )}

      {/* Mensagem de erro */}
      {error ? <ErrorMessage error={error} visible={!!error} /> : null}

      {/* Loading inicial */}
      {loading && leituras.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2a9d8f" />
          <Text style={styles.loadingText}>Carregando leituras...</Text>
        </View>
      ) : (
        <FlatList
          data={leituras}
          ListEmptyComponent={loading ? null : <EmptyListComponent />}
          keyExtractor={(item) => item.mesAno}
          renderItem={({ item }) => (
            <LeituraCard
              mesAno={item.mesAno}
              leiturasInformadas={item.leiturasInformadas}
              totalLeituras={item.totalLeituras}
              volumeTotal={item.volumeTotal}
              faturas={item.faturas}
              onPress={() => handleCardPress(item)}
              isAllFechada={item.isAllFechada}
              temDadosPendentes={item.temDadosPendentes || false}
              volumePositivo={calcularVolumePositivo(item.faturas)}
              temConsumosNegativos={verificarConsumosNegativos(item.faturas)}
              lastUpdate={lastSyncTime || undefined}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2a9d8f']}
              tintColor="#2a9d8f"
            />
          }
          ListHeaderComponent={
            pendingCount > 0 ? (
              <TouchableOpacity style={styles.uploadBanner} onPress={handleUpload}>
                <View style={styles.uploadContent}>
                  <Ionicons name="cloud-upload-outline" size={24} color="#2a9d8f" />
                  <View style={styles.uploadTextContainer}>
                    <Text style={styles.uploadTitle}>
                      {pendingCount} {pendingCount === 1 ? 'item pendente' : 'itens pendentes'}
                    </Text>
                    <Text style={styles.uploadSubtitle}>Toque para enviar ao servidor</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ) : null
          }
          ListFooterComponent={
            lastSyncTime ? (
              <View style={styles.syncInfo}>
                <Ionicons name="time-outline" size={14} color="#999" />
                <Text style={styles.syncText}>
                  Última sincronização:{' '}
                  {new Date(lastSyncTime).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ) : null
          }
        />
      )}


      {/* Modal de progresso de upload */}
      <UploadProgressModal
        visible={showUploadModal}
        progress={uploadProgress}
        onClose={() => setShowUploadModal(false)}
        onStartUpload={handleStartUpload}
      />

      {/* Overlay de sincronização profissional */}
      <SyncLoadingOverlay
        visible={syncOverlay.visible}
        title={syncOverlay.title}
        subtitle={syncOverlay.subtitle}
        type={syncOverlay.type}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a9d8f',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  reloadButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  offlineBar: {
    backgroundColor: '#ff6b6b',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 6,
  },
  syncText: {
    fontSize: 12,
    color: '#999',
  },
  uploadBanner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  uploadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: '#666',
  },
});

export default LeiturasScreen;
