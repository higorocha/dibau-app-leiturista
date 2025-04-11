// src/components/leituras/LeituraCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatarNumeroComMilhar } from '@/src/utils/formatters';

// Verificar se é tablet
const { width } = Dimensions.get('window');
const isTablet = width > 600;

// Interface para as propriedades do componente
interface LeituraCardProps {
  mesAno: string;
  leiturasInformadas: number;
  totalLeituras: number;
  volumeTotal: number;
  dataCriacao: string;
  faturas: any[];
  onPress: () => void;
  isEmpty?: boolean;
}

// Função auxiliar para formatar o mês/ano
const formatMesAno = (mesAno: string): string => {
  const [mes, ano] = mesAno.split('/');
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 
    'Maio', 'Junho', 'Julho', 'Agosto', 
    'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  return `${meses[parseInt(mes) - 1]} de ${ano}`;
};

const LeituraCard: React.FC<LeituraCardProps> = ({
  mesAno,
  leiturasInformadas,
  totalLeituras,
  volumeTotal,
  dataCriacao,
  faturas,
  onPress,
  isEmpty = false
}) => {
  // Verificar se é um card vazio
  if (isEmpty) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>
          Nenhuma leitura cadastrada. Utilize o sistema web para adicionar leituras.
        </Text>
      </View>
    );
  }

  // Formatar data de criação
  const dataFormatada = new Date(dataCriacao).toLocaleDateString('pt-BR');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>Leituras {formatMesAno(mesAno)}</Text>
        <Text style={styles.subtitle}>Criado em: {dataFormatada}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name="document-text-outline" 
              size={isTablet ? 32 : 28} 
              color="#2a9d8f" 
            />
          </View>
          <Text style={styles.statLabel}>Quantidade de Leituras</Text>
          <Text style={styles.statValue}>{leiturasInformadas}/{totalLeituras}</Text>
        </View>

        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name="water-outline" 
              size={isTablet ? 32 : 28} 
              color="#2a9d8f" 
            />
          </View>
          <Text style={styles.statLabel}>Volume Total (m³)</Text>
          <Text style={styles.statValue}>{formatarNumeroComMilhar(volumeTotal)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: isTablet ? 24 : 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cardHeader: {
    marginBottom: 20,
  },
  title: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: isTablet ? 14 : 12,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  statItem: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  iconContainer: {
    backgroundColor: 'rgba(42, 157, 143, 0.1)',
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: isTablet ? 30 : 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  statValue: {
    fontSize: isTablet ? 22 : 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default LeituraCard;