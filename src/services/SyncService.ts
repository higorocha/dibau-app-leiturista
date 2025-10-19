import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import axios from '../api/axiosConfig';
import Leitura from '../database/models/Leitura';
import Observacao from '../database/models/Observacao';
import ObservacaoComentario from '../database/models/ObservacaoComentario';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FaturaMes {
  mesAno: string; // Campo mudou de mes/ano separados para mesAno
  quantidadeLeituras?: number;
  valorTotal?: number;
  valorMonetario?: number;
  valorParteFixa?: number;
  volumeTotal?: number;
  dataCriacao?: string;
  leiturasInformadas?: number;
  totalLeituras?: number;
  faturas: any[]; // Campo mudou de leituras para faturas
  isAllFechada: boolean; // Campo mudou de fechada string para isAllFechada boolean
}

class SyncService {
  /**
   * Sincronizar apenas um mês específico
   */
  async syncMesEspecifico(mesAno: string): Promise<{ success: boolean; mensagem: string }> {
    try {
      const [mes, ano] = mesAno.split('/');
      
      // Buscar apenas o mês específico do servidor
      const response = await axios.get('/faturamensal/app/leituras', {
        params: { mes, ano }
      });
      
      if (!response.data || !response.data.success) {
        return { success: false, mensagem: response.data?.message || 'Erro na resposta da API' };
      }

      const faturasMeses: FaturaMes[] = response.data.data || [];

      if (faturasMeses.length === 0) {
        return { success: false, mensagem: `Nenhuma fatura encontrada para ${mesAno}` };
      }

      const faturaMes = faturasMeses[0]; // Deve ter apenas 1 resultado

      // Salvar no WatermelonDB (se aberta) ou cache (se fechada)
      if (faturaMes.isAllFechada === false) {
        await this.saveFaturasAbertasToWatermelon([faturaMes]);
      } else {
        await this.saveFaturasFechadasToCache([faturaMes]);
      }

      const qtdFaturas = faturaMes.faturas?.length || 0;
      return {
        success: true,
        mensagem: `${mesAno} atualizado - ${qtdFaturas} fatura${qtdFaturas !== 1 ? 's' : ''}`,
      };
    } catch (error: any) {
      console.error('❌ Erro na sincronização do mês:', error);
      return { success: false, mensagem: error.message || 'Erro desconhecido' };
    }
  }

