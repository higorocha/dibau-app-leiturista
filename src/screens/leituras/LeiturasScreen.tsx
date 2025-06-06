// src/screens/leituras/LeiturasScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
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
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLeiturasContext } from "../../contexts/LeiturasContext";
import api from "../../api/axiosConfig";
import LeituraCard from "../../components/leituras/LeituraCard";
import ErrorMessage from "../../components/ErrorMessage";
import { useTheme } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import ImagemLeituraService from "@/src/services/ImagemLeituraService";
import { formatMesAno } from "@/src/utils/formatters";
import SyncProgressModal from "@/src/components/common/SyncProgressModal";
import { syncPendingLeituras, cancelSync } from "@/src/services/SyncService";

// Adicione após as importações:
const FATURAS_STORAGE_KEY = "leituras_faturas_selecionadas";
const MES_ANO_STORAGE_KEY = "leituras_mes_ano_selecionado";

// Interface para o objeto de leitura mensal
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
  quantidadeLeituras?: number;
  valorTotal: number;
  valorMonetario: number;
  valorParteFixa: number;
  volumeTotal: number;
  dataCriacao: string;
  leiturasInformadas: number;
  totalLeituras: number;
  faturas: Fatura[];
  isAllFechada: boolean;
}

const LeiturasScreen: React.FC = () => {
  const [leituras, setLeituras] = useState<LeituraMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [sincronizandoEmBackground, setSincronizandoEmBackground] =
    useState(false);
  const [mesesComDadosPendentes, setMesesComDadosPendentes] = useState<{
    [key: string]: boolean;
  }>({});
  // Estados para o modal de progresso
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncItemsProcessed, setSyncItemsProcessed] = useState(0);
  const [syncTotalItems, setSyncTotalItems] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");

  // Adicione os estados para o progresso das imagens
  const [imgSyncProgress, setImgSyncProgress] = useState(0);
  const [imgSyncItemsProcessed, setImgSyncItemsProcessed] = useState(0);
  const [imgSyncTotalItems, setImgSyncTotalItems] = useState(0);
  const [imgSyncMessage, setImgSyncMessage] = useState("");

  const { user } = useAuth();
  const { colors } = useTheme();
  const { setFaturasSelecionadas, setMesAnoSelecionado, mesAnoSelecionado } =
    useLeiturasContext();

  // Função para verificar conexão
  const checkConnection = async () => {
    const netInfo = await NetInfo.fetch();
    setIsOffline(!netInfo.isConnected);
    return netInfo.isConnected;
  };

  const verificarDadosPendentes = useCallback(async () => {
    try {
      console.log("[DEBUG] Iniciando verificação de dados pendentes");

      // Verificar todos os tipos de dados pendentes
      const [pendingSyncsStr, pendingUpdatesStr, pendingImagesStr] =
        await Promise.all([
          AsyncStorage.getItem("pendingLeiturasSyncs"),
          AsyncStorage.getItem("pendingLeituraUpdates"),
          AsyncStorage.getItem("pendingImagesUploads"),
        ]);

      // 1. Processamento de leituras pendentes
      let leiturasIds: string[] = [];

      // Verificar pendingSyncs (faturas marcadas explicitamente como pendentes)
      if (pendingSyncsStr) {
        const pendingSyncs = JSON.parse(pendingSyncsStr);
        leiturasIds = Object.keys(pendingSyncs);
        console.log(
          `[DEBUG] Leituras marcadas como pendentes: ${leiturasIds.length}`
        );
      }

      // Verificar pendingUpdates (dados de leituras editados offline)
      if (pendingUpdatesStr) {
        const pendingUpdates = JSON.parse(pendingUpdatesStr);
        const updateIds = Object.keys(pendingUpdates);

        // Adicionar IDs que ainda não estão na lista
        updateIds.forEach((id) => {
          if (!leiturasIds.includes(id)) {
            leiturasIds.push(id);
          }
        });
        console.log(
          `[DEBUG] Total leituras pendentes com updates: ${leiturasIds.length}`
        );
      }

      // 2. Processamento de imagens pendentes
      let imagesFaturaIds: number[] = [];

      if (pendingImagesStr) {
        try {
          const pendingImages = JSON.parse(pendingImagesStr);

          // Extrair IDs de faturas associadas às imagens pendentes
          Object.values(pendingImages).forEach((item: any) => {
            if (item && typeof item.faturaId === "number") {
              imagesFaturaIds.push(item.faturaId);
            }
          });

          console.log(
            `[DEBUG] Faturas com imagens pendentes: ${imagesFaturaIds.length}`
          );
        } catch (err) {
          console.error("[ERROR] Erro ao processar imagens pendentes:", err);
        }
      }

      // Se não há pendências de nenhum tipo, limpar e retornar
      if (leiturasIds.length === 0 && imagesFaturaIds.length === 0) {
        console.log("[DEBUG] Nenhuma pendência encontrada");
        setMesesComDadosPendentes({});
        return;
      }

      // 3. Mapeamento dos meses com pendências
      const mesesPendentes: { [key: string]: boolean } = {};
      const mesesProcessados = new Set<string>();

      // Para cada leitura mensal
      leituras.forEach((leitura) => {
        // Evitar processamento duplicado
        if (mesesProcessados.has(leitura.mesAno)) return;

        let temPendencia = false;

        // Verificar leituras pendentes
        if (leiturasIds.length > 0) {
          const temLeituraPendente = leitura.faturas.some((fatura) =>
            leiturasIds.includes(String(fatura.id))
          );

          if (temLeituraPendente) {
            temPendencia = true;
            console.log(`[DEBUG] Mês ${leitura.mesAno} tem leituras pendentes`);
          }
        }

        // Verificar imagens pendentes
        if (!temPendencia && imagesFaturaIds.length > 0) {
          const temImagemPendente = leitura.faturas.some((fatura) =>
            imagesFaturaIds.includes(fatura.id)
          );

          if (temImagemPendente) {
            temPendencia = true;
            console.log(`[DEBUG] Mês ${leitura.mesAno} tem imagens pendentes`);
          }
        }

        // Se este mês tem pendências, marcar e registrar
        if (temPendencia) {
          mesesPendentes[leitura.mesAno] = true;
          mesesProcessados.add(leitura.mesAno);
        }
      });

      // Log dos meses com pendências
      const mesesPendentesKeys = Object.keys(mesesPendentes);
      if (mesesPendentesKeys.length > 0) {
        console.log(
          `[DEBUG] Meses com pendências: ${mesesPendentesKeys.join(", ")}`
        );
      } else {
        console.log(
          "[DEBUG] Nenhum mês com pendências encontrado (verificação de meses inconsistente)"
        );
      }

      // Atualizar o estado
      setMesesComDadosPendentes(mesesPendentes);
    } catch (error) {
      console.error("[ERROR] Erro ao verificar dados pendentes:", error);
    }
  }, [leituras]);

  // Chame a função quando as leituras mudarem
  useEffect(() => {
    verificarDadosPendentes();
  }, [leituras, verificarDadosPendentes]);

  // Adicione a função para sincronizar um mês específico
  const sincronizarMes = async (mesAno: string) => {
    try {
      if (isOffline) {
        Toast.show({
          type: "error",
          text1: "Sem conexão",
          text2: "Não é possível sincronizar sem conexão com a internet",
          position: "bottom",
          visibilityTime: 2000,
        });
        return;
      }

      // Encontrar a leitura correspondente a este mês
      const leitura = leituras.find((l) => l.mesAno === mesAno);
      if (!leitura) return;

      // Preparar o modal de progresso
      setSyncProgress(0);
      setSyncItemsProcessed(0);
      setSyncTotalItems(0);
      setSyncMessage(
        `Verificando dados pendentes de ${formatMesAno(mesAno)}...`
      );

      // Resetar progresso de imagens
      setImgSyncProgress(0);
      setImgSyncItemsProcessed(0);
      setImgSyncTotalItems(0);
      setImgSyncMessage("");

      setSyncModalVisible(true);

      // Verificar se temos imagens pendentes para este mês
      const imagensPendentes =
        await ImagemLeituraService.verificarImagensPendentes(leitura.faturas);
      const totalImagensPendentes = Object.keys(imagensPendentes).length;

      // Verificar se temos leituras pendentes para este mês
      const pendingLeiturasStr = await AsyncStorage.getItem(
        "pendingLeituraUpdates"
      );
      const pendingLeituras = pendingLeiturasStr
        ? JSON.parse(pendingLeiturasStr)
        : {};

      // Filtrar apenas leituras deste mês
      const leiturasDesteMes = leitura.faturas
        .map((f) => String(f.id))
        .filter((id) => pendingLeituras[id]);

      const temLeiturasParaSincronizar = leiturasDesteMes.length > 0;

      console.log(
        `[DEBUG] Mês ${mesAno}: ${leiturasDesteMes.length} leituras pendentes, ${totalImagensPendentes} imagens pendentes`
      );

      // Executar sincronizações apropriadas
      let leiturasSincronizadas = 0;
      let imagensSincronizadas = 0;

      // 1. Sincronizar leituras, se houver
      if (temLeiturasParaSincronizar) {
        setSyncMessage(
          `Sincronizando ${leiturasDesteMes.length} leituras de ${formatMesAno(
            mesAno
          )}...`
        );
        setSyncTotalItems(leiturasDesteMes.length);

        const resultadoLeituras = await syncPendingLeituras({
          onStart: (total: number) => {
            console.log(`[DEBUG] Iniciando sincronização de ${total} leituras`);
          },
          onProgress: (processed: number, total: number) => {
            const percentComplete = (processed / total) * 100;
            setSyncProgress(percentComplete);
            setSyncItemsProcessed(processed);
            setSyncMessage(
              `Sincronizando leitura ${processed} de ${total} para ${formatMesAno(
                mesAno
              )}...`
            );
          },
          onComplete: (success: boolean, syncedCount: number) => {
            if (success) {
              setSyncProgress(100);
              leiturasSincronizadas = syncedCount;
              console.log(
                `[DEBUG] ${syncedCount} leituras sincronizadas com sucesso`
              );
            }
          },
          onCancel: () => {
            console.log(
              "[DEBUG] Sincronização de leituras cancelada pelo usuário"
            );
            setSyncModalVisible(false);
            return;
          },
        });
      } else {
        // Se não há leituras, marcar como concluído
        setSyncProgress(100);
        setSyncMessage("Nenhuma leitura pendente encontrada");
      }

      // 2. Sincronizar imagens, se houver
      if (totalImagensPendentes > 0) {
        setImgSyncMessage(
          `Preparando para enviar ${totalImagensPendentes} imagens...`
        );
        setImgSyncTotalItems(totalImagensPendentes);

        try {
          const resultadoImagens =
            await ImagemLeituraService.uploadImagensPendentes({
              onStart: (total: number) => {
                console.log(`[DEBUG] Iniciando upload de ${total} imagens`);
                setImgSyncMessage(`Enviando ${total} imagens pendentes...`);
              },
              onProgress: (processed: number, total: number) => {
                console.log(
                  `[DEBUG] Progresso de imagens: ${processed}/${total}`
                );
                const percent = (processed / total) * 100;
                setImgSyncProgress(percent);
                setImgSyncItemsProcessed(processed);
                setImgSyncMessage(
                  `Enviando imagem ${processed} de ${total}...`
                );
              },
              onComplete: (success: boolean, uploadedCount: number) => {
                console.log(
                  `[DEBUG] Upload de imagens: success=${success}, uploadedCount=${uploadedCount}`
                );
                setImgSyncProgress(100);
                imagensSincronizadas = uploadedCount;

                if (success && uploadedCount > 0) {
                  setImgSyncMessage(
                    `Upload de ${uploadedCount} imagens concluído!`
                  );
                } else if (!success) {
                  setImgSyncMessage("Ocorreu um erro ao enviar imagens");
                } else {
                  setImgSyncMessage("Nenhuma imagem necessária envio");
                }
              },
              checkCancelled: () => false,
            });
        } catch (error) {
          console.error("[DEBUG] Erro ao sincronizar imagens:", error);
          setImgSyncProgress(100);
          setImgSyncMessage("Erro ao sincronizar imagens");
        }
      } else {
        // Se não há imagens, marcar como concluído
        setImgSyncProgress(100);
        setImgSyncMessage("Nenhuma imagem pendente encontrada");
      }

      // 3. Finalizar o processo
      setTimeout(() => {
        setSyncModalVisible(false);

        // Mensagem de sucesso baseada no que foi sincronizado
        const mensagemToast = () => {
          if (leiturasSincronizadas > 0 && imagensSincronizadas > 0) {
            return {
              type: "success",
              text1: "Sincronização concluída",
              text2: `${leiturasSincronizadas} leituras e ${imagensSincronizadas} imagens sincronizadas`,
            };
          } else if (leiturasSincronizadas > 0) {
            return {
              type: "success",
              text1: "Sincronização concluída",
              text2: `${leiturasSincronizadas} leituras sincronizadas`,
            };
          } else if (imagensSincronizadas > 0) {
            return {
              type: "success",
              text1: "Sincronização concluída",
              text2: `${imagensSincronizadas} imagens sincronizadas`,
            };
          } else {
            return {
              type: "info",
              text1: "Nada a sincronizar",
              text2: "Não havia dados pendentes para sincronização",
            };
          }
        };

        // Mostrar toast com resultado
        const msg = mensagemToast();
        Toast.show({
          ...msg,
          position: "bottom",
          visibilityTime: 3000,
        });

        // Atualizar a lista de meses com pendências
        verificarDadosPendentes();

        // Recarregar dados se algo foi sincronizado
        if (leiturasSincronizadas > 0 || imagensSincronizadas > 0) {
          carregarLeituras(true);
        }
      }, 1500);
    } catch (error) {
      console.error("[ERROR] Erro ao sincronizar mês:", error);
      setSyncModalVisible(false);
      Toast.show({
        type: "error",
        text1: "Erro",
        text2: "Ocorreu um erro durante a sincronização",
        position: "bottom",
        visibilityTime: 2000,
      });
    }
  };

  // Função para carregar dados offline
  const carregarDadosOffline = async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem("leituras_data");
      const timestamp = await AsyncStorage.getItem("leituras_timestamp");

      if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        setLeituras(dados);
        setLastSyncTime(timestamp);
        setHasMore(false);

        Toast.show({
          type: "info",
          text1: "Modo offline",
          text2: `Usando dados salvos em ${new Date(
            timestamp || ""
          ).toLocaleString()}`,
          visibilityTime: 3000,
        });
      } else {
        setError("Nenhum dado disponível para uso offline");
      }
    } catch (error) {
      console.error("Erro ao carregar dados offline:", error);
      setError("Erro ao carregar dados salvos");
    }
  };

  const calcularVolumePositivo = (faturas: any[]) => {
    if (!faturas || !faturas.length) return 0;

    return faturas.reduce((sum, fatura) => {
      const volume = parseFloat(fatura.valor_leitura_m3) || 0;
      return sum + (volume > 0 ? volume : 0);
    }, 0);
  };

  const verificarConsumosNegativos = (faturas: any[]) => {
    if (!faturas || !faturas.length) return false;

    return faturas.some((fatura) => {
      const volume = parseFloat(fatura.valor_leitura_m3) || 0;
      return volume < 0;
    });
  };

  const limparImagensFaturasFechadas = async (leituras: LeituraMensal[]) => {
    try {
      let totalRemovidas = 0;

      // Verificar cada mês de leituras
      for (const leitura of leituras) {
        if (leitura.isAllFechada) {
          const removidas =
            await ImagemLeituraService.limparImagensFaturasFechadas(
              leitura.mesAno,
              leitura.isAllFechada,
              leitura.faturas
            );

          totalRemovidas += removidas;
        }
      }

      if (totalRemovidas > 0) {
        console.log(
          `[LEITURAS] ${totalRemovidas} imagens de leituras removidas do armazenamento local`
        );
      }
    } catch (error) {
      console.error("[LEITURAS] Erro ao limpar imagens locais:", error);
    }
  };

  // Função para verificar se deve sincronizar baseado no timestamp
  const deveAtualizar = useCallback(async () => {
    try {
      // Verificar timestamp da última sincronização
      const ultimaSincronizacao = await AsyncStorage.getItem(
        "leituras_ultima_sincronizacao"
      );

      if (!ultimaSincronizacao) {
        console.log(
          "[DEBUG] Nenhuma sincronização anterior encontrada, deve sincronizar"
        );
        return true; // Nunca sincronizou antes
      }

      // Garantir que estamos lidando com timestamps UTC
      const ultimaData = new Date(ultimaSincronizacao).getTime();
      const agora = new Date().getTime();
      const duasHorasEmMS = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
      const diferenca = agora - ultimaData;

      // Verifica se passaram pelo menos 2 horas desde a última sincronização
      const deveSincronizar = diferenca > duasHorasEmMS;

      // Logs detalhados para debugging
      console.log(
        `[DEBUG] Timestamp da última sincronização: ${ultimaSincronizacao}`
      );
      console.log(
        `[DEBUG] Última sincronização: ${new Date(ultimaData).toLocaleString()}`
      );
      console.log(`[DEBUG] Horário atual: ${new Date(agora).toLocaleString()}`);
      console.log(
        `[DEBUG] Diferença em minutos: ${Math.floor(diferenca / 60000)}`
      );
      console.log(`[DEBUG] Deve sincronizar (passou 2h): ${deveSincronizar}`);

      return deveSincronizar;
    } catch (error) {
      console.error(
        "[DEBUG] Erro ao verificar timestamp de sincronização:",
        error
      );
      return true; // Em caso de erro, sincroniza por precaução
    }
  }, []);

  // Função para salvar o timestamp da sincronização
  const salvarTimestampSincronizacao = async () => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[DEBUG] Salvando timestamp de sincronização: ${timestamp}`);
      await AsyncStorage.setItem("leituras_ultima_sincronizacao", timestamp);
    } catch (error) {
      console.error(
        "[DEBUG] Erro ao salvar timestamp de sincronização:",
        error
      );
    }
  };

  const sincronizarDados = async () => {
    // Evita múltiplas sincronizações simultâneas
    if (sincronizandoEmBackground) {
      console.log(
        "[DEBUG] Sincronização já em andamento, ignorando solicitação duplicada"
      );
      return;
    }

    console.log("[DEBUG] sincronizarDados iniciado");
    try {
      setSincronizandoEmBackground(true);

      // Verificar conexão antes de tentar sincronizar
      const netInfo = await NetInfo.fetch();
      console.log(
        "[DEBUG] Status da rede:",
        netInfo.isConnected ? "Conectado" : "Desconectado"
      );

      if (!netInfo.isConnected) {
        console.log("[DEBUG] Sem conexão de rede, abortando sincronização");
        Toast.show({
          type: "error",
          text1: "Sem conexão",
          text2: "Não foi possível sincronizar sem conexão com a internet",
          visibilityTime: 2000,
        });
        return;
      }

      // Indicador discreto de sincronização
      Toast.show({
        type: "info",
        text1: "Sincronizando Leituras...",
        text2: "Atualizando dados de leituras em segundo plano",
        visibilityTime: 2000,
      });

      console.log(
        "[DEBUG] Enviando requisição para /faturamensal/app/leituras"
      );

      try {
        // Requisição com timeout maior
        const response = await api.get("/faturamensal/app/leituras", {
          timeout: 30000, // 30 segundos
        });

        console.log("[DEBUG] Resposta recebida, status:", response.status);

        if (response.data && response.data.success) {
          console.log("[DEBUG] Dados recebidos com sucesso");
          const { data, timestamp } = response.data;

          // Garantir que data é do tipo esperado
          const leiturasMensais = data as LeituraMensal[];

          if (!leiturasMensais || leiturasMensais.length === 0) {
            console.log("[DEBUG] Lista de leituras vazia na resposta");
            Toast.show({
              type: "warning",
              text1: "Sem leituras disponíveis",
              text2: "Nenhuma leitura disponível no momento",
              visibilityTime: 3000,
            });
            return;
          }

          // Log do tamanho dos dados
          console.log(
            `[DEBUG] Recebidas ${leiturasMensais.length} leituras, ${
              JSON.stringify(leiturasMensais).length
            } bytes`
          );

          // ARMAZENAMENTO FRAGMENTADO
          try {
            // 1. Salvar índice dos meses
            const mesesDisponiveis = leiturasMensais.map((mes) => mes.mesAno);
            await AsyncStorage.setItem(
              "leituras_meses_index",
              JSON.stringify(mesesDisponiveis)
            );
            console.log(
              `[DEBUG] Índice de ${mesesDisponiveis.length} meses salvo`
            );

            // 2. Salvar cada mês separadamente
            for (let i = 0; i < leiturasMensais.length; i++) {
              const mes = leiturasMensais[i];
              const chave = `leituras_mes_${mes.mesAno.replace("/", "_")}`;
              await AsyncStorage.setItem(chave, JSON.stringify(mes));
              console.log(`[DEBUG] Dados do mês ${mes.mesAno} salvos`);
            }

            // 3. Salvar timestamp
            await AsyncStorage.setItem("leituras_timestamp", timestamp);
            console.log("[DEBUG] Dados fragmentados salvos com sucesso");

            // 4. IMPORTANTE: Se estamos visualizando algum mês específico, atualizar também o storage do contexto
            // para garantir que os dados mais recentes sejam usados
            if (mesAnoSelecionado) {
              const mesSelecionado = leiturasMensais.find(
                (m) => m.mesAno === mesAnoSelecionado
              );
              if (mesSelecionado) {
                // Sobrescrever as faturas armazenadas para este mês
                await AsyncStorage.setItem(
                  FATURAS_STORAGE_KEY,
                  JSON.stringify(mesSelecionado.faturas)
                );
                console.log(
                  `[DEBUG] Faturas do mês ${mesAnoSelecionado} atualizadas no storage do contexto`
                );
              }
            }

            // 5. Atualizar a interface com os dados do servidor (prioridade sobre dados locais)
            setLeituras(leiturasMensais);
            setLastSyncTime(timestamp);
            setHasMore(false);

            // 6. Salvar timestamp de sincronização
            await salvarTimestampSincronizacao();

            Toast.show({
              type: "success",
              text1: "Leituras atualizadas",
              text2: "Dados de leituras sincronizados com sucesso",
              visibilityTime: 2000,
            });
          } catch (storageError) {
            console.error(
              "[DEBUG] Erro ao salvar no AsyncStorage:",
              storageError
            );

            // Mesmo com erro, atualiza interface
            setLeituras(leiturasMensais);
            setLastSyncTime(timestamp);
            setHasMore(false);
            limparImagensFaturasFechadas(leiturasMensais);
          }
        } else {
          console.log("[DEBUG] Resposta sem dados válidos");
          Toast.show({
            type: "error",
            text1: "Formato inválido",
            text2: "Os dados recebidos estão em formato inválido",
            visibilityTime: 3000,
          });
        }
      } catch (apiError) {
        console.error("[DEBUG] Erro na chamada de API:", apiError);
        Toast.show({
          type: "error",
          text1: "Erro no servidor",
          text2: "Não foi possível obter dados do servidor",
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error("[DEBUG] Erro geral na sincronização:", error);
    } finally {
      console.log("[DEBUG] sincronizarDados finalizado");
      setSincronizandoEmBackground(false);
    }
  };

  // Nova função para carregar apenas dados locais
  const carregarDadosLocais = async () => {
    try {
      console.log("[DEBUG] carregarDadosLocais iniciado");

      // Verificar se temos o índice de meses
      const mesesIndexStr = await AsyncStorage.getItem("leituras_meses_index");
      const timestamp = await AsyncStorage.getItem("leituras_timestamp");

      // Se não temos índice de meses, não temos dados locais
      if (!mesesIndexStr) {
        console.log("[DEBUG] Nenhum índice de meses encontrado");
        return false;
      }

      console.log("[DEBUG] Índice de meses encontrado, processando...");
      const mesesIndex = JSON.parse(mesesIndexStr) as string[];
      console.log(
        `[DEBUG] Encontrados ${mesesIndex.length} meses salvos localmente`
      );

      // Carregar dados de cada mês
      const dadosCompletos: LeituraMensal[] = [];
      let dadosCarregados = false;

      for (const mesAno of mesesIndex) {
        const chave = `leituras_mes_${mesAno.replace("/", "_")}`;
        console.log(`[DEBUG] Tentando carregar mês ${mesAno}`);

        const mesDataStr = await AsyncStorage.getItem(chave);

        if (mesDataStr) {
          try {
            const mesData = JSON.parse(mesDataStr) as LeituraMensal;
            dadosCompletos.push(mesData);
            dadosCarregados = true;
            console.log(`[DEBUG] Mês ${mesAno} carregado com sucesso`);
          } catch (jsonError) {
            console.error(
              `[DEBUG] Erro ao parsear dados do mês ${mesAno}:`,
              jsonError
            );
          }
        } else {
          console.log(`[DEBUG] Não encontrado dados para o mês ${mesAno}`);
        }
      }

      // Se não carregamos nenhum dado, retornar falso
      if (!dadosCarregados || dadosCompletos.length === 0) {
        console.log("[DEBUG] Nenhum dado mensal foi carregado");
        return false;
      }

      // Ordenar por data (mais recente primeiro)
      dadosCompletos.sort((a, b) => {
        const [mesA, anoA] = a.mesAno.split("/").map(Number);
        const [mesB, anoB] = b.mesAno.split("/").map(Number);

        if (anoA !== anoB) return anoB - anoA;
        return mesB - mesA;
      });

      console.log(
        `[DEBUG] ${dadosCompletos.length} meses ordenados, atualizando estado`
      );
      setLeituras(dadosCompletos);
      setLastSyncTime(timestamp);
      setHasMore(false);

      // Só mostrar toast se estiver offline
      if (isOffline) {
        Toast.show({
          type: "info",
          text1: "Modo offline",
          text2: `Usando dados salvos em ${new Date(
            timestamp || ""
          ).toLocaleString()}`,
          visibilityTime: 3000,
        });
      }

      return true;
    } catch (error) {
      console.error("[DEBUG] Erro ao carregar dados offline:", error);
      return false;
    }
  };

  // Função para limpar cache antigo (chamada uma vez após migração)
  const limparCacheAntigo = async () => {
    try {
      await AsyncStorage.removeItem("leituras_data");
      console.log("[STORAGE] Cache antigo removido com sucesso");
    } catch (error) {
      console.error("[STORAGE] Erro ao remover cache antigo:", error);
    }
  };

  const carregarLeituras = useCallback(
    async (param?: boolean | number) => {
      const forcarSincronizacao = typeof param === "boolean" ? param : false;
      const page = typeof param === "number" ? param : 1;

      console.log(
        `[DEBUG] carregarLeituras iniciado - forçar: ${forcarSincronizacao}, página: ${page}`
      );

      try {
        if (!refreshing && (page === 1 || leituras.length === 0)) {
          setLoading(true);
        }

        setError("");

        // Carregar dados locais
        let dadosLocaisEncontrados = false;
        if (page === 1) {
          dadosLocaisEncontrados = await carregarDadosLocais();
        }

        // Verificar conexão
        const isConnected = await checkConnection();

        // Apenas sincronizar se forçado explicitamente (pull-to-refresh)
        if (isConnected && forcarSincronizacao && page === 1) {
          await sincronizarDados();
        } else if (page > 1 && leituras.length === 0) {
          setHasMore(false);
        }

        if (typeof param === "number" && leituras.length > 0) {
          setCurrentPage(page);
        }
      } catch (error) {
        console.error("[DEBUG] Erro ao carregar leituras:", error);
        setError("Falha ao carregar as leituras. Verifique sua conexão.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leituras.length, refreshing, sincronizarDados]
  );

  const loadMore = useCallback(() => {
    // Adicionado para debugging
    console.log(
      "[DEBUG] loadMore chamado - hasMore:",
      hasMore,
      "loading:",
      loading,
      "leituras:",
      leituras.length
    );

    // *** CORREÇÃO PRINCIPAL: Não carregue mais se a lista estiver vazia ***
    if (!loading && hasMore && leituras.length > 0) {
      carregarLeituras(currentPage + 1);
    } else if (leituras.length === 0) {
      // Se a lista estiver vazia, desabilitar carregamento adicional
      setHasMore(false);
    }
  }, [loading, hasMore, currentPage, carregarLeituras, leituras.length]);

  useEffect(() => {
    console.log("[DEBUG] useEffect principal iniciado");

    // Verificar migração e inicializar dados
    const inicializar = async () => {
      try {
        // Verificar migração de dados (uma vez só)
        const jaFezMigracao = await AsyncStorage.getItem(
          "leituras_migracao_realizada"
        );
        if (!jaFezMigracao) {
          console.log("[DEBUG] Realizando migração de dados");
          await limparCacheAntigo();
          await AsyncStorage.setItem("leituras_migracao_realizada", "true");
        }

        // Importante: carregar dados locais primeiro
        await carregarDadosLocais();
        // Garantir que loading e refreshing estejam desativados
        setLoading(false);
        setRefreshing(false);
      } catch (error) {
        console.error("[DEBUG] Erro ao inicializar:", error);
        setLoading(false);
      }
    };

    // Inicializar o app
    inicializar();

    // Verificar conexão periodicamente
    const intervalId = setInterval(async () => {
      await checkConnection();
    }, 10000);

    console.log("[DEBUG] useEffect principal configurado");

    return () => {
      console.log("[DEBUG] useEffect principal sendo limpo");
      clearInterval(intervalId);
    };
  }, []);

  // Verificar dados pendentes quando a tela recebe foco
  useFocusEffect(
    React.useCallback(() => {
      console.log(
        "[DEBUG] Tela LeiturasScreen recebeu foco, verificando pendências"
      );
      verificarDadosPendentes();

      // Não precisamos de uma função de limpeza aqui
      return () => {};
    }, [verificarDadosPendentes])
  );

  const onRefresh = async () => {
    // Antes de iniciar o refresh, verificar se há dados pendentes
    try {
      setRefreshing(true);

      // Verificar se existem dados pendentes de upload
      const [pendingSyncsStr, pendingUpdatesStr] = await Promise.all([
        AsyncStorage.getItem("pendingLeiturasSyncs"),
        AsyncStorage.getItem("pendingLeituraUpdates"),
      ]);

      let temDadosPendentes = false;

      // Verificar pendingSyncs
      if (pendingSyncsStr) {
        const pendingSyncs = JSON.parse(pendingSyncsStr);
        if (Object.keys(pendingSyncs).length > 0) {
          temDadosPendentes = true;
        }
      }

      // Verificar pendingUpdates
      if (!temDadosPendentes && pendingUpdatesStr) {
        const pendingUpdates = JSON.parse(pendingUpdatesStr);
        if (Object.keys(pendingUpdates).length > 0) {
          temDadosPendentes = true;
        }
      }

      if (temDadosPendentes) {
        // Há dados pendentes, bloquear o download e avisar o usuário
        Toast.show({
          type: "error", // Alterado de "warning" para "error"
          text1: "Sincronização bloqueada",
          text2:
            "Existem dados pendentes de envio. Por favor, sincronize-os primeiro.",
          position: "top",
          visibilityTime: 3000,
        });

        // Destacar visualmente onde estão os badges de sincronização
        // Atualizar a verificação de dados pendentes para garantir que os badges estejam visíveis
        verificarDadosPendentes();

        setRefreshing(false);
        return;
      }

      // Se não há dados pendentes, prosseguir com o download normal
      carregarLeituras(true); // Parâmetro true força sincronização
    } catch (error) {
      console.error("[ERROR] Erro ao verificar dados pendentes:", error);
      setRefreshing(false);
    }
  };

  const handleCardPress = (leitura: LeituraMensal) => {
    // Recuperar primeiro qualquer dado editado anteriormente para este mês
    AsyncStorage.getItem(FATURAS_STORAGE_KEY)
      .then((storedData) => {
        let faturasParaUsar = leitura.faturas;

        // Se houver dados armazenados, verificar se são do mesmo mês
        if (storedData) {
          const faturasArmazenadas = JSON.parse(storedData);

          // Verificar se os dados armazenados são do mesmo mês selecionado
          if (faturasArmazenadas && faturasArmazenadas.length > 0) {
            const mesmoMes = mesAnoSelecionado === leitura.mesAno;

            // Se for o mesmo mês, usar os dados armazenados (que podem conter edições)
            if (mesmoMes) {
              console.log(
                "[DEBUG] Usando dados armazenados anteriormente para este mês"
              );
              faturasParaUsar = faturasArmazenadas;
            }
          }
        }

        // Salvar no AsyncStorage e navegar
        AsyncStorage.setItem(
          FATURAS_STORAGE_KEY,
          JSON.stringify(faturasParaUsar)
        )
          .then(() => {
            setFaturasSelecionadas(faturasParaUsar);
            setMesAnoSelecionado(leitura.mesAno);
            router.push("/LeiturasDetalhes");
          })
          .catch((error) => {
            console.error(
              "[ERROR] Erro ao salvar faturas no AsyncStorage:",
              error
            );
            // Em caso de erro, continue com a navegação de qualquer forma
            setFaturasSelecionadas(faturasParaUsar);
            setMesAnoSelecionado(leitura.mesAno);
            router.push("/LeiturasDetalhes");
          });
      })
      .catch((error) => {
        console.error("[ERROR] Erro ao ler faturas do AsyncStorage:", error);
        // Em caso de erro, continue normalmente
        AsyncStorage.setItem(
          FATURAS_STORAGE_KEY,
          JSON.stringify(leitura.faturas)
        )
          .then(() => {
            setFaturasSelecionadas(leitura.faturas);
            setMesAnoSelecionado(leitura.mesAno);
            router.push("/LeiturasDetalhes");
          })
          .catch(() => {
            // Último fallback
            setFaturasSelecionadas(leitura.faturas);
            setMesAnoSelecionado(leitura.mesAno);
            router.push("/LeiturasDetalhes");
          });
      });
  };

  const renderFooter = () => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerContainer}>
        {loading ? (
          <ActivityIndicator size="small" color="#2a9d8f" />
        ) : (
          <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
            <Text style={styles.loadMoreText}>Carregar mais</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const EmptyListComponent = React.memo(() => {
    const handleRetry = useCallback(() => {
      // Forçar sincronização
      carregarLeituras(true);
    }, []);

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma leitura encontrada</Text>
        <TouchableOpacity style={styles.reloadButton} onPress={handleRetry}>
          <Text style={styles.reloadButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  });
  return (
    <SafeAreaView style={styles.container}>
      {/* Indicador de modo offline */}
      {isOffline && (
        <View style={styles.offlineBar}>
          <Ionicons name="cloud-offline" size={18} color="#fff" />
          <Text style={styles.offlineText}>Modo offline</Text>
        </View>
      )}

      {/* Mensagem de erro, caso exista */}
      {error ? <ErrorMessage error={error} visible={!!error} /> : null}

      {/* Conteúdo principal */}
      {loading && !refreshing && leituras.length === 0 ? (
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
              dataCriacao={item.dataCriacao}
              faturas={item.faturas}
              onPress={() => handleCardPress(item)}
              isAllFechada={item.isAllFechada}
              temDadosPendentes={mesesComDadosPendentes[item.mesAno] || false}
              onSincronizar={() => sincronizarMes(item.mesAno)}
              volumePositivo={calcularVolumePositivo(item.faturas)}
              temConsumosNegativos={verificarConsumosNegativos(item.faturas)}
            />
          )}
          onEndReached={leituras.length > 0 ? loadMore : undefined}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2a9d8f"]}
            />
          }
          ListFooterComponent={
            <>
              {renderFooter()}
              {lastSyncTime && (
                <View style={styles.syncInfo}>
                  <Text style={styles.syncText}>
                    Última sincronização:{" "}
                    {new Date(lastSyncTime).toLocaleString()}
                  </Text>
                </View>
              )}
            </>
          }
          onEndReachedThreshold={0.5}
        />
      )}
      {/* Modal de progresso da sincronização */}
      <SyncProgressModal
        visible={syncModalVisible}
        title="Sincronizando Dados"
        message={syncMessage}
        progress={syncProgress}
        itemsProcessed={syncItemsProcessed}
        totalItems={syncTotalItems}
        // Dados de progresso para imagens (processo secundário)
        secondaryProgress={imgSyncProgress}
        secondaryMessage={imgSyncMessage}
        secondaryItemsProcessed={imgSyncItemsProcessed}
        secondaryTotalItems={imgSyncTotalItems}
        onCancel={() => {
          // Chamar função para cancelar a sincronização
          cancelSync();
        }}
        type="upload"
        allowCancel={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginBottom: 16,
  },
  reloadButton: {
    backgroundColor: "#2a9d8f",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 5,
  },
  reloadButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  footerContainer: {
    padding: 16,
    alignItems: "center",
  },
  loadMoreButton: {
    backgroundColor: "#2a9d8f",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  loadMoreText: {
    color: "white",
    fontWeight: "bold",
  },
  offlineBar: {
    backgroundColor: "#ff6b6b",
    padding: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  offlineText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
  },
  syncInfo: {
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  syncText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
});

export default LeiturasScreen;
