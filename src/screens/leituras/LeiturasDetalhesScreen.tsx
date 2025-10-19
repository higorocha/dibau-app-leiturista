// src/screens/leituras/LeiturasDetalhesScreen.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TextInput,
  Animated,
  NativeModules,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLeiturasContext } from "../../contexts/LeiturasContext";
import api from "../../api/axiosConfig";
import MaskedNumberInput from "../../components/inputs/MaskedNumberInput";
import { formatarNumeroComMilhar, formatarData } from "../../utils/formatters";
import { useTheme } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import DatePicker from "react-native-date-picker";
import ImagemLeituraModal from "../../components/leituras/ImagemLeituraModal";
import ImagemLeituraService from "../../services/ImagemLeituraService";
import HighPerformanceInput, { HighPerformanceInputRef } from "@/src/components/inputs/HighPerformanceInput";
import { database } from "../../database";
import { Q } from "@nozbe/watermelondb";
import Leitura from "../../database/models/Leitura";
import Observacao from "../../database/models/Observacao";
import ObservacaoModal from "../../components/ObservacaoModal";

const FATURAS_STORAGE_KEY = "leituras_faturas_selecionadas";

// Interface para Fatura
interface Fatura {
  id: number;
  id_hidrometro: number;
  valor_leitura_m3: number;
  leitura_anterior: number;
  data_leitura_anterior: string;
  fechada: string;
  status: string;
  Hidrometro: {
    id: number;
    codHidrometro: string;
    modelo: string;
    registro_atual: number;
    x10: boolean;
  };
  LoteAgricola: {
    id: number;
    nomeLote: string;
    situacao?: string; // "Operacional" ou "Abandonado"
    mapa_leitura?: number; // Número do mapa de leitura
  };
  Cliente: {
    id: number;
    nome: string;
  };
  Leitura?: {
    id?: number; // ✅ ID da leitura no servidor
    leitura: number;
    data_leitura: string;
  };
}

// Tipos de ordenação
type OrdenacaoTipo = "original" | "leitura";

// Tipos de filtro
type FiltroTipo = "todos" | "lidos" | "naoLidos" | "negativos";

// Interface para props do FaturaItem
interface FaturaItemProps {
  item: Fatura;
  index: number;
  isTablet: boolean;
  handleEdit: (faturaId: number) => void;
  handleSave: (fatura: Fatura, leituraValor: string) => Promise<void>;
  handleCancel: () => void;
  editingId: number | null;
  leituraAtuais: { [key: number]: string };
  setLeituraAtuais: React.Dispatch<
    React.SetStateAction<{ [key: number]: string }>
  >;
  dataLeituraAtuais: { [key: number]: Date };
  showDatepicker: (faturaId: number) => void;
  showDatePicker: { [key: number]: boolean };
  onDateChange: (
    event: DateTimePickerEvent,
    selectedDate: Date | undefined,
    faturaId: number
  ) => void;
  salvando: { [key: number]: boolean };
  leiturasSalvas: { [key: number]: boolean };
  leiturasNaoTransmitidas: { [key: number]: boolean };
  formatarNumeroComMilhar: (value: number | string | undefined) => string;
  formatarData: (data: string | Date | undefined) => string;
  faturasComImagem: { [key: number]: boolean };
  handleOpenImagemModal: (faturaId: number) => void;
  observacoesVigentes: { [key: number]: number };
  handleOpenObservacoesModal: (loteId: number, loteNome?: string) => void;
}