  /**
   * Sincronizar leituras do servidor (todos os últimos meses)
   * - Baixa faturas abertas completas (WatermelonDB)
   * - Salva resumo de faturas fechadas (AsyncStorage para cards)
   */
  async syncLeituras(): Promise<{ success: boolean; mensagem: string }> {
    try {
      console.log('🔄 Iniciando sincronização de leituras...');

      // 1. Buscar faturas do servidor (últimos 3 meses)
      const response = await axios.get('/faturamensal/app/leituras');
      
      // DEBUG: Log detalhado da resposta
      console.log('📋 [DEBUG] Resposta completa da API:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        success: response.data?.success,
        dataLength: response.data?.data?.length || 0
      });
      
      // CORREÇÃO: Verificar estrutura da resposta como no código antigo
      if (!response.data || !response.data.success) {
        console.error('❌ API retornou erro:', response.data?.message || 'Erro desconhecido');
        console.error('📋 [DEBUG] Estrutura da resposta de erro:', response.data);
        return { success: false, mensagem: response.data?.message || 'Erro na resposta da API' };
      }

      const faturasMeses: FaturaMes[] = response.data.data || [];
      
      // DEBUG: Log dos dados recebidos
      console.log('📋 [DEBUG] Dados processados:', {
        totalFaturas: faturasMeses.length,
        amostra: faturasMeses.slice(0, 2) // Mostrar apenas 2 primeiros para debug
      });

      if (faturasMeses.length === 0) {
        console.log('⚠️ API retornou sucesso mas nenhuma fatura encontrada');
        return { success: false, mensagem: 'Nenhuma fatura encontrada no servidor' };
      }

      // 2. Separar faturas abertas e fechadas (CORREÇÃO: campo mudou)
      const faturasAbertas = faturasMeses.filter((f) => f.isAllFechada === false);
      const faturasFechadas = faturasMeses.filter((f) => f.isAllFechada === true);

      console.log(`📊 Encontradas: ${faturasAbertas.length} abertas, ${faturasFechadas.length} fechadas`);

      // 3. Salvar faturas ABERTAS no WatermelonDB
      console.log('💾 Salvando faturas abertas...');
      await this.saveFaturasAbertasToWatermelon(faturasAbertas);
      console.log('✅ Faturas abertas salvas');

      // 4. Salvar RESUMO de faturas fechadas no AsyncStorage (para cards)
      console.log('💾 Salvando resumo de fechadas...');
      await this.saveFaturasFechadasToCache(faturasFechadas);
      console.log('✅ Resumo de fechadas salvo');

      // 5. Limpar faturas que ficaram fechadas (apagar do WatermelonDB)
      console.log('🧹 Limpando faturas fechadas do WatermelonDB...');
      await this.cleanFechadasFromWatermelon(faturasFechadas);
      console.log('✅ Faturas fechadas limpas');

      // ✅ Observações já foram sincronizadas junto com as faturas em saveFaturasAbertasToWatermelon()

      // Contar total de FATURAS (não meses)
      const totalFaturasAbertas = faturasAbertas.reduce(
        (total, mes) => total + (mes.faturas?.length || 0), 
        0
      );

      const totalFaturasFechadas = faturasFechadas.reduce(
        (total, mes) => total + (mes.faturas?.length || 0), 
        0
      );

      // Montar mensagem completa e informativa com plural inteligente
      const totalMeses = faturasAbertas.length + faturasFechadas.length;
      let mensagem = '';
      
      if (faturasAbertas.length > 0 && faturasFechadas.length > 0) {
        // Tem abertas e fechadas
        mensagem = `${totalFaturasAbertas} aberta${totalFaturasAbertas !== 1 ? 's' : ''} + ${totalFaturasFechadas} fechada${totalFaturasFechadas !== 1 ? 's' : ''} - ${totalMeses} mês${totalMeses !== 1 ? 'es' : ''}`;
      } else if (faturasAbertas.length > 0) {
        // Só abertas
        mensagem = `${totalFaturasAbertas} fatura${totalFaturasAbertas !== 1 ? 's' : ''} aberta${totalFaturasAbertas !== 1 ? 's' : ''} em ${faturasAbertas.length} mês${faturasAbertas.length !== 1 ? 'es' : ''}`;
      } else if (faturasFechadas.length > 0) {
        // Só fechadas
        mensagem = `${totalFaturasFechadas} fatura${totalFaturasFechadas !== 1 ? 's' : ''} fechada${totalFaturasFechadas !== 1 ? 's' : ''} em ${faturasFechadas.length} mês${faturasFechadas.length !== 1 ? 'es' : ''}`;
      } else {
        mensagem = 'Nenhuma fatura para sincronizar';
      }

      return {
        success: true,
        mensagem,
      };
    } catch (error: any) {
      console.error('❌ Erro na sincronização:', error);
      return { success: false, mensagem: error.message || 'Erro desconhecido' };
    }
  }

  /**
   * Sincronizar observações vigentes (MÉTODO OPCIONAL - NÃO USADO AUTOMATICAMENTE)
   * 
   * ⚠️ NOTA: As observações já são sincronizadas automaticamente junto com as faturas
   * em saveFaturasAbertasToWatermelon(). Este método existe como fallback caso
   * seja necessário sincronizar observações separadamente ou atualizar manualmente.
   * 
   * - Busca observações vigentes dos lotes que estão no WatermelonDB
   * - Salva observações e comentários localmente
   * - Útil para re-sincronizar apenas observações sem baixar todas as faturas novamente
   */
  async syncObservacoes(): Promise<{ success: boolean; mensagem: string }> {
    try {
      console.log('🔄 Iniciando sincronização de observações...');

      // 1. Buscar IDs únicos de lotes que estão no banco local
      const leiturasCollection = database.get('leituras');
      const leituras = await leiturasCollection.query().fetch();

      // Extrair lote_ids únicos das leituras locais
      const loteIdsSet = new Set<number>();
      leituras.forEach((leitura) => {
        const loteId = (leitura as any).loteId;
        if (loteId) {
          loteIdsSet.add(loteId);
        }
      });

      const loteIds = Array.from(loteIdsSet);

      console.log(`📊 Encontrados ${leituras.length} leituras locais com ${loteIds.length} lotes únicos`);

      if (loteIds.length === 0) {
        console.log('⚠️ Nenhum lote encontrado localmente para sincronizar observações');
        return { success: true, mensagem: 'Nenhum lote para sincronizar observações' };
      }

      console.log(`📋 Buscando observações para ${loteIds.length} lotes: [${loteIds.join(', ')}]`);

      // 2. Buscar observações do servidor (apenas vigentes dos lotes baixados)
      const response = await axios.get('/observacoes/app/download', {
        params: {
          lote_ids: loteIds.join(','),
          status: 'vigente'
        }
      });

      if (!response.data || !response.data.success) {
        console.error('❌ API retornou erro:', response.data?.message || 'Erro desconhecido');
        return { success: false, mensagem: response.data?.message || 'Erro na resposta da API' };
      }

      const observacoesData = response.data.data || [];

      if (observacoesData.length === 0) {
        console.log('✅ Nenhuma observação vigente encontrada');
        return { success: true, mensagem: 'Nenhuma observação vigente' };
      }

      // 3. Salvar observações e comentários no WatermelonDB
      await database.write(async () => {
        const observacoesCollection = database.get('observacoes');
        const comentariosCollection = database.get('observacoes_comentarios');

        for (const obsData of observacoesData) {
          // Verificar se observação já existe
          const existing = await observacoesCollection
            .query(Q.where('server_id', obsData.id))
            .fetch();

          let observacao: any;

          if (existing.length > 0) {
            // ATUALIZAR (mas só se não foi editada localmente)
            observacao = existing[0];
            if (observacao.syncStatus === 'synced') {
              await observacao.update((record: any) => {
                this.mapObservacaoServerData(record, obsData);
                record.syncedAt = Date.now();
              });
            } else {
              observacao = existing[0]; // Manter referência para sync de comentários
            }
          } else {
            // CRIAR
            observacao = await observacoesCollection.create((record: any) => {
              this.mapObservacaoServerData(record, obsData);
              record.syncStatus = 'synced';
              record.syncedAt = Date.now();
            });
          }

          // Sincronizar comentários desta observação
          if (obsData.comentarios && Array.isArray(obsData.comentarios)) {
            for (const comData of obsData.comentarios) {
              const existingComentario = await comentariosCollection
                .query(Q.where('server_id', comData.id))
                .fetch();

              if (existingComentario.length > 0) {
                // ATUALIZAR comentário
                const comentario = existingComentario[0];
                if (comentario.syncStatus === 'synced') {
                  await comentario.update((record: any) => {
                    this.mapComentarioServerData(record, comData, observacao.id, obsData.id);
                    record.syncedAt = Date.now();
                  });
                }
              } else {
                // CRIAR comentário
                await comentariosCollection.create((record: any) => {
                  this.mapComentarioServerData(record, comData, observacao.id, obsData.id);
                  record.syncStatus = 'synced';
                  record.syncedAt = Date.now();
                });
              }
            }
          }
        }
      });

      const totalComentarios = observacoesData.reduce(
        (total: number, obs: any) => total + (obs.comentarios?.length || 0),
        0
      );

      const mensagem = `${observacoesData.length} observação${observacoesData.length !== 1 ? 'ões' : ''} + ${totalComentarios} comentário${totalComentarios !== 1 ? 's' : ''}`;

      console.log(`✅ Sincronização concluída: ${mensagem}`);

      return {
        success: true,
        mensagem,
      };
    } catch (error: any) {
      console.error('❌ Erro na sincronização de observações:', error);
      return { success: false, mensagem: error.message || 'Erro desconhecido' };
    }
  }

  /**
   * Mapear dados de observação do servidor para record WatermelonDB
   */
  private mapObservacaoServerData(record: any, obsData: any) {
    record.serverId = obsData.id;
    record.loteId = obsData.lote_id;
    record.tipo = obsData.tipo;
    record.status = obsData.status;
    record.titulo = obsData.titulo;
    record.descricao = obsData.descricao || '';
    record.usuarioCriadorId = obsData.usuario_criador_id;
    record.usuarioCriadorNome = obsData.criador?.nome || '';
    record.usuarioFinalizadorId = obsData.usuario_finalizador_id || null;
    record.usuarioFinalizadorNome = obsData.finalizador?.nome || '';
    record.dataFinalizacao = obsData.data_finalizacao ? new Date(obsData.data_finalizacao).getTime() : null;
  }

  /**
   * Mapear dados de comentário do servidor para record WatermelonDB
   */
  private mapComentarioServerData(record: any, comData: any, observacaoLocalId: string, observacaoServerId: number) {
    record.serverId = comData.id;
    record.observacaoId = observacaoLocalId; // WatermelonDB ID local
    record.observacaoServerId = observacaoServerId; // ID do servidor
    record.comentario = comData.comentario;
    record.usuarioId = comData.usuario_id;
    record.usuarioNome = comData.usuario?.nome || '';
  }

  /**
   * Salvar faturas abertas no WatermelonDB
   * ✅ Também processa e salva observações vigentes que vêm junto com as faturas
   */
  private async saveFaturasAbertasToWatermelon(faturas: FaturaMes[]) {
    await database.write(async () => {
      const leiturasCollection = database.get('leituras');
      const observacoesCollection = database.get('observacoes');
      const comentariosCollection = database.get('observacoes_comentarios');

      // Contadores para log final
      let totalObservacoes = 0;
      let totalComentarios = 0;

      for (const faturaMes of faturas) {
        // CORREÇÃO: Validar se faturas existe e é um array
        if (!faturaMes.faturas || !Array.isArray(faturaMes.faturas)) {
          console.warn(`⚠️ Faturas não encontradas ou inválidas para ${faturaMes.mesAno}`);
          continue;
        }

        for (const faturaData of faturaMes.faturas) {
          // Validar se faturaData tem ID
          if (!faturaData || !faturaData.id) {
            console.warn(`⚠️ Fatura inválida encontrada em ${faturaMes.mesAno}`);
            continue;
          }

          // Verificar se já existe
          const existing = await leiturasCollection
            .query(Q.where('server_id', faturaData.id))
            .fetch();

          if (existing.length > 0) {
            // ATUALIZAR (mas só se não foi editado localmente)
            const leitura = existing[0];
            if (leitura.syncStatus === 'synced') {
              await leitura.update((record: any) => {
                this.mapServerDataToRecord(record, faturaData, faturaMes);
                record.lastSyncAt = Date.now();
              });
              // Fatura atualizada silenciosamente
            }
          } else {
            // CRIAR
            await leiturasCollection.create((record: any) => {
              this.mapServerDataToRecord(record, faturaData, faturaMes);
              record.syncStatus = 'synced';
              record.hasLocalImage = false;
              record.lastSyncAt = Date.now();
            });
          }

          // ✅ PROCESSAR OBSERVAÇÕES que vêm junto com a fatura
          if (faturaData.LoteAgricola?.Observacoes && Array.isArray(faturaData.LoteAgricola.Observacoes)) {
            for (const obsData of faturaData.LoteAgricola.Observacoes) {
              // Verificar se observação já existe
              const existingObs = await observacoesCollection
                .query(Q.where('server_id', obsData.id))
                .fetch();

              let observacao: any;

              if (existingObs.length > 0) {
                // ATUALIZAR (mas só se não foi editada localmente)
                observacao = existingObs[0];
                if (observacao.syncStatus === 'synced') {
                  await observacao.update((record: any) => {
                    this.mapObservacaoServerData(record, obsData);
                    record.syncedAt = Date.now();
                  });
                }
              } else {
                // CRIAR
                observacao = await observacoesCollection.create((record: any) => {
                  this.mapObservacaoServerData(record, obsData);
                  record.syncStatus = 'synced';
                  record.syncedAt = Date.now();
                });
                totalObservacoes++;
              }

              // Sincronizar comentários desta observação
              if (obsData.comentarios && Array.isArray(obsData.comentarios)) {
                for (const comData of obsData.comentarios) {
                  const existingCom = await comentariosCollection
                    .query(Q.where('server_id', comData.id))
                    .fetch();

                  if (existingCom.length === 0) {
                    // CRIAR comentário
                    await comentariosCollection.create((record: any) => {
                      this.mapComentarioServerData(record, comData, observacao.id, obsData.id);
                      record.syncStatus = 'synced';
                      record.syncedAt = Date.now();
                    });
                    totalComentarios++;
                  }
                }
              }
            }
          }
        }
      }

      // Log final consolidado
      if (totalObservacoes > 0 || totalComentarios > 0) {
        console.log(`💬 Sincronizadas ${totalObservacoes} observação(ões) + ${totalComentarios} comentário(s) junto com as faturas`);
      }
    });
  }

  /**
   * Mapear dados do servidor para record WatermelonDB
   * ✅ VERSÃO SIMPLIFICADA: Apenas campos essenciais
   */
  private mapServerDataToRecord(record: any, faturaData: any, faturaMes: FaturaMes) {
    // Validar se mesAno existe
    if (!faturaMes.mesAno) {
      console.warn(`⚠️ MesAno não encontrado no mapeamento de dados`);
      return;
    }

    // Extrair mes e ano do campo mesAno "10/2025"
    const [mes, ano] = faturaMes.mesAno.split('/');

    // Validar se mês e ano são válidos
    if (!mes || !ano || isNaN(parseInt(ano))) {
      console.warn(`⚠️ MesAno inválido no mapeamento: ${faturaMes.mesAno}`);
      return;
    }

    // Mapeamento de dados da fatura para o registro local

    // ✅ IDENTIFICAÇÃO
    record.serverId = faturaData.id; // ID da fatura
    record.leituraBackendId = faturaData.Leitura?.id || null; // ✅ ID da leitura no backend (para upload de imagem)
    record.mesReferencia = mes;
    record.anoReferencia = parseInt(ano);

    // ✅ DADOS ESSENCIAIS PARA EXIBIÇÃO NA TELA
    record.loteId = faturaData.LoteAgricola?.id || 0; // ✅ ID do lote no servidor (para vincular com observações)
    record.loteNome = faturaData.LoteAgricola?.nomeLote || '';
    record.loteSituacao = faturaData.LoteAgricola?.situacao || 'Operacional';
    record.loteMapaLeitura = faturaData.LoteAgricola?.mapa_leitura || null;
    record.irriganteNome = faturaData.Cliente?.nome || '';
    record.hidrometroCodigo = faturaData.Hidrometro?.codHidrometro || 'N/D';
    record.hidrometroX10 = faturaData.Hidrometro?.x10 === true; // FLAG CRÍTICA!

    // ✅ DADOS ESSENCIAIS PARA UPLOAD
    record.leituraAtual = faturaData.Leitura?.leitura || 0;
    record.dataLeitura = faturaData.Leitura?.data_leitura || null;

    // ✅ DADOS PARA EXIBIÇÃO/COMPARAÇÃO
    record.leituraAnterior = faturaData.leitura_anterior || 0;
    record.dataLeituraAnterior = faturaData.data_leitura_anterior || null;
    
    // ✅ CORREÇÃO CRÍTICA: Calcular consumo localmente se não vier da API
    // A API pode retornar valor_leitura_m3 = 0 para leituras não informadas
    const consumoAPI = faturaData.valor_leitura_m3 || 0;
    const leituraAtualValue = faturaData.Leitura?.leitura || 0;
    const leituraAnteriorValue = faturaData.leitura_anterior || 0;
    
    // Se tiver leitura atual informada, calcular consumo
    const consumoCalculado = leituraAtualValue > 0 
      ? leituraAtualValue - leituraAnteriorValue 
      : consumoAPI;
    
    record.consumo = consumoCalculado;
    record.valorLeituraM3 = consumoCalculado;
    record.imagemUrl = faturaData.Leitura?.imagem_leitura || null;
    
    // ✅ CAMPOS DE ESTADO/STATUS
    record.fechada = faturaMes.isAllFechada ? 'Sim' : 'Não';
    record.status = faturaData.status || 'Pendente';
  }

  /**
   * Salvar RESUMO de faturas fechadas no AsyncStorage (cache visual para cards)
   */
  private async saveFaturasFechadasToCache(faturas: FaturaMes[]) {
    for (const faturaMes of faturas) {
      // Validar se mesAno existe
      if (!faturaMes.mesAno) {
        console.warn(`⚠️ MesAno não encontrado para fatura fechada`);
        continue;
      }

      // Extrair mes e ano do mesAno "10/2025"
      const [mes, ano] = faturaMes.mesAno.split('/');
      const key = `leituras_resumo_${mes}_${ano}`;
      
      // CORREÇÃO: Validar se faturas existe antes de acessar length
      const totalLeituras = faturaMes.faturas && Array.isArray(faturaMes.faturas) 
        ? faturaMes.faturas.length 
        : 0;

      const resumo = {
        mes,
        ano: parseInt(ano),
        fechada: faturaMes.isAllFechada ? 'Sim' : 'Não',
        totalLeituras,
        mesAno: faturaMes.mesAno,
        volumeTotal: faturaMes.volumeTotal || 0,
        leiturasInformadas: faturaMes.leiturasInformadas || 0,
      };
      await AsyncStorage.setItem(key, JSON.stringify(resumo));
      console.log(`💾 Resumo de ${faturaMes.mesAno} salvo no cache`);
    }

    // Salvar índice de meses fechados (filtrar apenas os válidos)
    const mesesFechados = faturas
      .filter((f) => f && f.mesAno)
      .map((f) => f.mesAno);
    await AsyncStorage.setItem('leituras_meses_fechados_index', JSON.stringify(mesesFechados));
  }

  /**
   * Limpar faturas que ficaram fechadas do WatermelonDB
   */
  private async cleanFechadasFromWatermelon(faturasFechadas: FaturaMes[]) {
    await database.write(async () => {
      const leiturasCollection = database.get('leituras');

      for (const fatura of faturasFechadas) {
        // Validar se mesAno existe
        if (!fatura.mesAno) {
          console.warn(`⚠️ MesAno não encontrado para limpeza de fatura fechada`);
          continue;
        }

        // CORREÇÃO: Extrair mês e ano do mesAno
        const [mes, ano] = fatura.mesAno.split('/');
        
        // Validar se mês e ano são válidos
        if (!mes || !ano || isNaN(parseInt(ano))) {
          console.warn(`⚠️ MesAno inválido para limpeza: ${fatura.mesAno}`);
          continue;
        }
        
        const leiturasFechadas = await leiturasCollection
          .query(
            Q.where('mes_referencia', mes),
            Q.where('ano_referencia', parseInt(ano))
          )
          .fetch();

        for (const leitura of leiturasFechadas) {
          await leitura.markAsDeleted(); // Soft delete
          console.log(`🗑️ Leitura ${(leitura as any).serverId} removida (fatura fechada)`);
        }
      }
    });
  }
}

export default new SyncService();
