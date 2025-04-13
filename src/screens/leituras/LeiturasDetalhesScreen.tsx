// src/screens/leituras/LeiturasDetalhesScreen.tsx
import React, { useState, useEffect, useRef } from "react";
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

// Verificar se é tablet
const { width } = Dimensions.get("window");
const isTablet = width > 600;

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

const LeiturasDetalhesScreen: React.FC = () => {
  const { colors } = useTheme();

  // Obtendo os dados do contexto
  const { faturasSelecionadas, mesAnoSelecionado, setFaturasSelecionadas } =
    useLeiturasContext();

  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [leituraAtuais, setLeituraAtuais] = useState<{ [key: number]: string }>({});
  const [dataLeituraAtuais, setDataLeituraAtuais] = useState<{[key: number]: Date}>({});
  const [showDatePicker, setShowDatePicker] = useState<{[key: number]: boolean}>({});
  const [salvando, setSalvando] = useState<{ [key: number]: boolean }>({});
  const [valoresOriginais, setValoresOriginais] = useState<{[key: number]: string}>({});
  const [leiturasSalvas, setLeiturasSalvas] = useState<{[key: number]: boolean}>({});
  const flatListRef = useRef<FlatList>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState<{[key: number]: boolean}>({});
  const [searchText, setSearchText] = useState('');
  const [filteredFaturas, setFilteredFaturas] = useState<Fatura[]>([]);

  // Inicializar os estados com os dados existentes
  useEffect(() => {
    const leituras: { [key: number]: string } = {};
    const datas: { [key: number]: Date } = {};
    const editados: { [key: number]: boolean } = {};

    faturasSelecionadas.forEach((fatura) => {
      leituras[fatura.id] = fatura.Leitura?.leitura
        ? fatura.Leitura.leitura.toString()
        : "";

      datas[fatura.id] = fatura.Leitura?.data_leitura
        ? new Date(fatura.Leitura.data_leitura)
        : new Date();
        
      // Verificar se a leitura tem valor atual (foi editada)
      editados[fatura.id] = fatura.Leitura?.leitura > 0;
    });

    setLeituraAtuais(leituras);
    setDataLeituraAtuais(datas);
    setLeiturasSalvas(editados);
    setFilteredFaturas(faturasSelecionadas);
    
    // Verificar conexão
    const checkConnection = async () => {
      const netInfo = await NetInfo.fetch();
      setIsOffline(!netInfo.isConnected);
    };
    
    checkConnection();
    
    // Verificar se há alterações pendentes
    const checkPendingSyncs = async () => {
      try {
        const pendingData = await AsyncStorage.getItem('pendingLeiturasSyncs');
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

  // Filtrar faturas quando o texto de busca muda
  useEffect(() => {
    if (!searchText) {
      setFilteredFaturas(faturasSelecionadas);
      return;
    }
    
    const lowerSearchText = searchText.toLowerCase();
    const filtered = faturasSelecionadas.filter(fatura => 
      fatura.LoteAgricola.nomeLote.toLowerCase().includes(lowerSearchText) ||
      fatura.Cliente.nome.toLowerCase().includes(lowerSearchText)
    );
    
    setFilteredFaturas(filtered);
  }, [searchText, faturasSelecionadas]);

  const handleEdit = (faturaId: number) => {
    setEditingId(faturaId);

    // Armazenar o valor original para uso posterior em caso de cancelamento
    const fatura = faturasSelecionadas.find((f) => f.id === faturaId);
    if (fatura) {
      setValoresOriginais((prev) => ({
        ...prev,
        [faturaId]: fatura.Leitura?.leitura.toString() || "",
      }));
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
      setDataLeituraAtuais((prev) => ({
        ...prev,
        [faturaId]: selectedDate,
      }));
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
    const leituraAtualNum = parseFloat(
      leituraAtual.replace(/\./g, "").replace(",", ".")
    );
    const leituraAnterior = fatura.leitura_anterior || 0;

    // Verificar se a leitura atual é menor que a anterior
    if (leituraAtualNum < leituraAnterior) {
      const confirmaZerado = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Confirmação",
          `A leitura atual (${leituraAtualNum}) é menor que a anterior (${leituraAnterior}). Deseja continuar mesmo assim?`,
          [
            { text: "Não", onPress: () => resolve(false), style: "cancel" },
            { text: "Sim", onPress: () => resolve(true) },
          ]
        );
      });

      if (!confirmaZerado) return;
    }

    // Mostrar indicador de carregamento para esta linha
    setSalvando((prev) => ({
      ...prev,
      [fatura.id]: true,
    }));

    try {
      // Formatar a data para envio
      const dataFormatada = new Date(dataLeituraAtuais[fatura.id])
        .toISOString()
        .split("T")[0]; // Formato YYYY-MM-DD
      
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
      setLeiturasSalvas(prev => ({
        ...prev,
        [fatura.id]: true
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
            await AsyncStorage.setItem('pendingLeiturasSyncs', JSON.stringify(updatedPending));
            
            // Verificar se existem atualizações pendentes e remover esta
            const pendingDataStr = await AsyncStorage.getItem('pendingLeituraUpdates') || '{}';
            const pendingData = JSON.parse(pendingDataStr);
            if (pendingData[fatura.id]) {
              delete pendingData[fatura.id];
              await AsyncStorage.setItem('pendingLeituraUpdates', JSON.stringify(pendingData));
            }
          }

          Alert.alert("Sucesso", "Leitura atualizada com sucesso!");
          setEditingId(null);
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
        setFilteredFaturas(
          searchText 
            ? updatedFaturas.filter(f => 
                f.LoteAgricola.nomeLote.toLowerCase().includes(searchText.toLowerCase()) ||
                f.Cliente.nome.toLowerCase().includes(searchText.toLowerCase())
              )
            : updatedFaturas
        );
        
        // 2. Salvar dados da atualização para sync posterior
        try {
          // Buscar atualizações pendentes existentes
          const pendingDataStr = await AsyncStorage.getItem('pendingLeituraUpdates') || '{}';
          const pendingData = JSON.parse(pendingDataStr);
          
          // Adicionar/atualizar esta leitura
          pendingData[fatura.id] = updateData;
          
          // Salvar no AsyncStorage
          await AsyncStorage.setItem('pendingLeituraUpdates', JSON.stringify(pendingData));
          
          // Atualizar status de pendência
          const updatedPending = { ...pendingSyncs, [fatura.id]: true };
          setPendingSyncs(updatedPending);
          await AsyncStorage.setItem('pendingLeiturasSyncs', JSON.stringify(updatedPending));
          
          Alert.alert(
            "Salvo localmente", 
            "Leitura salva no dispositivo. Será sincronizada automaticamente quando houver conexão."
          );
          setEditingId(null);
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

  const renderItem = ({ item, index }: { item: Fatura, index: number }) => {
    const isEditing = editingId === item.id;
    const isSaving = salvando[item.id] || false;
    const isDisabled = item.fechada === "Sim";
    const hasPendingSync = pendingSyncs[item.id];
    const foiEditada = leiturasSalvas[item.id];
    
    // Layout de 2 colunas - determinar se é coluna da esquerda ou direita
    const isLeftColumn = index % 2 === 0;

    return (
      <View style={[
        styles.card,
        isTablet && { 
          width: '49%', 
          marginRight: isLeftColumn ? '1%' : 0,
          marginLeft: !isLeftColumn ? '1%' : 0 
        }
      ]}>
        {/* Cabeçalho do Card - Lote e Cliente */}
        <View style={styles.cardHeader}>
          <View style={styles.loteContainer}>
            <Ionicons name="map-outline" size={20} color="#2a9d8f" />
            <Text style={styles.loteText} numberOfLines={1}>
              {item.LoteAgricola.nomeLote} - {item.Cliente.nome.split(' ')[0]}
            </Text>
          </View>
        </View>

        {/* Informações gerais */}
        <View style={styles.cardInfo}>
          <View style={styles.infoColumn}>
            <View style={styles.infoGroup}>
              <Ionicons name="water-outline" size={16} color="#2a9d8f" />
              <Text style={styles.infoText}>
                Hidrômetro {item.Hidrometro.codHidrometro}
              </Text>
            </View>
            
            <View style={styles.infoGroup}>
              <Ionicons name="analytics-outline" size={16} color="#666" />
              <Text style={styles.infoText}>
                Ant.: {formatarNumeroComMilhar(item.leitura_anterior || 0)} m³
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
            
            <View style={styles.infoGroup}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.infoText} numberOfLines={1}>
                {formatarData(item.data_leitura_anterior || "")}
              </Text>
            </View>
          </View>
        </View>

        {/* Valores de Leitura */}
        <View style={styles.readingsContainer}>
          {/* Leitura Atual */}
          <View style={[styles.readingBlock, styles.highlightedReadingBlock]}>
            <Text style={styles.readingLabel}>Leitura Atual</Text>
            {isEditing ? (
              <MaskedNumberInput
                style={styles.input}
                value={leituraAtuais[item.id]}
                onChangeText={(text) =>
                  setLeituraAtuais((prev) => ({ ...prev, [item.id]: text }))
                }
                placeholder="Informe a leitura"
              />
            ) : (
              <Text style={styles.readingValue}>
                {item.Leitura
                  ? formatarNumeroComMilhar(item.Leitura.leitura) + " m³"
                  : "-"}
              </Text>
            )}
          </View>

          {/* Data Leitura Atual */}
          <View style={[styles.readingBlock, styles.highlightedReadingBlock]}>
            <Text style={styles.readingLabel}>Data Atual</Text>
            {isEditing ? (
              <View>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => showDatepicker(item.id)}
                >
                  <Text style={styles.dateButtonText}>
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
              <Text style={styles.readingValue}>
                {item.Leitura ? formatarData(item.Leitura.data_leitura) : "-"}
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
                    <Text style={styles.buttonText}>Salvar</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Modo Visualização: Botão Editar
            <TouchableOpacity
              style={[styles.editButton, { opacity: isDisabled ? 0.5 : 1 }]}
              onPress={() => handleEdit(item.id)}
              disabled={isDisabled}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={styles.buttonText}>
                {isDisabled ? "Fatura Fechada" : "Editar"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Badge */}
        {item.status === "Paga" && (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.statusText}>Paga</Text>
          </View>
        )}
        {item.status === "Vencida" && (
          <View style={[styles.statusBadge, styles.statusVencida]}>
            <Ionicons name="alert-circle" size={16} color="#fff" />
            <Text style={styles.statusText}>Vencida</Text>
          </View>
        )}
      </View>
    );
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
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/(drawer)/(tabs)/leituras')}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Detalhes de Leituras</Text>
            <Text style={styles.headerSubtitle}>{mesAnoSelecionado}</Text>
          </View>
        </View>

        {/* Campo de busca */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={22} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por lote ou cliente..."
              value={searchText}
              onChangeText={setSearchText}
              clearButtonMode="while-editing"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={filteredFaturas}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          numColumns={isTablet ? 2 : 1}
          key={isTablet ? 'two-columns' : 'one-column'}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchText ? 'Nenhuma leitura encontrada para essa busca' : 'Nenhuma leitura disponível'}
              </Text>
            </View>
          }
        />
        
        {/* Botão flutuante para scroll */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
        >
          <Ionicons name="arrow-down" size={24} color="white" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
  header: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
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
  
  // Campo de busca
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBox: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
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
  
  listContent: {
    padding: 12,
    paddingBottom: 60,
  },

  // Card redesenhado
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
    overflow: 'hidden',
  },
  
  // Cabeçalho do Card
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  loteContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  loteText: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
    flex: 1,
  },
  
  // Informações gerais
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#f9f9f9',
  },
  infoColumn: {
    flexDirection: 'column',
    gap: 6,
  },
  infoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
  },
  pendingIconContainer: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  editedIconContainer: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  
  // Container de leituras
  readingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    gap: 10,
  },
  readingBlock: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 8,
  },
  highlightedReadingBlock: {
    backgroundColor: "rgba(42, 157, 143, 0.1)",
    borderLeftWidth: 3,
    borderLeftColor: "#2a9d8f",
  },
  readingLabel: {
    fontSize: isTablet ? 13 : 12,
    color: "#2a9d8f",
    fontWeight: '500',
    marginBottom: 4,
  },
  readingValue: {
    fontSize: isTablet ? 15 : 14,
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
    fontSize: isTablet ? 15 : 13,
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
    fontSize: isTablet ? 14 : 12,
    color: "#333",
  },

  // Rodapé do Card
  cardFooter: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
    fontSize: isTablet ? 14 : 12,
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
    fontSize: isTablet ? 12 : 10,
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

  //Botão flutuante
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2a9d8f',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },
  
  // Estilos para o modo offline
  offlineBar: {
    backgroundColor: '#ff6b6b',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default LeiturasDetalhesScreen;