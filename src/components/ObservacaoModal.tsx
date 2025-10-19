import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import Observacao from '../database/models/Observacao';
import ObservacaoComentario from '../database/models/ObservacaoComentario';
import { useAuth } from '../contexts/AuthContext';

interface ObservacaoModalProps {
  visible: boolean;
  onClose: () => void;
  loteId: number;
  loteNome?: string; // ✅ Nome do lote passado pela tela anterior
}

const { width, height } = Dimensions.get('window');

const ObservacaoModal: React.FC<ObservacaoModalProps> = ({
  visible,
  onClose,
  loteId,
  loteNome, // ✅ Recebe nome do lote da tela anterior
}) => {
  const { user } = useAuth(); // ✅ Obter usuário logado
  const [observacoes, setObservacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // ✅ Estado separado para comentário de cada observação
  const [comentariosPorObservacao, setComentariosPorObservacao] = useState<Record<string, string>>({});
  // ✅ Estado para controlar expansão dos comentários
  const [comentariosExpandidos, setComentariosExpandidos] = useState<Record<string, boolean>>({});
  const [novaObservacao, setNovaObservacao] = useState({
    tipo: 'outros',
    titulo: '',
    descricao: '',
  });

  // Carregar observações vigentes do lote
  useEffect(() => {
    console.log(`[ObservacaoModal] useEffect disparado - visible: ${visible}, loteId: ${loteId}`);
    if (visible && loteId && loteId > 0) {
      carregarObservacoes();
    } else if (visible) {
      console.warn(`[ObservacaoModal] Modal aberto mas loteId inválido: ${loteId}`);
    }
  }, [visible, loteId]);

  const carregarObservacoes = async () => {
    try {
      setLoading(true);
      console.log(`[ObservacaoModal] Carregando observações para lote ID: ${loteId}, Nome: ${loteNome}`);
      
      // ✅ Nome do lote já vem como prop - não precisa buscar no banco!
      
      const observacoesCollection = database.get('observacoes');
      
      // Buscar todas as observações do lote (debug)
      const todasObservacoes = await observacoesCollection
        .query(Q.where('lote_id', loteId))
        .fetch();
      
      console.log(`[ObservacaoModal] Total de observações do lote: ${todasObservacoes.length}`);
      todasObservacoes.forEach((obs: any) => {
        console.log(`[ObservacaoModal] Obs ID: ${obs.id}, Status: ${obs.status}, Titulo: ${obs.titulo}`);
      });
      
      // Buscar apenas vigentes
      const observacoesData = await observacoesCollection
        .query(
          Q.where('lote_id', loteId),
          Q.where('status', 'vigente')
        )
        .fetch();

      console.log(`[ObservacaoModal] Observações vigentes encontradas: ${observacoesData.length}`);

      // Para cada observação, buscar os comentários
      const observacoesComComentarios = await Promise.all(
        observacoesData.map(async (obs: any) => {
          const comentariosCollection = database.get('observacoes_comentarios');
          
          // ✅ BUSCA CORRETA: SEMPRE usar observacao_id (ID local do WatermelonDB)
          // NUNCA buscar por observacao_server_id = 0 (pega órfãos de TODAS as observações!)
          
          const comentarios = await comentariosCollection
            .query(Q.where('observacao_id', obs.id))
            .fetch();
          
          return {
            id: obs.id,
            serverId: obs.serverId,
            loteId: obs.loteId,
            tipo: obs.tipo,
            status: obs.status,
            titulo: obs.titulo,
            descricao: obs.descricao,
            usuarioCriadorNome: obs.usuarioCriadorNome,
            createdAt: obs.createdAt,
            comentarios: comentarios.map((c: any) => ({
              id: c.id,
              comentario: c.comentario,
              usuarioNome: c.usuarioNome,
              createdAt: c.createdAt,
            })),
          };
        })
      );

      console.log(`[ObservacaoModal] Total final de observações com comentários: ${observacoesComComentarios.length}`);
      setObservacoes(observacoesComComentarios);
      
      // ✅ Expandir comentários por padrão quando houver comentários
      const estadoInicial: Record<string, boolean> = {};
      observacoesComComentarios.forEach(obs => {
        if (obs.comentarios && obs.comentarios.length > 0) {
          estadoInicial[obs.id] = true; // Expandido por padrão
        }
      });
      setComentariosExpandidos(estadoInicial);
    } catch (error) {
      console.error('[ObservacaoModal] Erro ao carregar observações:', error);
      Alert.alert('Erro', 'Não foi possível carregar as observações');
    } finally {
      setLoading(false);
    }
  };

  const adicionarComentario = async (observacaoId: string) => {
    const comentarioTexto = comentariosPorObservacao[observacaoId] || '';
    
    if (!comentarioTexto.trim()) {
      Alert.alert('Atenção', 'Digite um comentário');
      return;
    }

    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    try {
      setSaving(true);
      
      const observacaoAtual = observacoes.find(o => o.id === observacaoId);
      if (!observacaoAtual) {
        throw new Error('Observação não encontrada');
      }

      // ✅ Criar comentário localmente
      const comentariosCollection = database.get('observacoes_comentarios');
      const novoComentarioRecord = await database.write(async () => {
        return await comentariosCollection.create((record: any) => {
          record.observacaoId = observacaoId;
          record.observacaoServerId = observacaoAtual.serverId || 0;
          record.comentario = comentarioTexto.trim();
          record.usuarioId = user.id; // ✅ Usar usuário real
          record.usuarioNome = user.nome; // ✅ Usar nome real
          record.syncStatus = 'local_edited';
        });
      });

      // ✅ ATUALIZAR ESTADO LOCAL IMEDIATAMENTE (sem recarregar do banco)
      const novoComentario = {
        id: (novoComentarioRecord as any).id,
        comentario: comentarioTexto.trim(),
        usuarioNome: user.nome,
        createdAt: new Date().toISOString(),
      };

      setObservacoes(prevObservacoes =>
        prevObservacoes.map(obs =>
          obs.id === observacaoId
            ? {
                ...obs,
                comentarios: [...(obs.comentarios || []), novoComentario]
              }
            : obs
        )
      );

      // ✅ Limpar input da observação específica
      setComentariosPorObservacao(prev => ({
        ...prev,
        [observacaoId]: ''
      }));
      
      // ✅ Garantir que comentários fiquem expandidos após adicionar
      setComentariosExpandidos(prev => ({
        ...prev,
        [observacaoId]: true
      }));
      
      Alert.alert('Sucesso', 'Comentário adicionado com sucesso');
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o comentário');
    } finally {
      setSaving(false);
    }
  };

  const criarObservacao = async () => {
    if (!novaObservacao.titulo.trim()) {
      Alert.alert('Atenção', 'Digite um título para a observação');
      return;
    }

    if (!novaObservacao.descricao.trim()) {
      Alert.alert('Atenção', 'Digite uma descrição para a observação');
      return;
    }

    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    try {
      setSaving(true);
      
      // Criar observação localmente
      const observacoesCollection = database.get('observacoes');
      await database.write(async () => {
        await observacoesCollection.create((record: any) => {
          record.loteId = loteId;
          record.tipo = novaObservacao.tipo;
          record.status = 'vigente';
          record.titulo = novaObservacao.titulo.trim();
          record.descricao = novaObservacao.descricao.trim();
          record.usuarioCriadorId = user.id; // ✅ Usar usuário real
          record.usuarioCriadorNome = user.nome; // ✅ Usar nome real
          record.syncStatus = 'local_edited';
          record.serverId = 0; // Será preenchido após sync
        });
      });

      // Limpar formulário
      setNovaObservacao({
        tipo: 'outros',
        titulo: '',
        descricao: '',
      });
      
      await carregarObservacoes();
      Alert.alert('Sucesso', 'Observação criada com sucesso');
    } catch (error) {
      console.error('Erro ao criar observação:', error);
      Alert.alert('Erro', 'Não foi possível criar a observação');
    } finally {
      setSaving(false);
    }
  };

  // ✅ Função auxiliar para formatar data/hora
  const formatarDataHora = (dataISO: string) => {
    try {
      const data = new Date(dataISO);
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      const hora = String(data.getHours()).padStart(2, '0');
      const min = String(data.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} às ${hora}:${min}`;
    } catch (error) {
      return 'Data inválida';
    }
  };

  // ✅ Função para alternar expansão dos comentários
  const toggleComentarios = (observacaoId: string) => {
    setComentariosExpandidos(prev => ({
      ...prev,
      [observacaoId]: !prev[observacaoId]
    }));
  };

  // ✅ Função para obter cor e label do tipo
  const getTipoBadge = (tipo: string) => {
    const tipos: Record<string, { label: string; color: string }> = {
      pendencia: { label: 'Pendência', color: '#ff4d4f' },
      vistoria: { label: 'Vistoria', color: '#1890ff' },
      outros: { label: 'Outros', color: '#8c8c8c' },
    };
    return tipos[tipo] || tipos.outros;
  };

  const renderObservacao = (observacao: any) => {
    const tipoBadge = getTipoBadge(observacao.tipo);
    
    return (
      <View key={observacao.id} style={styles.observacaoCard}>
        {/* Header: Tipo (Badge) + Título */}
        <View style={styles.observacaoHeader}>
          <View style={styles.tituloContainer}>
            <View style={[styles.tipoBadge, { backgroundColor: tipoBadge.color }]}>
              <Text style={styles.tipoTexto}>{tipoBadge.label}</Text>
            </View>
            <Text style={styles.observacaoTitulo} numberOfLines={2}>
              {observacao.titulo}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Vigente</Text>
          </View>
        </View>
        
        {/* ✅ Ocultar descrição se estiver vazia */}
        {observacao.descricao && observacao.descricao.trim() && (
          <Text style={styles.observacaoDescricao}>{observacao.descricao}</Text>
        )}
        
        <View style={[
          styles.observacaoFooter,
          (!observacao.descricao || !observacao.descricao.trim()) && styles.observacaoFooterSemDescricao
        ]}>
          <Text style={styles.observacaoMetadata}>
            Criada por: {observacao.usuarioCriadorNome || 'Usuário'}
          </Text>
          {observacao.createdAt && (
            <Text style={styles.observacaoMetadata}>
              {formatarDataHora(observacao.createdAt)}
            </Text>
          )}
        </View>
        
        {/* Label "Comentários" clicável para expandir/colapsar */}
        <TouchableOpacity 
          style={styles.comentariosLabelContainer}
          onPress={() => toggleComentarios(observacao.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubbles-outline" size={14} color="#666" />
          <Text style={styles.comentariosLabel}>
            Comentários {observacao.comentarios?.length > 0 ? `(${observacao.comentarios.length})` : ''}
          </Text>
          <Ionicons 
            name={comentariosExpandidos[observacao.id] ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#666" 
            style={styles.chevronIcon}
          />
        </TouchableOpacity>
        
        {/* Divider fino */}
        <View style={styles.divider} />
        
        {/* Lista de comentários (colapsável) */}
        {comentariosExpandidos[observacao.id] && observacao.comentarios && observacao.comentarios.length > 0 && (
          <View style={styles.comentariosLista}>
            {observacao.comentarios.map((comentario: any, index: number) => (
              <View key={comentario.id || index} style={styles.comentarioItem}>
                <View style={styles.comentarioHeader}>
                  <Ionicons name="person-circle-outline" size={14} color="#1890ff" />
                  <Text style={styles.comentarioAutor}>
                    {comentario.usuarioNome || 'Usuário'}
                  </Text>
                  {comentario.createdAt && (
                    <Text style={styles.comentarioData}>
                      • {formatarDataHora(comentario.createdAt)}
                    </Text>
                  )}
                </View>
                <Text style={styles.comentarioTexto}>{comentario.comentario}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Formulário para novo comentário */}
        <View style={styles.novoComentarioContainer}>
          <TextInput
            style={styles.comentarioInput}
            placeholder="Adicionar comentário..."
            value={comentariosPorObservacao[observacao.id] || ''}
            onChangeText={(text) => {
              setComentariosPorObservacao(prev => ({
                ...prev,
                [observacao.id]: text
              }));
            }}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.botaoComentario, saving && styles.botaoDesabilitado]}
            onPress={() => adicionarComentario(observacao.id)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={styles.botaoTexto}>Adicionar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNovaObservacao = () => (
    <View style={styles.novaObservacaoCard}>
      <Text style={styles.novaObservacaoTitulo}>Nova Observação</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Tipo:</Text>
        <View style={styles.tipoContainer}>
          {[
            { value: 'pendencia', label: 'Pendência' },
            { value: 'vistoria', label: 'Vistoria' },
            { value: 'outros', label: 'Outros' }
          ].map((tipo) => (
            <TouchableOpacity
              key={tipo.value}
              style={[
                styles.tipoBotao,
                novaObservacao.tipo === tipo.value && styles.tipoBotaoSelecionado
              ]}
              onPress={() => setNovaObservacao({ ...novaObservacao, tipo: tipo.value })}
            >
              <Text style={[
                styles.tipoTextoForm,
                novaObservacao.tipo === tipo.value && styles.tipoTextoSelecionado
              ]}>
                {tipo.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Título:</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite o título da observação"
          value={novaObservacao.titulo}
          onChangeText={(text) => setNovaObservacao({ ...novaObservacao, titulo: text })}
          maxLength={100}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Descrição:</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Digite a descrição da observação"
          value={novaObservacao.descricao}
          onChangeText={(text) => setNovaObservacao({ ...novaObservacao, descricao: text })}
          multiline
          maxLength={1000}
        />
      </View>

      <TouchableOpacity
        style={[styles.botaoCriar, saving && styles.botaoDesabilitado]}
        onPress={criarObservacao}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.botaoTexto}>Criar Observação</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.botaoFechar} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.titulo}>
            Observações - {loteNome || `Lote ${loteId}`}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890ff" />
              <Text style={styles.loadingText}>Carregando observações...</Text>
            </View>
          ) : (
            <>
              {/* Observações vigentes */}
              {observacoes.length > 0 && (
                <View style={styles.secao}>
                  <Text style={styles.secaoTitulo}>
                    Observações Vigentes ({observacoes.length})
                  </Text>
                  {observacoes.map(renderObservacao)}
                </View>
              )}

              {/* Formulário para nova observação */}
              {observacoes.length === 0 && renderNovaObservacao()}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  botaoFechar: {
    padding: 8,
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  secao: {
    marginBottom: 24,
  },
  secaoTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  observacaoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#faad14',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  observacaoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tituloContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tipoTexto: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  observacaoTitulo: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    backgroundColor: '#faad14',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  observacaoDescricao: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  observacaoFooter: {
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  observacaoFooterSemDescricao: {
    marginTop: 12,
  },
  observacaoMetadata: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  comentariosLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingVertical: 4,
  },
  comentariosLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  chevronIcon: {
    marginLeft: 'auto',
  },
  divider: {
    height: 1,
    backgroundColor: '#e8e8e8',
    marginBottom: 12,
  },
  comentariosLista: {
    marginBottom: 12,
  },
  comentarioItem: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1890ff',
  },
  comentarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  comentarioTexto: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  comentarioAutor: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  comentarioData: {
    fontSize: 11,
    color: '#999',
  },
  novoComentarioContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  comentarioInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 40,
    maxHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  botaoComentario: {
    backgroundColor: '#1890ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 90,
  },
  novaObservacaoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  novaObservacaoTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  tipoContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tipoBotao: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    backgroundColor: '#fff',
  },
  tipoBotaoSelecionado: {
    backgroundColor: '#1890ff',
    borderColor: '#1890ff',
  },
  tipoTextoForm: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  tipoTextoSelecionado: {
    color: '#fff',
  },
  botaoCriar: {
    backgroundColor: '#52c41a',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  botaoTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ObservacaoModal;