// Componente memoizado para renderizar cada item da fatura
const FaturaItem = memo<FaturaItemProps>(
  ({
    item,
    index,
    isTablet,
    handleEdit,
    handleSave,
    handleCancel,
    editingId,
    leituraAtuais,
    setLeituraAtuais,
    dataLeituraAtuais,
    showDatepicker,
    showDatePicker,
    onDateChange,
    salvando,
    leiturasSalvas,
    leiturasNaoTransmitidas,
    formatarNumeroComMilhar,
    formatarData,
    faturasComImagem,
    handleOpenImagemModal,
    observacoesVigentes,
    handleOpenObservacoesModal,
  }) => {
    const isEditing = editingId === item.id;
    const isSaving = salvando[item.id] || false;
    const isDisabled = item.fechada === "Sim";
    const isAbandonado = item.LoteAgricola?.situacao === "Abandonado"; // ✅ NOVO: Verificar se lote está abandonado
    // ✅ CORREÇÃO: Calcular diretamente da prop item, não do estado
    // Isso elimina o "flash" visual ao carregar a tela
    const foiEditada = !!(item.Leitura?.leitura && item.Leitura.leitura > 0) || leiturasSalvas[item.id];
    const isLeftColumn = index % 2 === 0;
    const inputRef = useRef<HighPerformanceInputRef>(null);

    return (
      <View
        style={[
          styles.card,
          isTablet && {
            width: "48%",
            marginRight: isLeftColumn ? "1%" : 0,
            marginLeft: !isLeftColumn ? "1%" : 0,
          },
          isAbandonado && styles.cardAbandonado, // ✅ NOVO: Estilo para lote abandonado
          !isAbandonado && !!foiEditada && styles.cardLido,
          !isAbandonado && !foiEditada && !isDisabled && styles.cardNaoLido,
        ]}
      >
        {/* Cabeçalho do Card - Lote e Cliente */}
        <View style={styles.cardHeader}>
          <View style={styles.loteContainer}>
            <Ionicons 
              name={isAbandonado ? "close-circle-outline" : "map-outline"} 
              size={20} 
              color={isAbandonado ? "#999" : "#2a9d8f"} 
            />
            <Text
              style={[
                styles.loteText, 
                isTablet && { fontSize: 16 },
                isAbandonado && styles.textAbandonado
              ]}
              numberOfLines={1}
            >
              {item.LoteAgricola?.nomeLote || 'Lote não identificado'} - {item.Cliente?.nome?.toUpperCase() || 'CLIENTE NÃO IDENTIFICADO'}
            </Text>
          </View>
        </View>

        {/* Informações gerais */}
        <View style={styles.cardInfo}>
          <View style={styles.infoColumn}>
            <View style={styles.infoGroup}>
              <Ionicons name="water-outline" size={16} color="#2a9d8f" />
              <Text style={[styles.infoText, isTablet && { fontSize: 14 }]}>
                Hidrômetro {item.Hidrometro?.codHidrometro || 'N/D'}
              </Text>
            </View>

            <View style={styles.infoGroup}>
              <Ionicons name="analytics-outline" size={16} color="#666" />
              <Text style={[styles.infoText, isTablet && { fontSize: 14 }]}>
                Leitura Anterior:{" "}
                {formatarNumeroComMilhar(item.leitura_anterior || 0) || "0"}{" "}
                m³
                {item.data_leitura_anterior ? (
                  <Text style={[styles.infoText, isTablet && { fontSize: 14 }]}>
                    {" em "}
                    {formatarData(item.data_leitura_anterior) || ""}
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>

          <View style={styles.infoColumn}>
            {!!foiEditada && (
              <View style={styles.editedIconContainer}>
                {leiturasNaoTransmitidas[item.id] ? (
                  // Lida mas não transmitida = relógio amarelo
                  <Ionicons name="time-outline" size={16} color="#ffd700" />
                ) : (
                  // Lida e transmitida = checkmark verde
                  <Ionicons name="checkmark-circle" size={16} color="#2a9d8f" />
                )}
              </View>
            )}
          </View>
        </View>

        {/* Valores de Leitura */}
        <View style={styles.readingsContainer}>
          {/* Leitura Atual */}
          <View style={[styles.readingBlock, styles.highlightedReadingBlock]}>
            <Text style={[styles.readingLabel, isTablet && { fontSize: 13 }]}>
              Leitura Atual
            </Text>
            {isEditing ? (
  <View>
    <HighPerformanceInput
      ref={inputRef}
      style={styles.input}
      placeholder="Informe a leitura"
      keyboardType="numeric"
      // Não usamos value ou defaultValue para controlar
      // Não usamos onChangeText para evitar qualquer re-renderização
      autoCapitalize="none"
      autoCorrect={false}
    />
    {item.Hidrometro?.x10 === true && (
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
      }}>
        <Text style={styles.multiplicadorText}>
          * Valor será multiplicado por 10 automaticamente
        </Text>
      </View>
    )}
  </View>
) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[styles.readingValue, isTablet && { fontSize: 15 }]}
                >
                  {item.Leitura && item.Leitura.leitura
                    ? `${formatarNumeroComMilhar(item.Leitura.leitura) || "0"} m³`
                    : "-"}
                </Text>
                {item.Hidrometro?.x10 === true && (
                  <View style={styles.x10Badge}>
                    <Text style={styles.x10BadgeText}>x10</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Data Leitura Atual */}
          <View style={[styles.readingBlock, styles.highlightedReadingBlock]}>
            <Text style={[styles.readingLabel, isTablet && { fontSize: 13 }]}>
              Data Atual
            </Text>
            {isEditing ? (
              <View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => showDatepicker(item.id)}
                >
                  <Text
                    style={[
                      styles.dateButtonText,
                      isTablet && { fontSize: 14 },
                    ]}
                  >
                    {formatarData(dataLeituraAtuais[item.id]) || "Selecione"}
                  </Text>
                  <Ionicons name="calendar" size={16} color="#2a9d8f" />
                </TouchableOpacity>

                {showDatePicker[item.id] && (
                  <DateTimePicker
                    value={dataLeituraAtuais[item.id]}
                    mode="date"
                    display="default"
                    onChange={(event, date) =>
                      onDateChange(event, date, item.id)
                    }
                    maximumDate={new Date()}
                    locale="pt-BR"
                  />
                )}
              </View>
            ) : (
              <Text style={[styles.readingValue, isTablet && { fontSize: 15 }]}>
                {dataLeituraAtuais[item.id]
                  ? formatarData(dataLeituraAtuais[item.id]) || "-"
                  : item.Leitura && item.Leitura.data_leitura
                  ? formatarData(item.Leitura.data_leitura) || "-"
                  : "-"}
              </Text>
            )}
          </View>
        </View>

        {/* Rodapé com Botões de Ação */}
        <View style={styles.cardFooter}>
          {isAbandonado ? (
            // ✅ ABANDONADO: Permite apenas observações
            <View style={styles.abandonadoMessageContainer}>
              <View style={styles.abandonadoBadge}>
                <Text style={styles.abandonadoBadgeText}>ABANDONADO</Text>
              </View>
              <View style={styles.abandonadoMessage}>
                <Ionicons name="information-circle" size={18} color="#999" />
                <Text style={styles.abandonadoMessageText}>
                  Leituras bloqueadas - Use observações para registrar informações
                </Text>
              </View>
              {/* Botão de Observações para lotes abandonados */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: observacoesVigentes[item.LoteAgricola.id] > 0
                      ? "#faad14" // Laranja (com observações)
                      : "#52c41a", // Verde (sem observações)
                    width: '100%',
                    marginTop: 8,
                    position: 'relative',
                  },
                ]}
                onPress={() => {
                  handleOpenObservacoesModal(item.LoteAgricola.id, item.LoteAgricola.nomeLote);
                }}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={[styles.buttonText, isTablet && { fontSize: 14 }]}>
                  Observações sobre o lote
                </Text>
                {observacoesVigentes[item.LoteAgricola.id] > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: '#ff4d4f',
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}>
                    <Text style={{
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}>
                      {observacoesVigentes[item.LoteAgricola.id]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : isEditing ? (
            // Modo Edição: Botões Salvar e Cancelar
            <>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  // Obter o valor diretamente da referência do input
                  const inputValue = inputRef.current?.getValue() || "";
                  handleSave(item, inputValue);
                }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text
                      style={[styles.buttonText, isTablet && { fontSize: 14 }]}
                    >
                      Salvar
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                <Text style={[styles.buttonText, isTablet && { fontSize: 14 }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </>
          ) : !isAbandonado ? (
            // Modo Visualização: Botão Editar (só se não for abandonado)
            <View style={styles.footerButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.editButton,
                  {
                    opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: !!foiEditada ? "#4d9792" : "#1890ff",
                    flex: 1,
                  },
                ]}
                onPress={() => handleEdit(item.id)}
                disabled={isDisabled}
              >
                <Ionicons
                  name={!!foiEditada ? "create-outline" : "create"}
                  size={18}
                  color="#fff"
                />
                <Text style={[styles.buttonText, isTablet && { fontSize: 14 }]}>
                  {isDisabled
                    ? "Fatura Fechada"
                    : !!foiEditada
                    ? "Reeditar"
                    : "Editar"}
                </Text>
              </TouchableOpacity>

              {/* Botão de câmera */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: !!faturasComImagem[item.id]
                      ? "#7c4d97"
                      : "#4d97a3",
                    flex: 1,
                  },
                ]}
                onPress={() => handleOpenImagemModal(item.id)}
                disabled={isDisabled}
              >
                <Ionicons
                  name={
                    !!faturasComImagem[item.id]
                      ? "image-outline"
                      : "camera-outline"
                  }
                  size={18}
                  color="#fff"
                />
                <Text style={[styles.buttonText, isTablet && { fontSize: 14 }]}>
                  {!!faturasComImagem[item.id] ? "Ver Imagem" : "Câmera"}
                </Text>
              </TouchableOpacity>

              {/* Botão de observações */}
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: observacoesVigentes[item.LoteAgricola.id] > 0
                      ? "#faad14"
                      : "#52c41a",
                    flex: 1,
                    position: 'relative',
                  },
                ]}
                onPress={() => {
                  console.log(`[BOTAO] item.LoteAgricola:`, item.LoteAgricola);
                  console.log(`[BOTAO] item.LoteAgricola.id:`, item.LoteAgricola.id);
                  handleOpenObservacoesModal(item.LoteAgricola.id, item.LoteAgricola.nomeLote);
                }}
                disabled={isDisabled}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={[styles.buttonText, isTablet && { fontSize: 14 }]}>
                  Observações
                </Text>
                {observacoesVigentes[item.LoteAgricola.id] > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    backgroundColor: '#ff4d4f',
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}>
                    <Text style={{
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 'bold',
                    }}>
                      {observacoesVigentes[item.LoteAgricola.id]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Status Badge */}
        {item.status === "Paga" && (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={[styles.statusText, isTablet && { fontSize: 12 }]}>
              Paga
            </Text>
          </View>
        )}
        {item.status === "Vencida" && (
          <View style={[styles.statusBadge, styles.statusVencida]}>
            <Ionicons name="alert-circle" size={16} color="#fff" />
            <Text style={[styles.statusText, isTablet && { fontSize: 12 }]}>
              Vencida
            </Text>
          </View>
        )}
      </View>
    );
  }
);

