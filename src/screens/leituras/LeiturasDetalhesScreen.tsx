// src/screens/leituras/LeiturasDetalhesScreen.tsx
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
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
import { router } from "expo-router";
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
// Após as outras importações
import ImagemLeituraModal from "../../components/leituras/ImagemLeituraModal";
import ImagemLeituraService from "../../services/ImagemLeituraService";

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
  };
  Cliente: {
    id: number;
    nome: string;
  };
  Leitura?: {
    leitura: number;
    data_leitura: string;
  };
}

// Tipos de ordenação
type OrdenacaoTipo = "original" | "leitura";

// Tipos de filtro
type FiltroTipo = "todos" | "lidos" | "naoLidos";

// Interface para props do FaturaItem
interface FaturaItemProps {
  item: Fatura;
  index: number;
  isTablet: boolean;
  handleEdit: (faturaId: number) => void;
  handleSave: (fatura: Fatura) => Promise<void>;
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
  pendingSyncs: { [key: number]: boolean };
  leiturasSalvas: { [key: number]: boolean };
  formatarNumeroComMilhar: (value: number | string | undefined) => string;
  formatarData: (data: string | Date | undefined) => string;
  faturasComImagem: { [key: number]: boolean };
  handleOpenImagemModal: (faturaId: number) => void;
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
    pendingSyncs,
    leiturasSalvas,
    formatarNumeroComMilhar,
    formatarData,
    faturasComImagem,
    handleOpenImagemModal,
  }) => {
    if (index === 0) {
      console.log("Data atual do item:", item.Leitura?.data_leitura);
      console.log("Data em dataLeituraAtuais:", dataLeituraAtuais[item.id]);
    }
    const isEditing = editingId === item.id;
    const isSaving = salvando[item.id] || false;
    const isDisabled = item.fechada === "Sim";
    const hasPendingSync = pendingSyncs[item.id];
    const foiEditada = leiturasSalvas[item.id];

    // Layout de 2 colunas - determinar se é coluna da esquerda ou direita
    const isLeftColumn = index % 2 === 0;

    return (
      <View
        style={[
          styles.card,
          isTablet && {
            width: "48%",
            marginRight: isLeftColumn ? "1%" : 0,
            marginLeft: !isLeftColumn ? "1%" : 0,
          },
          foiEditada && styles.cardLido,
          !foiEditada && !isDisabled && styles.cardNaoLido,
        ]}
      >
        {/* Cabeçalho do Card - Lote e Cliente */}
        <View style={styles.cardHeader}>
          <View style={styles.loteContainer}>
            <Ionicons name="map-outline" size={20} color="#2a9d8f" />
            <Text
              style={[styles.loteText, isTablet && { fontSize: 16 }]}
              numberOfLines={1}
            >
              {item.LoteAgricola.nomeLote} - {item.Cliente.nome.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Informações gerais */}
        <View style={styles.cardInfo}>
          <View style={styles.infoColumn}>
            <View style={styles.infoGroup}>
              <Ionicons name="water-outline" size={16} color="#2a9d8f" />
              <Text style={[styles.infoText, isTablet && { fontSize: 14 }]}>
                Hidrômetro {item.Hidrometro.codHidrometro}
              </Text>
            </View>

            <View style={styles.infoGroup}>
              <Ionicons name="analytics-outline" size={16} color="#666" />
              <Text style={[styles.infoText, isTablet && { fontSize: 14 }]}>
                Leitura Anterior:{" "}
                {formatarNumeroComMilhar(
                  // Se for x10 e não tiver leitura atual informada, divide por 10
                  item.Hidrometro.x10 && !item.Leitura?.leitura
                    ? (item.leitura_anterior || 0) / 10
                    : item.leitura_anterior || 0
                )}{" "}
                m³
                {item.data_leitura_anterior ? (
                  <Text style={[styles.infoText, isTablet && { fontSize: 14 }]}>
                    {" em "}
                    {formatarData(item.data_leitura_anterior)}
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>

          <View style={styles.infoColumn}>
            {hasPendingSync && (
              <View style={styles.pendingIconContainer}>
                <Ionicons name="sync" size={16} color="#ff9800" />
              </View>
            )}

            {foiEditada && !hasPendingSync && (
              <View style={styles.editedIconContainer}>
                <Ionicons name="checkmark-circle" size={16} color="#2a9d8f" />
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
                <MaskedNumberInput
                  style={styles.input}
                  value={leituraAtuais[item.id]}
                  onChangeText={(text: string) =>
                    setLeituraAtuais((prev) => ({ ...prev, [item.id]: text }))
                  }
                  placeholder="Informe a leitura"
                />
                {item.Hidrometro.x10 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  ></View>
                )}
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[styles.readingValue, isTablet && { fontSize: 15 }]}
                >
                  {item.Leitura
                    ? formatarNumeroComMilhar(item.Leitura.leitura) + " m³"
                    : "-"}
                </Text>
                {item.Hidrometro.x10 && (
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
                    {formatarData(dataLeituraAtuais[item.id])}
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
                  ? formatarData(dataLeituraAtuais[item.id])
                  : item.Leitura && item.Leitura.data_leitura
                  ? formatarData(item.Leitura.data_leitura)
                  : "-"}
              </Text>
            )}
          </View>
        </View>

        {/* Rodapé com Botões de Ação */}
        <View style={styles.cardFooter}>
          {isEditing ? (
            // Modo Edição: Botões Salvar e Cancelar
            <>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleSave(item)}
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
          ) : (
            // Modo Visualização: Botão Editar
            <View style={styles.footerButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.editButton,
                  {
                    opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: foiEditada ? "#4d9792" : "#1890ff",
                    flex: 1,
                  },
                ]}
                onPress={() => handleEdit(item.id)}
                disabled={isDisabled}
              >
                <Ionicons
                  name={foiEditada ? "create-outline" : "create"}
                  size={18}
                  color="#fff"
                />
                <Text style={[styles.buttonText, isTablet && { fontSize: 14 }]}>
                  {isDisabled
                    ? "Fatura Fechada"
                    : foiEditada
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
                    backgroundColor: faturasComImagem[item.id]
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
                    faturasComImagem[item.id]
                      ? "image-outline"
                      : "camera-outline"
                  }
                  size={18}
                  color="#fff"
                />
                <Text style={[styles.buttonText, isTablet && { fontSize: 14 }]}>
                  {faturasComImagem[item.id] ? "Ver Imagem" : "Câmera"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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

  // Adicionar log para debug
  console.log(
    `DIMENSÕES INICIAIS: ${dimensions.width}x${dimensions.height}, smaller: ${smallerDimension}, larger: ${largerDimension}, isTablet: ${isTablet}`
  );

  // Listener para mudanças de dimensão (rotação de tela)
  useEffect(() => {
    console.log(
      `UseEffect DIMENSÕES: ${dimensions.width}x${dimensions.height}, isTablet: ${isTablet}`
    );

    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      const newWidth = window.width;
      const newHeight = window.height;
      const newSmaller = Math.min(newWidth, newHeight);
      const newLarger = Math.max(newWidth, newHeight);
      const newIsTablet = newSmaller >= 550 || newLarger >= 900; // AJUSTADO para 550dp

      console.log(
        `DIMENSÕES ALTERADAS: ${newWidth}x${newHeight}, smaller: ${newSmaller}, larger: ${newLarger}, isTablet: ${newIsTablet}`
      );
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  // Obtendo os dados do contexto
  const { faturasSelecionadas, mesAnoSelecionado, setFaturasSelecionadas } =
    useLeiturasContext();

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

  // Refs e estados de UI
  const flatListRef = useRef<FlatList>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [searchText, setSearchText] = useState("");
  const [filteredFaturas, setFilteredFaturas] = useState<Fatura[]>([]);

  // Estados para filtros e ordenação
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTipo>("original");
  const [filtro, setFiltro] = useState<FiltroTipo>("todos");
  const [showFilters, setShowFilters] = useState(false);

  // Estados para gerenciar modal de imagem
  const [showImagemModal, setShowImagemModal] = useState(false);
  const [selectedFaturaIdForImage, setSelectedFaturaIdForImage] = useState<
    number | null
  >(null);
  const [selectedLeituraIdForImage, setSelectedLeituraIdForImage] = useState<
    number | null
  >(null);
  const [faturasComImagem, setFaturasComImagem] = useState<{
    [key: number]: boolean;
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

  // Animação do painel de filtros
  useEffect(() => {
    Animated.timing(filterAnimation, {
      toValue: showFilters ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showFilters, filterAnimation]);

  const filterPanelHeight = filterAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
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

      // Preservar as datas replicadas
      if (fatura.Leitura?.leitura && fatura.Leitura?.leitura > 0) {
        datas[fatura.id] = new Date(fatura.Leitura.data_leitura + "T00:00:00");
      } else if (dataLeituraAtuais[fatura.id]) {
        // Se já tem uma data setada (replicada), mantém essa data
        datas[fatura.id] = dataLeituraAtuais[fatura.id];
      } else {
        // Caso contrário, usa a data atual
        datas[fatura.id] = new Date();
      }

      // Verificar se a leitura tem valor atual (foi editada)
      editados[fatura.id] =
        fatura.valor_leitura_m3 &&
        parseFloat(fatura.valor_leitura_m3.toString()) > 0;
    });

    setLeituraAtuais(leituras);
    setDataLeituraAtuais((prev) => ({ ...prev, ...datas })); // Mescla com as datas anteriores
    setLeiturasSalvas(editados);
    aplicarFiltroEOrdenacao(
      faturasSelecionadas,
      filtro,
      ordenacao,
      searchText,
      editados
    );

    // Verificar conexão
    const checkConnection = async () => {
      const netInfo = await NetInfo.fetch();
      setIsOffline(!netInfo.isConnected);
    };

    checkConnection();

    // Verificar se há alterações pendentes
    const checkPendingSyncs = async () => {
      try {
        const pendingData = await AsyncStorage.getItem("pendingLeiturasSyncs");
        if (pendingData) {
          const pendingChanges = JSON.parse(pendingData);
          setPendingSyncs(pendingChanges);
        }
      } catch (error) {
        console.error("Erro ao verificar sincronizações pendentes:", error);
      }
    };

    checkPendingSyncs();

    // Verificar conexão periodicamente
    const intervalId = setInterval(checkConnection, 10000);
    return () => clearInterval(intervalId);
  }, [faturasSelecionadas]);

  // Função para aplicar filtro e ordenação às faturas
  const aplicarFiltroEOrdenacao = useCallback(
    (
      faturas: Fatura[],
      filtroAtual: FiltroTipo,
      ordenacaoAtual: OrdenacaoTipo,
      termo: string,
      statusLeituras: { [key: number]: boolean }
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

  // Efeito para atualizar a lista quando filtro, ordenação ou busca mudam
  useEffect(() => {
    aplicarFiltroEOrdenacao(
      faturasSelecionadas,
      filtro,
      ordenacao,
      searchText,
      leiturasSalvas
    );
  }, [filtro, ordenacao, searchText, leiturasSalvas, aplicarFiltroEOrdenacao]);

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

  // Efeito para verificar quais faturas já têm imagens
  useEffect(() => {
    const verificarImagens = async () => {
      if (faturasSelecionadas.length > 0 && !isOffline) {
        const imagensStatus =
          await ImagemLeituraService.verificarImagensFaturas(
            faturasSelecionadas
          );
        setFaturasComImagem(imagensStatus);
      }
    };

    verificarImagens();
  }, [faturasSelecionadas, isOffline]);

  const handleEdit = (faturaId: number) => {
    setEditingId(faturaId);

    // Armazenar o valor original para uso posterior em caso de cancelamento
    const fatura = faturasSelecionadas.find((f) => f.id === faturaId);
    if (fatura) {
      setValoresOriginais((prev) => ({
        ...prev,
        [faturaId]: fatura.Leitura?.leitura.toString() || "",
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

  const handleSave = async (fatura: Fatura) => {
    // Validações
    const leituraAtual = leituraAtuais[fatura.id];
    if (!leituraAtual || leituraAtual.trim() === "") {
      Alert.alert("Erro", "Por favor, informe a leitura atual.");
      return;
    }

    // Remover a formatação para enviar para a API
    let leituraAtualNum = parseFloat(
      leituraAtual.replace(/\./g, "").replace(",", ".")
    );
    // Verificar se o hidrômetro tem flag x10 ativada
    const multiplicarPor10 = fatura.Hidrometro.x10 === true;

    // Verificar se a leitura atual é menor que a anterior
    const leituraAnterior = fatura.leitura_anterior || 0;

    // CORREÇÃO: Para a comparação, aplicamos a multiplicação antes
    // para garantir que a comparação seja feita na mesma base
    const leituraAtualParaComparacao = multiplicarPor10
      ? leituraAtualNum * 10
      : leituraAtualNum;

    // Verificar se a leitura atual é menor que a anterior
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

    // NOVO: Multiplicar o valor por 10 se necessário
    if (multiplicarPor10) {
      leituraAtualNum = leituraAtualNum * 10;
      console.log(`[LEITURA] Multiplicando valor por 10: ${leituraAtualNum}`);
    }

    // Mostrar indicador de carregamento para esta linha
    setSalvando((prev) => ({
      ...prev,
      [fatura.id]: true,
    }));

    try {
      // Formatar a data para envio
      // Formatar a data para envio sem problemas de timezone
      const dataLocal = new Date(dataLeituraAtuais[fatura.id]);
      const dataFormatada = `${dataLocal.getFullYear()}-${String(
        dataLocal.getMonth() + 1
      ).padStart(2, "0")}-${String(dataLocal.getDate()).padStart(2, "0")}`;

      // Verificar se está online ou offline
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected;

      // Criar objeto com os dados da atualização
      const updateData = {
        id: fatura.id,
        leitura: leituraAtualNum,
        data_leitura: dataFormatada,
        updatedAt: new Date().toISOString(),
      };

      // Marcar como salvo independente do modo online/offline
      setLeiturasSalvas((prev) => ({
        ...prev,
        [fatura.id]: true,
      }));

      if (isConnected) {
        // MODO ONLINE: Chamar a API diretamente
        const response = await api.put(
          `/faturamensal/atualizar-leitura/${fatura.id}`,
          {
            leitura: leituraAtualNum,
            data_leitura: dataFormatada,
          }
        );

        if (response.status === 200) {
          // Atualizar no contexto
          setFaturasSelecionadas(
            faturasSelecionadas.map((f) => {
              if (f.id === fatura.id) {
                return {
                  ...f,
                  valor_leitura_m3: leituraAtualNum,
                  Leitura: {
                    ...f.Leitura,
                    leitura: leituraAtualNum,
                    data_leitura: dataFormatada,
                  },
                };
              }
              return f;
            })
          );

          // Remover da lista de pendentes se existir
          if (pendingSyncs[fatura.id]) {
            const updatedPending = { ...pendingSyncs };
            delete updatedPending[fatura.id];
            setPendingSyncs(updatedPending);

            // Atualizar AsyncStorage
            await AsyncStorage.setItem(
              "pendingLeiturasSyncs",
              JSON.stringify(updatedPending)
            );

            // Verificar se existem atualizações pendentes e remover esta
            const pendingDataStr =
              (await AsyncStorage.getItem("pendingLeituraUpdates")) || "{}";
            const pendingData = JSON.parse(pendingDataStr);
            if (pendingData[fatura.id]) {
              delete pendingData[fatura.id];
              await AsyncStorage.setItem(
                "pendingLeituraUpdates",
                JSON.stringify(pendingData)
              );
            }
          }

          Toast.show({
            type: "success",
            text1: "Leitura salva com sucesso!",
            position: "bottom",
            visibilityTime: 2000,
          });

          setEditingId(null);

          // Reaplicar filtro e ordenação após salvar
          aplicarFiltroEOrdenacao(
            faturasSelecionadas,
            filtro,
            ordenacao,
            searchText,
            { ...leiturasSalvas, [fatura.id]: true }
          );
        }
      } else {
        // MODO OFFLINE: Salvar localmente para sincronização posterior
        // 1. Atualizar dados no contexto
        const updatedFaturas = faturasSelecionadas.map((f) => {
          if (f.id === fatura.id) {
            return {
              ...f,
              Leitura: {
                ...f.Leitura,
                leitura: leituraAtualNum,
                data_leitura: dataFormatada,
              },
            };
          }
          return f;
        });

        setFaturasSelecionadas(updatedFaturas);

        // 2. Salvar dados da atualização para sync posterior
        try {
          // Buscar atualizações pendentes existentes
          const pendingDataStr =
            (await AsyncStorage.getItem("pendingLeituraUpdates")) || "{}";
          const pendingData = JSON.parse(pendingDataStr);

          // Adicionar/atualizar esta leitura
          pendingData[fatura.id] = updateData;

          // Salvar no AsyncStorage
          await AsyncStorage.setItem(
            "pendingLeituraUpdates",
            JSON.stringify(pendingData)
          );

          // Atualizar status de pendência
          const updatedPending = { ...pendingSyncs, [fatura.id]: true };
          setPendingSyncs(updatedPending);
          await AsyncStorage.setItem(
            "pendingLeiturasSyncs",
            JSON.stringify(updatedPending)
          );

          Toast.show({
            type: "info",
            text1: "Leitura salva localmente",
            text2: "Será sincronizada quando houver conexão",
            position: "bottom",
            visibilityTime: 2000,
          });

          setEditingId(null);

          // Reaplicar filtro e ordenação após salvar
          aplicarFiltroEOrdenacao(
            updatedFaturas,
            filtro,
            ordenacao,
            searchText,
            { ...leiturasSalvas, [fatura.id]: true }
          );
        } catch (storageError) {
          console.error("Erro ao salvar dados offline:", storageError);
          Alert.alert("Erro", "Não foi possível salvar os dados offline.");
        }
      }
    } catch (error: any) {
      console.error("Erro ao salvar leitura:", error);
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
    if (fatura && fatura.Leitura && fatura.Leitura.id) {
      setSelectedFaturaIdForImage(faturaId);
      setSelectedLeituraIdForImage(fatura.Leitura.id);
      setShowImagemModal(true);
    } else {
      Alert.alert("Erro", "Não foi possível encontrar os dados da leitura");
    }
  };

  // Otimizado com useCallback para melhorar desempenho
  const renderItem = useCallback(
    ({ item, index }: { item: Fatura; index: number }) => {
      if (index === 0) {
        console.log(
          `Renderizando item com isTablet=${isTablet}, numColumns=${
            isTablet ? 2 : 1
          }`
        );
      }

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
          pendingSyncs={pendingSyncs}
          leiturasSalvas={leiturasSalvas}
          formatarNumeroComMilhar={formatarNumeroComMilhar}
          formatarData={formatarData}
          faturasComImagem={faturasComImagem}
          handleOpenImagemModal={handleOpenImagemModal}
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
      pendingSyncs,
      leiturasSalvas,
      handleEdit,
      handleSave,
      handleCancel,
      showDatepicker,
      onDateChange,
      setLeituraAtuais,
      faturasComImagem,
      handleOpenImagemModal,
    ]
  );

  // Função chamada quando uma imagem é enviada com sucesso
  const handleImagemUploaded = (faturaId: number) => {
    setFaturasComImagem((prev) => ({ ...prev, [faturaId]: true }));
  };

  return (
    <SafeAreaView style={styles.container}>
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

        <FlatList
          ref={flatListRef}
          data={filteredFaturas}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          numColumns={isTablet ? 2 : 1}
          key={isTablet ? "two-columns" : "one-column"}
          onLayout={() =>
            console.log(
              `FlatList renderizado com numColumns=${isTablet ? 2 : 1}, width=${
                dimensions.width
              }, isTablet=${isTablet}`
            )
          }
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
                      filtro === "lidos" ? "lida" : "não lida"
                    }" disponível`
                  : "Nenhuma leitura disponível"}
              </Text>
            </View>
          }
        />

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
    </SafeAreaView>
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
    flexDirection: "row", // Layout lado a lado
    justifyContent: "space-between",
    flexWrap: "wrap", // Para caso a tela seja muito estreita
  },
  filterBlock: {
    flex: 1, // Cada bloco ocupa metade do espaço
    minWidth: 150, // Largura mínima para garantir espaço adequado
    marginHorizontal: 8, // Espaçamento entre blocos
    marginBottom: 8, // Espaço se precisar quebrar linha
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
    gap: 8, // Reduzido para melhor aproveitamento do espaço
  },

  // Chip de filtro
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
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
    fontSize: 14,
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
    padding: 6,
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
    padding: 6,
  },
  dateButtonText: {
    fontSize: 12,
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
});

export default LeiturasDetalhesScreen;