const LeiturasDetalhesScreen: React.FC = () => {
  const { colors } = useTheme();

  useEffect(() => {
    // Configuração do idioma do DateTimePicker para o Android
    if (Platform.OS === "android") {
      // Garantir que o locale padrão do aplicativo seja pt-BR
      if (NativeModules.I18nManager) {
        NativeModules.I18nManager.allowRTL(false);
        NativeModules.I18nManager.forceRTL(false);
      }
    }
  }, []);

  // Estado para dimensões da tela
  const [dimensions, setDimensions] = useState(() => {
    return Dimensions.get("window");
  });

  // Detectar tablet baseado nas dimensões - AJUSTADO para 550dp
  const smallerDimension = Math.min(dimensions.width, dimensions.height);
  const largerDimension = Math.max(dimensions.width, dimensions.height);
  const isTablet = smallerDimension >= 550 || largerDimension >= 900;

  // Listener para mudanças de dimensão (rotação de tela)
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  // Obtendo os dados do contexto
  const {
    faturasSelecionadas,
    mesAnoSelecionado,
    setFaturasSelecionadas,
    atualizarFaturaLocal,
  } = useLeiturasContext();

  // Log para debug durante desenvolvimento - pode ser removido em produção
  // console.log(`[DETALHES] Componente montado - mesAnoSelecionado: '${mesAnoSelecionado}', faturas: ${faturasSelecionadas?.length || 0}`);

  // Estados para edição e status
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [leituraAtuais, setLeituraAtuais] = useState<{ [key: number]: string }>(
    {}
  );
  const [dataLeituraAtuais, setDataLeituraAtuais] = useState<{
    [key: number]: Date;
  }>({});
  const [showDatePicker, setShowDatePicker] = useState<{
    [key: number]: boolean;
  }>({});
  const [salvando, setSalvando] = useState<{ [key: number]: boolean }>({});
  const [valoresOriginais, setValoresOriginais] = useState<{
    [key: number]: string;
  }>({});
  const [leiturasSalvas, setLeiturasSalvas] = useState<{
    [key: number]: boolean;
  }>({});
  const [leiturasNaoTransmitidas, setLeiturasNaoTransmitidas] = useState<{
    [key: number]: boolean;
  }>({});

  // Refs e estados de UI
  const flatListRef = useRef<FlatList>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filteredFaturas, setFilteredFaturas] = useState<Fatura[]>([]);

  // Estados para filtros e ordenação
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTipo>("original");
  const [filtro, setFiltro] = useState<FiltroTipo>("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [setoresSelecionados, setSetoresSelecionados] = useState<number[]>([]);

  // Estados para gerenciar modal de imagem
  const [showImagemModal, setShowImagemModal] = useState(false);
  const [selectedFaturaIdForImage, setSelectedFaturaIdForImage] = useState<
    number | null
  >(null);
  const [selectedLeituraIdForImage, setSelectedLeituraIdForImage] = useState<
    number | null
  >(null);
  
  // ✅ SOLUÇÃO DEFINITIVA: useMemo calcula DURANTE o render (sem delay)
  const faturasComImagem = useMemo(() => {
    const imagensStatus: { [key: number]: boolean } = {};
    faturasSelecionadas.forEach(fatura => {
      // Verifica se tem imagem (instantâneo - apenas leitura de propriedade)
      imagensStatus[fatura.id] = !!fatura.Leitura?.imagem_leitura;
    });
    return imagensStatus;
  }, [faturasSelecionadas]);

  // Estados para gerenciar modal de observações
  const [showObservacoesModal, setShowObservacoesModal] = useState(false);
  const [selectedLoteForObservacoes, setSelectedLoteForObservacoes] = useState<number | null>(null);
  const [selectedLoteNome, setSelectedLoteNome] = useState<string>(''); // ✅ Nome do lote selecionado
  const [observacoesVigentes, setObservacoesVigentes] = useState<{
    [key: number]: number; // loteId -> quantidade de observações vigentes
  }>({});

  // Estados para animação e scroll
  const [scrollY, setScrollY] = useState(0);
  const scrollYValue = useRef(new Animated.Value(0)).current;
  const [showTopFab, setShowTopFab] = useState(false);
  const filterAnimation = useRef(new Animated.Value(0)).current;

  // Contadores para estatísticas
  const totalFaturas = faturasSelecionadas.length;
  const totalLidas = Object.values(leiturasSalvas).filter(Boolean).length;
  const faltamLer = totalFaturas - totalLidas;

  /**
   * Verificar quais faturas têm leituras não transmitidas (syncStatus = 'local_edited')
   */
  const verificarLeiturasNaoTransmitidas = async () => {
    try {
      const leiturasCollection = database.get('leituras');
      const leiturasEditadas = await leiturasCollection
        .query(Q.where('sync_status', 'local_edited'))
        .fetch();
      
      const naoTransmitidasMap: { [key: number]: boolean } = {};
      leiturasEditadas.forEach((leitura: any) => {
        naoTransmitidasMap[leitura.serverId] = true;
      });
      
      setLeiturasNaoTransmitidas(naoTransmitidasMap);
    } catch (error) {
      console.error('[SYNC STATUS] Erro ao verificar status:', error);
    }
  };

  /**
   * Verificar observações vigentes para cada lote das faturas
   */
  const verificarObservacoesVigentes = async () => {
    try {
      const observacoesCollection = database.get('observacoes');
      
      // Buscar observações vigentes
      const observacoesVigentesData = await observacoesCollection
        .query(Q.where('status', 'vigente'))
        .fetch();
      
      // Agrupar por lote_id e contar
      const observacoesMap: { [key: number]: number } = {};
      observacoesVigentesData.forEach((observacao: any) => {
        const loteId = observacao.loteId;
        observacoesMap[loteId] = (observacoesMap[loteId] || 0) + 1;
      });
      
      setObservacoesVigentes(observacoesMap);
    } catch (error) {
      console.error('Erro ao verificar observações vigentes:', error);
    }
  };

  /**
   * Abrir modal de observações para um lote específico
   */
  const handleOpenObservacoesModal = (loteId: number, loteNome?: string) => {
    console.log(`[LeiturasDetalhes] Abrindo modal de observações para lote ID: ${loteId}, Nome: ${loteNome}`);
    setSelectedLoteForObservacoes(loteId);
    setSelectedLoteNome(loteNome || `Lote ${loteId}`);
    setShowObservacoesModal(true);
    console.log(`[LeiturasDetalhes] Estado atualizado - showObservacoesModal: true, selectedLote: ${loteId}, nome: ${loteNome}`);
  };

  /**
   * Carregar faturas fechadas específicas da API
   */
  const carregarFaturasFechadasDaAPI = async (mesAno: string) => {
    try {
      setLoading(true);

      // Fazer chamada à API
      const response = await api.get('/faturamensal/app/leituras');
      
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Erro na resposta da API');
      }

      const faturasMeses = response.data.data || [];
      
      // Filtrar pelo mês/ano específico
      const faturaMesEspecifico = faturasMeses.find((f: any) => f.mesAno === mesAno);
      
      if (!faturaMesEspecifico) {
        throw new Error(`Dados não encontrados para ${mesAno}`);
      }

      if (!faturaMesEspecifico.faturas || !Array.isArray(faturaMesEspecifico.faturas)) {
        throw new Error(`Faturas não encontradas para ${mesAno}`);
      }

      const faturasDetalhadas = faturaMesEspecifico.faturas;

      // Atualizar AsyncStorage com os dados detalhados
      await AsyncStorage.setItem(FATURAS_STORAGE_KEY, JSON.stringify(faturasDetalhadas));

      // Atualizar estado do contexto
      setFaturasSelecionadas(faturasDetalhadas);

      // Inicializar estados locais
      const leiturasAtuaisTmp: { [key: number]: string } = {};
      const datasLeiturasTmp: { [key: number]: Date } = {};
      const leiturasEditadasTmp: { [key: number]: boolean } = {};

      faturasDetalhadas.forEach((fatura: Fatura) => {
        if (fatura.Leitura) {
          leiturasAtuaisTmp[fatura.id] = fatura.Leitura.leitura?.toString() || "";
          
          // ✅ CORREÇÃO: Só setar data se conseguir fazer parse válido
          // Se houver erro, não setar data (deixar mostrar "-")
          if (fatura.Leitura.data_leitura) {
            try {
              // ✅ CORREÇÃO FUSO HORÁRIO: Adicionar T00:00:00 para interpretar como horário local
              datasLeiturasTmp[fatura.id] = new Date(fatura.Leitura.data_leitura + "T00:00:00");
            } catch (e) {
              console.warn(`Erro ao parsear data da leitura ${fatura.id}:`, e);
              // Não setar data em caso de erro no parse
            }
          }

          if (fatura.Leitura.leitura && fatura.Leitura.leitura > 0) {
            leiturasEditadasTmp[fatura.id] = true;
          }
        }
      });

      setLeituraAtuais(leiturasAtuaisTmp);
      setDataLeituraAtuais(datasLeiturasTmp);
      setLeiturasSalvas(leiturasEditadasTmp);
      
      // Verificar status de sincronização no WatermelonDB
      await verificarLeiturasNaoTransmitidas();
      
      // Verificar observações vigentes
      await verificarObservacoesVigentes();

    } catch (error: any) {
      console.error(`[API] ❌ Erro ao carregar faturas fechadas:`, error);
      Alert.alert(
        'Erro',
        `Não foi possível carregar os dados de ${mesAno}. ${error.message || 'Tente novamente.'}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados da fatura selecionada
  // CORREÇÃO: Usar useFocusEffect para executar sempre que a tela recebe foco
  useFocusEffect(
    useCallback(() => {
      // Só executar se mesAnoSelecionado tiver valor
      if (!mesAnoSelecionado) {
        return;
      }

      const carregarFaturasEditadas = async () => {
        try {
          const faturasStorage = await AsyncStorage.getItem(FATURAS_STORAGE_KEY);

          if (faturasStorage) {
            const faturasArmazenadas = JSON.parse(faturasStorage) as Fatura[];

            // Verificar se é fatura fechada que precisa ser carregada da API
            if (faturasArmazenadas && faturasArmazenadas.length === 0) {
              const netInfo = await NetInfo.fetch();
              if (netInfo.isConnected && mesAnoSelecionado) {
                await carregarFaturasFechadasDaAPI(mesAnoSelecionado);
                return;
              }
            }

            // Carregar dados do AsyncStorage (já vêm do WatermelonDB via LeiturasScreen)
            if (faturasArmazenadas && faturasArmazenadas.length > 0) {
              setFaturasSelecionadas(faturasArmazenadas);

              const leiturasAtuaisTmp: { [key: number]: string } = {};
              const datasLeiturasTmp: { [key: number]: Date } = {};
              const leiturasEditadasTmp: { [key: number]: boolean } = {};

              faturasArmazenadas.forEach((fatura: Fatura) => {
                if (fatura.Leitura) {
                  leiturasAtuaisTmp[fatura.id] = fatura.Leitura.leitura?.toString() || "";
                  // ✅ CORREÇÃO: Só setar data se conseguir fazer parse válido
                  // Se houver erro, não setar data (deixar mostrar "-")
                  if (fatura.Leitura.data_leitura) {
                    try {
                      // ✅ CORREÇÃO FUSO HORÁRIO: Adicionar T00:00:00 para interpretar como horário local
                      datasLeiturasTmp[fatura.id] = new Date(fatura.Leitura.data_leitura + "T00:00:00");
                    } catch (e) {
                      console.warn(`Erro ao parsear data da leitura ${fatura.id}:`, e);
                      // Não setar data em caso de erro no parse
                    }
                  }
                  if (fatura.Leitura.leitura && fatura.Leitura.leitura > 0) {
                    leiturasEditadasTmp[fatura.id] = true;
                  }
                }
              });

              setLeituraAtuais(leiturasAtuaisTmp);
              setDataLeituraAtuais(datasLeiturasTmp);
              setLeiturasSalvas(leiturasEditadasTmp);
              
              // Verificar status de sincronização no WatermelonDB
              await verificarLeiturasNaoTransmitidas();
              
              // Verificar observações vigentes
              await verificarObservacoesVigentes();
            }
          } else {
            // AsyncStorage vazio - tentar carregar fatura fechada da API
            const netInfo = await NetInfo.fetch();
            if (netInfo.isConnected && mesAnoSelecionado) {
              await carregarFaturasFechadasDaAPI(mesAnoSelecionado);
            }
          }
        } catch (error) {
          console.error("Erro ao carregar faturas:", error);
        }
      };

      carregarFaturasEditadas();

      // ✅ CLEANUP: Resetar estado de edição quando sair da tela
      return () => {
        setEditingId(null);
      };
    }, [mesAnoSelecionado]) // ✅ CORREÇÃO: Executa sempre que a tela recebe foco
  );

  // Animação do painel de filtros
  useEffect(() => {
    Animated.timing(filterAnimation, {
      toValue: showFilters ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showFilters, filterAnimation]);

  // ✅ Altura dinâmica baseada em tablet/smartphone (ajustada para 3 seções)
  const filterPanelHeight = filterAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isTablet ? 220 : 280], // Mais altura para acomodar seção de setores
  });

  // Inicializar os estados com os dados existentes
  useEffect(() => {
    const leituras: { [key: number]: string } = {};
    const datas: { [key: number]: Date } = {};
    const editados: { [key: number]: boolean } = {};

    faturasSelecionadas.forEach((fatura) => {
      leituras[fatura.id] = fatura.Leitura?.leitura
        ? fatura.Leitura.leitura.toString()
        : "";

      // ✅ CORREÇÃO: Só setar data se realmente tem leitura ou data replicada
      // Não setar data padrão para leituras não informadas
      if (fatura.Leitura?.leitura && fatura.Leitura?.leitura > 0) {
        datas[fatura.id] = new Date(fatura.Leitura.data_leitura + "T00:00:00");
      } else if (dataLeituraAtuais[fatura.id]) {
        // Se já tem uma data setada (replicada), mantém essa data
        datas[fatura.id] = dataLeituraAtuais[fatura.id];
      }
      // ✅ Se não tem leitura nem data replicada, NÃO adiciona ao objeto datas
      // Isso faz com que o campo mostre "-" desde o início

      // Verificar se a leitura tem valor atual (foi editada)
      editados[fatura.id] =
        fatura.valor_leitura_m3 &&
        parseFloat(fatura.valor_leitura_m3.toString()) > 0;
    });

    setLeituraAtuais(leituras);
    setDataLeituraAtuais((prev) => ({ ...prev, ...datas })); // Mescla com as datas anteriores
    setLeiturasSalvas(editados);
    
    // Verificar status de sincronização no WatermelonDB
    verificarLeiturasNaoTransmitidas();
    
    // Verificar observações vigentes
    verificarObservacoesVigentes();
    
    aplicarFiltroEOrdenacao(
      faturasSelecionadas,
      filtro,
      ordenacao,
      searchText,
      editados,
      setoresSelecionados
    );

    // Verificar conexão
    const checkConnection = async () => {
      const netInfo = await NetInfo.fetch();
      setIsOffline(!netInfo.isConnected);
    };

    checkConnection();


    // Verificar conexão periodicamente
    const intervalId = setInterval(checkConnection, 10000);
    return () => clearInterval(intervalId);
  }, [faturasSelecionadas]);

  // Função auxiliar para extrair o setor do nome do lote
  // Padrão: PREFIXO/SETOR/SUFIXO (ex: "C7/2/B1" -> setor 2)
  const extrairSetor = (nomeLote: string): number | null => {
    const partes = nomeLote.split('/');
    if (partes.length >= 2) {
      const setor = parseInt(partes[1], 10);
      return isNaN(setor) ? null : setor;
    }
    return null;
  };

  // Função para aplicar filtro e ordenação às faturas
  const aplicarFiltroEOrdenacao = useCallback(
    (
      faturas: Fatura[],
      filtroAtual: FiltroTipo,
      ordenacaoAtual: OrdenacaoTipo,
      termo: string,
      statusLeituras: { [key: number]: boolean },
      setores: number[]
    ) => {
      // Primeiro, aplicar filtro de texto (busca)
      let resultado = termo
        ? faturas.filter(
            (fatura) =>
              fatura.LoteAgricola.nomeLote
                .toLowerCase()
                .includes(termo.toLowerCase()) ||
              fatura.Cliente.nome.toLowerCase().includes(termo.toLowerCase())
          )
        : [...faturas];

      // Aplicar filtro por status (todos/lidos/não lidos)
      if (filtroAtual === "lidos") {
        resultado = resultado.filter(
          (fatura) => statusLeituras[fatura.id] === true
        );
      } else if (filtroAtual === "naoLidos") {
        resultado = resultado.filter(
          (fatura) => statusLeituras[fatura.id] !== true
        );
      } else if (filtroAtual === "negativos") {
        // Novo caso para filtro de valores negativos
        resultado = resultado.filter((fatura) => fatura.valor_leitura_m3 < 0);
      }

      // Aplicar filtro por setores (se algum setor estiver selecionado)
      if (setores.length > 0) {
        resultado = resultado.filter((fatura) => {
          const setor = extrairSetor(fatura.LoteAgricola.nomeLote);
          return setor !== null && setores.includes(setor);
        });
      }

      // Aplicar ordenação
      if (ordenacaoAtual === "leitura") {
        // Coloca faturas não lidas primeiro, depois as lidas
        resultado.sort((a, b) => {
          const aLido = statusLeituras[a.id] === true;
          const bLido = statusLeituras[b.id] === true;

          if (aLido && !bLido) return 1;
          if (!aLido && bLido) return -1;

          // Manter a ordem original dentro de cada grupo
          return faturas.indexOf(a) - faturas.indexOf(b);
        });
      }
      // Para 'original', mantém a ordem do array original (ordenação padrão da API)

      setFilteredFaturas(resultado);
    },
    []
  );

  // Efeito para atualizar a lista quando filtro, ordenação, busca ou setores mudam
  useEffect(() => {
    aplicarFiltroEOrdenacao(
      faturasSelecionadas,
      filtro,
      ordenacao,
      searchText,
      leiturasSalvas,
      setoresSelecionados
    );
  }, [filtro, ordenacao, searchText, leiturasSalvas, setoresSelecionados, aplicarFiltroEOrdenacao]);

  // Listener de rolagem para exibir/ocultar o FAB de voltar ao topo
  useEffect(() => {
    const listenerId = scrollYValue.addListener(({ value }) => {
      setScrollY(value);
      setShowTopFab(value > 100);
    });

    return () => {
      scrollYValue.removeListener(listenerId);
    };
  }, [scrollYValue]);

  // ✅ Verificação de imagens agora usa useMemo (calcula durante render - zero delay)

  const handleEdit = (faturaId: number) => {
    setEditingId(faturaId);

    // Armazenar o valor original para uso posterior em caso de cancelamento
    const fatura = faturasSelecionadas.find((f) => f.id === faturaId);
    if (fatura) {
      setValoresOriginais((prev) => ({
        ...prev,
        [faturaId]: fatura.Leitura?.leitura.toString() || "",
      }));

      setLeituraAtuais((prev) => ({
        ...prev,
        [faturaId]: "",
      }));

      // Sempre atualizar a data apenas para a fatura que está sendo editada
      setDataLeituraAtuais((prev) => {
        const novasDatas = { ...prev };

        // Se a fatura tem leitura, usa a data da leitura
        if (fatura.Leitura?.leitura && fatura.Leitura?.leitura > 0) {
          novasDatas[faturaId] = new Date(
            fatura.Leitura.data_leitura + "T00:00:00"
          );
        }
        // Se não tem leitura, mas já tem uma data setada (replicada), mantém essa data
        else if (prev[faturaId]) {
          novasDatas[faturaId] = prev[faturaId];
        }
        // Caso contrário, usa a data atual
        else {
          novasDatas[faturaId] = new Date();
        }

        return novasDatas;
      });
    }
  };

  const handleCancel = () => {
    if (editingId) {
      // Restaurar valor original
      setLeituraAtuais((prev) => ({
        ...prev,
        [editingId]: valoresOriginais[editingId] || "",
      }));
    }
    setEditingId(null);
  };

  const showDatepicker = (faturaId: number) => {
    setShowDatePicker((prev) => ({
      ...prev,
      [faturaId]: true,
    }));
  };

  const onDateChange = (
    event: DateTimePickerEvent,
    selectedDate: Date | undefined,
    faturaId: number
  ) => {
    setShowDatePicker((prev) => ({
      ...prev,
      [faturaId]: false,
    }));

    if (selectedDate) {
      const faturaEditando = faturasSelecionadas.find((f) => f.id === faturaId);

      // Só replicate se a fatura sendo editada NÃO tem leitura
      const deveReplicar =
        faturaEditando &&
        (!faturaEditando.Leitura || !faturaEditando.Leitura.leitura);

      setDataLeituraAtuais((prev) => {
        const novasDatas = { ...prev, [faturaId]: selectedDate };

        if (deveReplicar) {
          faturasSelecionadas.forEach((fatura) => {
            // Só replique para faturas sem leitura informada (exceto a atual)
            if (
              fatura.id !== faturaId &&
              (!fatura.Leitura || !fatura.Leitura.leitura)
            ) {
              novasDatas[fatura.id] = selectedDate;
            }
          });
        }

        return novasDatas;
      });
    }
  };

  const handleSave = async (fatura: Fatura, leituraValor: string) => {
    // 1. VALIDAÇÕES INICIAIS
    if (!leituraValor || leituraValor.trim() === "") {
      Alert.alert("Erro", "Por favor, informe a leitura atual.");
      return;
    }

    // Processamento do valor da leitura
    let leituraAtualNum = parseFloat(
      leituraValor.replace(/\./g, "").replace(",", ".")
    );

    // Verificar flag x10 do hidrômetro
    const multiplicarPor10 = fatura.Hidrometro.x10 === true;

    // Comparação com a leitura anterior (na mesma base)
    const leituraAnterior = fatura.leitura_anterior || 0;
    const leituraAtualParaComparacao = multiplicarPor10
      ? leituraAtualNum * 10
      : leituraAtualNum;

    // Alerta se a leitura atual for menor que a anterior
    if (leituraAtualParaComparacao < leituraAnterior) {
      const confirmaZerado = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Confirmação",
          `A leitura atual (${leituraAtualParaComparacao}) é menor que a anterior (${leituraAnterior}). Deseja continuar mesmo assim?`,
          [
            { text: "Não", onPress: () => resolve(false), style: "cancel" },
            { text: "Sim", onPress: () => resolve(true) },
          ]
        );
      });

      if (!confirmaZerado) return;
    }

    // Aplicar multiplicador x10 se necessário
    if (multiplicarPor10) {
      leituraAtualNum = leituraAtualNum * 10;
      console.log(`[LEITURA] Multiplicando valor por 10: ${leituraAtualNum}`);
    }

    // Indicador de salvamento
    setSalvando((prev) => ({
      ...prev,
      [fatura.id]: true,
    }));

    try {
      // 2. PREPARAÇÃO DOS DADOS
      // Formatar a data para envio
      const dataLocal = new Date(dataLeituraAtuais[fatura.id]);
      const dataFormatada = `${dataLocal.getFullYear()}-${String(
        dataLocal.getMonth() + 1
      ).padStart(2, "0")}-${String(dataLocal.getDate()).padStart(2, "0")}`;

      // Verificar conexão
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected;

      // 3. SALVAR NO WATERMELONDB (BANCO LOCAL)
      const leiturasCollection = database.get('leituras');

      // Buscar ou criar leitura no WatermelonDB
      const existingLeituras = await leiturasCollection
        .query(Q.where('server_id', fatura.id))
        .fetch();

      let leituraWatermelon: any;

      await database.write(async () => {
        if (existingLeituras.length > 0) {
          // ATUALIZAR leitura existente
          leituraWatermelon = existingLeituras[0];
          await leituraWatermelon.update((record: any) => {
            record.leituraAtual = leituraAtualNum;
            record.dataLeitura = dataFormatada;
            record.consumo = leituraAtualNum - (fatura.leitura_anterior || 0);
            record.valorLeituraM3 = leituraAtualNum - (fatura.leitura_anterior || 0);
            record.syncStatus = 'local_edited'; // Marcar como editado localmente
            record.errorMessage = undefined;
          });
          console.log(`✏️ Leitura ${fatura.id} atualizada no WatermelonDB (sync_status: local_edited)`);
        } else {
          // CRIAR nova leitura
          leituraWatermelon = await leiturasCollection.create((record: any) => {
            // ✅ IDENTIFICAÇÃO
            record.serverId = fatura.id; // ID da fatura
            record.leituraBackendId = fatura.Leitura?.id || null; // ✅ ID da leitura no backend
            const [mes, ano] = mesAnoSelecionado?.split('/') || ['', ''];
            record.mesReferencia = mes || '';
            record.anoReferencia = parseInt(ano) || new Date().getFullYear();
            
            // ✅ DADOS ESSENCIAIS PARA EXIBIÇÃO NA TELA
            record.loteId = fatura.LoteAgricola.id; // ✅ ID do lote (para vincular com observações)
            record.loteNome = fatura.LoteAgricola.nomeLote;
            record.loteSituacao = fatura.LoteAgricola.situacao || 'Operacional';
            record.loteMapaLeitura = fatura.LoteAgricola.mapa_leitura || null;
            record.irriganteNome = fatura.Cliente.nome;
            record.hidrometroCodigo = fatura.Hidrometro.codHidrometro;
            record.hidrometroX10 = fatura.Hidrometro.x10 === true;
            
            // ✅ DADOS ESSENCIAIS PARA UPLOAD
            record.leituraAtual = leituraAtualNum;
            record.dataLeitura = dataFormatada;
            
            // ✅ DADOS PARA EXIBIÇÃO/COMPARAÇÃO
            record.leituraAnterior = fatura.leitura_anterior || 0;
            record.dataLeituraAnterior = fatura.data_leitura_anterior || null;
            record.consumo = leituraAtualNum - (fatura.leitura_anterior || 0);
            record.valorLeituraM3 = leituraAtualNum - (fatura.leitura_anterior || 0);
            record.imagemUrl = undefined;
            
            // ✅ CAMPOS DE ESTADO/STATUS
            record.fechada = fatura.fechada;
            record.status = fatura.status;
            
            // ✅ CONTROLE DE SINCRONIZAÇÃO
            record.syncStatus = 'local_edited';
            record.hasLocalImage = false;
            record.errorMessage = undefined;
            record.lastSyncAt = Date.now();
          });
          console.log(`➕ Leitura ${fatura.id} criada no WatermelonDB (sync_status: local_edited)`);
        }
      });

      // 4. ATUALIZAÇÃO DOS ESTADOS LOCAIS (UI)
      setLeiturasSalvas((prev) => ({
        ...prev,
        [fatura.id]: true,
      }));
      
      // Atualizar status de não transmitida (sempre verdadeiro após salvar localmente)
      setLeiturasNaoTransmitidas((prev) => ({
        ...prev,
        [fatura.id]: true,
      }));

      setLeituraAtuais((prev) => ({
        ...prev,
        [fatura.id]: leituraAtualNum.toString(),
      }));

      // Atualizar objeto faturasSelecionadas para a UI
      const faturasAtualizadasUI = faturasSelecionadas.map((f) => {
        if (f.id === fatura.id) {
          return {
            ...f,
            valor_leitura_m3: leituraAtualNum,
            Leitura: {
              ...(f.Leitura || {}),
              leitura: leituraAtualNum,
              data_leitura: dataFormatada,
            },
          };
        }
        return f;
      });

      setFaturasSelecionadas(faturasAtualizadasUI);

      // Também manter compatibilidade com AsyncStorage (legado)
      const dadosAtualizados = {
        valor_leitura_m3: leituraAtualNum,
        Leitura: {
          ...(fatura.Leitura || {}),
          leitura: leituraAtualNum,
          data_leitura: dataFormatada,
        },
      };
      await atualizarFaturaLocal(fatura.id, dadosAtualizados);

      console.log(`💾 Leitura ${fatura.id} salva localmente (WatermelonDB + AsyncStorage)`);

      // 5. NOTIFICAR USUÁRIO (SEM UPLOAD AUTOMÁTICO)
      Toast.show({
        type: "success",
        text1: "Leitura salva localmente",
        text2: "Use o botão de upload para enviar ao servidor",
        position: "bottom",
        visibilityTime: 2000,
      });

      // 6. FINALIZAÇÃO
      setEditingId(null);

      aplicarFiltroEOrdenacao(
        faturasAtualizadasUI,
        filtro,
        ordenacao,
        searchText,
        { ...leiturasSalvas, [fatura.id]: true },
        setoresSelecionados
      );
    } catch (error: any) {
      console.error("[ERROR] Erro geral ao salvar leitura:", error);
      Alert.alert(
        "Erro",
        error.response?.data?.error ||
          "Erro ao salvar a leitura. Tente novamente."
      );
    } finally {
      setSalvando((prev) => ({
        ...prev,
        [fatura.id]: false,
      }));
    }
  };

  // Componente para o painel de filtros
  const renderFilterPanel = () => (
    <Animated.View
      style={[
        styles.filterPanel,
        {
          height: filterPanelHeight,
          opacity: filterAnimation,
          overflow: "hidden",
        },
      ]}
    >
      <View style={styles.filterPanelContent}>
        {/* Bloco de filtros por status */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterBlockTitle}>Status</Text>
          <View style={styles.filterButtonsRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                filtro === "todos" && styles.filterChipActive,
              ]}
              onPress={() => setFiltro("todos")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtro === "todos" && styles.filterChipTextActive,
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                filtro === "naoLidos" && styles.filterChipActive,
              ]}
              onPress={() => setFiltro("naoLidos")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtro === "naoLidos" && styles.filterChipTextActive,
                ]}
              >
                Não Lidos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                filtro === "lidos" && styles.filterChipActive,
              ]}
              onPress={() => setFiltro("lidos")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtro === "lidos" && styles.filterChipTextActive,
                ]}
              >
                Lidos
              </Text>
            </TouchableOpacity>
            {/* Novo botão de filtro para consumos negativos */}
            <TouchableOpacity
              style={[
                styles.filterChip,
                filtro === "negativos" && styles.filterChipActive,
              ]}
              onPress={() => setFiltro("negativos")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtro === "negativos" && styles.filterChipTextActive,
                ]}
              >
                Negativos
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bloco de ordenação */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterBlockTitle}>Ordenação</Text>
          <View style={styles.filterButtonsRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                ordenacao === "original" && styles.filterChipActive,
              ]}
              onPress={() => setOrdenacao("original")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  ordenacao === "original" && styles.filterChipTextActive,
                ]}
              >
                Original
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                ordenacao === "leitura" && styles.filterChipActive,
              ]}
              onPress={() => setOrdenacao("leitura")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  ordenacao === "leitura" && styles.filterChipTextActive,
                ]}
              >
                Leitura
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bloco de filtros por setores */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterBlockTitle}>Setores</Text>
          <View style={styles.filterButtonsRow}>
            {[1, 2, 3, 4].map((setor) => (
              <TouchableOpacity
                key={setor}
                style={[
                  styles.filterChip,
                  setoresSelecionados.includes(setor) && styles.filterChipActive,
                ]}
                onPress={() => {
                  setSetoresSelecionados((prev) =>
                    prev.includes(setor)
                      ? prev.filter((s) => s !== setor) // Remove se já estiver selecionado
                      : [...prev, setor] // Adiciona se não estiver selecionado
                  );
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    setoresSelecionados.includes(setor) &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Setor {setor}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderStatusBar = () => (
    <View style={styles.statusBarContainer}>
      <View style={styles.statusItem}>
        <Text style={styles.statusLabel}>Total:</Text>
        <Text style={styles.statusValue}>{totalFaturas}</Text>
      </View>
      <View style={styles.statusDivider} />
      <View style={styles.statusItem}>
        <Text style={styles.statusLabel}>Lidos:</Text>
        <Text style={[styles.statusValue, { color: "#2a9d8f" }]}>
          {totalLidas}
        </Text>
      </View>
      <View style={styles.statusDivider} />
      <View style={styles.statusItem}>
        <Text style={styles.statusLabel}>Faltam:</Text>
        <Text
          style={[
            styles.statusValue,
            { color: faltamLer > 0 ? "#e76f51" : "#2a9d8f" },
          ]}
        >
          {faltamLer}
        </Text>
      </View>
    </View>
  );
  // Função para abrir o modal de captura de imagem
  const handleOpenImagemModal = (faturaId: number) => {
    const fatura = faturasSelecionadas.find((f) => f.id === faturaId);
    if (!fatura) {
      Alert.alert("Erro", "Não foi possível encontrar os dados da fatura");
      return;
    }

    // ✅ CORREÇÃO: Usar o ID da leitura se disponível, senão usar o ID da fatura
    const leituraId = fatura.Leitura?.id || faturaId;
    
    setSelectedFaturaIdForImage(faturaId);
    setSelectedLeituraIdForImage(leituraId);
    setShowImagemModal(true);
  };

  // Otimizado com useCallback para melhorar desempenho
  const renderItem = useCallback(
    ({ item, index }: { item: Fatura; index: number }) => {
      return (
        <FaturaItem
          item={item}
          index={index}
          isTablet={isTablet}
          handleEdit={handleEdit}
          handleSave={handleSave}
          handleCancel={handleCancel}
          editingId={editingId}
          leituraAtuais={leituraAtuais}
          setLeituraAtuais={setLeituraAtuais}
          dataLeituraAtuais={dataLeituraAtuais}
          showDatepicker={showDatepicker}
          showDatePicker={showDatePicker}
          onDateChange={onDateChange}
          salvando={salvando}
          leiturasSalvas={leiturasSalvas}
          leiturasNaoTransmitidas={leiturasNaoTransmitidas}
          formatarNumeroComMilhar={formatarNumeroComMilhar}
          formatarData={formatarData}
          faturasComImagem={faturasComImagem}
          handleOpenImagemModal={handleOpenImagemModal}
          observacoesVigentes={observacoesVigentes}
          handleOpenObservacoesModal={handleOpenObservacoesModal}
        />
      );
    },
    [
      isTablet,
      editingId,
      leituraAtuais,
      dataLeituraAtuais,
      showDatePicker,
      salvando,
      leiturasSalvas,
      leiturasNaoTransmitidas,
      handleEdit,
      handleSave,
      handleCancel,
      showDatepicker,
      onDateChange,
      setLeituraAtuais,
      faturasComImagem,
      handleOpenImagemModal,
      observacoesVigentes,
      handleOpenObservacoesModal,
    ]
  );

  // Função chamada quando uma imagem é adicionada ou removida
  const handleImagemUploaded = (faturaId: number, hasImage: boolean = true) => {
    // ✅ Atualizar a fatura no contexto para que useMemo recalcule
    const faturasAtualizadas = faturasSelecionadas.map(f => 
      f.id === faturaId 
        ? { 
            ...f, 
            Leitura: { 
              ...f.Leitura, 
              imagem_leitura: hasImage ? 'local' : null 
            } 
          }
        : f
    );
    setFaturasSelecionadas(faturasAtualizadas);
  };

  return (
    <View style={styles.container}>
      {/* Indicador de modo offline */}
      {isOffline && (
        <View style={styles.offlineBar}>
          <Ionicons name="cloud-offline" size={18} color="#fff" />
          <Text style={styles.offlineText}>Modo offline</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        {/* Barra de status com contadores */}
        {renderStatusBar()}

        {/* Campo de busca com botão de filtro */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons
              name="search"
              size={22}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por lote ou irrigante..."
              value={searchText}
              onChangeText={setSearchText}
              clearButtonMode="while-editing"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.filterButton,
              showFilters && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons
              name={showFilters ? "options" : "options-outline"}
              size={22}
              color={showFilters ? "#fff" : "#2a9d8f"}
            />
          </TouchableOpacity>
        </View>

        {/* Painel de filtros expansível */}
        {renderFilterPanel()}

        {/* Loading para faturas fechadas */}
        {loading && filteredFaturas.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2a9d8f" />
            <Text style={styles.loadingText}>Carregando faturas fechadas...</Text>
            <Text style={styles.loadingSubText}>
              Buscando dados de {mesAnoSelecionado} no servidor
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={filteredFaturas}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            numColumns={isTablet ? 2 : 1}
            key={isTablet ? "two-columns" : "one-column"}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollYValue } } }],
              { useNativeDriver: false }
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchText
                    ? "Nenhuma leitura encontrada para essa busca"
                    : filtro !== "todos"
                    ? `Nenhuma leitura "${
                        filtro === "lidos"
                          ? "lida"
                          : filtro === "naoLidos"
                          ? "não lida"
                          : "com consumo negativo"
                      }" disponível`
                    : "Nenhuma leitura disponível"}
                </Text>
              </View>
            }
          />
        )}

        {/* Botão flutuante para ir para o final */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
        >
          <Ionicons name="arrow-down" size={24} color="white" />
        </TouchableOpacity>

        {/* Botão flutuante para voltar ao topo (aparece durante rolagem) */}
        {showTopFab && (
          <TouchableOpacity
            style={styles.fabTop}
            onPress={() =>
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
            }
          >
            <Ionicons name="arrow-up" size={24} color="white" />
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
      {/* Renderizar o modal de imagem */}
      <ImagemLeituraModal
        isVisible={showImagemModal}
        onClose={() => setShowImagemModal(false)}
        faturaId={selectedFaturaIdForImage}
        leituraId={selectedLeituraIdForImage}
        hasExistingImage={
          selectedFaturaIdForImage
            ? faturasComImagem[selectedFaturaIdForImage]
            : false
        }
        onImageUploaded={handleImagemUploaded}
      />

      {/* Modal de Observações */}
      <ObservacaoModal
        visible={showObservacoesModal}
        onClose={() => {
          setShowObservacoesModal(false);
          setSelectedLoteForObservacoes(null);
          setSelectedLoteNome('');
          // ✅ Atualizar contadores de observações após fechar modal
          verificarObservacoesVigentes();
        }}
        loteId={selectedLoteForObservacoes || 0}
        loteNome={selectedLoteNome}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginRight: 10,
  },
  periodBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  periodText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  header: {
    padding: 16,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 18, // Aumentando um pouco para ficar mais legível
    color: "rgba(255, 255, 255, 0.9)", // Tornando um pouco mais opaco
    fontWeight: "normal",
  },

  // Status Bar (informações sobre quantidades)
  statusBarContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    justifyContent: "space-around",
  },
  statusItem: {
    alignItems: "center",
    flexDirection: "row",
  },
  statusLabel: {
    color: "#666",
    marginRight: 5,
    fontSize: 15,
  },
  statusValue: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
  },
  statusDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "#ddd",
  },

  // Campo de busca
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
  },

  // Botão de filtro
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a9d8f",
  },
  filterButtonActive: {
    backgroundColor: "#2a9d8f",
  },

  // Painel de filtros expansível
  filterPanel: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingHorizontal: 16,
  },
  filterPanelContent: {
    paddingVertical: 12,
    flexDirection: "column", // ✅ Layout vertical para melhor responsividade
    gap: 12, // Espaçamento entre blocos
  },
  filterBlock: {
    width: "100%", // ✅ Cada bloco ocupa largura total
    marginBottom: 4, // Espaço mínimo entre blocos
  },
  filterBlockTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
  },
  filterButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6, // ✅ Espaçamento compacto entre botões
    marginTop: 4, // Pequeno espaço do título
  },

  // Chip de filtro
  filterChip: {
    paddingVertical: 6, // ✅ Reduzido para layout mais compacto
    paddingHorizontal: 12, // ✅ Reduzido para melhor ajuste
    borderRadius: 16, // ✅ Proporção ajustada ao padding
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  filterChipActive: {
    backgroundColor: "#2a9d8f",
    borderColor: "#2a9d8f",
  },
  filterChipText: {
    color: "#666",
    fontWeight: "500",
    fontSize: 13, // ✅ Ajustado para layout mais compacto
  },
  filterChipTextActive: {
    color: "#fff",
  },

  listContent: {
    padding: 12,
    paddingBottom: 80, // Espaço para o FAB
  },

  // Estilo para o card
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  cardLido: {
    borderLeftWidth: 4,
    borderLeftColor: "#2a9d8f",
    backgroundColor: "#f9fffd",
  },
  cardNaoLido: {
    borderLeftWidth: 4,
    borderLeftColor: "#ffd700", // Amarelo ouro
    backgroundColor: "#fffef5",
  },
  cardAbandonado: {
    borderLeftWidth: 4,
    borderLeftColor: "#bbb", // Cinza
    backgroundColor: "#f5f5f5",
  },

  // Cabeçalho do Card
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  loteContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  loteText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },
  textAbandonado: {
    color: "#999",
  },

  // Informações gerais
  cardInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#f9f9f9",
  },
  infoColumn: {
    flexDirection: "column",
    gap: 6,
  },
  infoGroup: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    flexShrink: 1,
  },
  infoTextSmall: {
    fontSize: 10,
    color: "#888",
  },
  pendingIconContainer: {
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  editedIconContainer: {
    alignSelf: "flex-end",
    marginBottom: 4,
  },

  // Container de leituras
  readingsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    gap: 10,
  },
  readingBlock: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
    padding: 8,
  },
  highlightedReadingBlock: {
    backgroundColor: "rgba(42, 157, 143, 0.1)",
    borderLeftWidth: 3,
    borderLeftColor: "#2a9d8f",
  },
  readingLabel: {
    fontSize: 12,
    color: "#2a9d8f",
    fontWeight: "500",
    marginBottom: 4,
  },
  readingValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2a9d8f",
  },

  // Input e DatePicker
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#2a9d8f",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    height: 36, // ✅ Altura fixa para consistência visual perfeita
    fontSize: 13,
    color: "#333",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#2a9d8f",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    height: 36, // ✅ Altura fixa igual ao input para consistência visual perfeita
  },
  dateButtonText: {
    fontSize: 13, // ✅ Ajustado para mesmo tamanho do input
    color: "#333",
  },

  // Rodapé do Card
  cardFooter: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  editButton: {
    backgroundColor: "#1890ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    width: "60%",
    elevation: 1,
  },
  saveButton: {
    backgroundColor: "#52c41a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    width: "48%",
    elevation: 1,
  },
  cancelButton: {
    backgroundColor: "#ff4d4f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    width: "48%",
    elevation: 1,
  },
  buttonText: {
    color: "white",
    marginLeft: 6,
    fontWeight: "500",
    fontSize: 12,
  },

  // Status Badge
  statusBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#52c41a",
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusVencida: {
    backgroundColor: "#ff4d4f",
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 10,
  },

  // Container vazio
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 15,
    color: "#999",
  },

  // Loading para faturas fechadas
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2a9d8f",
    marginTop: 16,
    textAlign: "center",
  },
  loadingSubText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },

  // Botão flutuante para o final
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#2a9d8f",
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },

  // Botão flutuante para o topo (novo)
  fabTop: {
    position: "absolute",
    bottom: 20,
    left: 20,
    backgroundColor: "#1890ff",
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },

  // Estilos para o modo offline
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
  footerButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    elevation: 1,
  },

  multiplicadorText: {
    fontSize: 11,
    color: "#e63946",
    fontStyle: "italic",
  },
  x10Badge: {
    marginLeft: 4,
    backgroundColor: "#f50", // Laranja
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ translateY: -5 }], // Posicionar levemente acima
  },
  x10BadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "bold",
    lineHeight: 14,
  },
  abandonadoMessageContainer: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  abandonadoBadge: {
    backgroundColor: "#999",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  abandonadoBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  abandonadoMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  abandonadoMessageText: {
    color: "#999",
    fontSize: 12,
    fontStyle: "italic",
    textAlign: "center",
  },
});

export default LeiturasDetalhesScreen;
