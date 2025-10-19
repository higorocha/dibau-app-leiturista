// src/utils/databaseDebug.ts - Debug helper para WatermelonDB
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import Leitura from '../database/models/Leitura';
import Imagem from '../database/models/Imagem';
import Log from '../database/models/Log';
import Observacao from '../database/models/Observacao';
import ObservacaoComentario from '../database/models/ObservacaoComentario';

class DatabaseDebugger {
  /**
   * Mostrar todas as leituras
   */
  async showLeituras() {
    try {
      const leituras = await database.get('leituras').query().fetch() as Leitura[];
      console.log('\n📊 === LEITURAS ===');
      console.table(leituras.map(l => ({
        // ✅ IDENTIFICAÇÃO
        ID: l.id,
        ServerID: l.serverId,
        LeituraBackendID: l.leituraBackendId || 'N/A',
        MesRef: l.mesReferencia,
        AnoRef: l.anoReferencia,
        
        // ✅ DADOS PARA EXIBIÇÃO
        LoteID: l.loteId,
        Lote: l.loteNome,
        LoteSituacao: l.loteSituacao,
        MapaLeitura: l.loteMapaLeitura || 'N/A',
        Irrigante: l.irriganteNome,
        Hidrometro: l.hidrometroCodigo,
        X10: l.hidrometroX10 ? 'SIM' : 'NÃO',
        
        // ✅ DADOS DE LEITURA
        LeituraAtual: l.leituraAtual,
        DataLeitura: l.dataLeitura || 'N/A',
        LeituraAnterior: l.leituraAnterior,
        DataLeitAnt: l.dataLeituraAnterior || 'N/A',
        Consumo: l.consumo,
        ValorM3: l.valorLeituraM3,
        
        // ✅ ESTADO/STATUS
        Fechada: l.fechada,
        Status: l.status,
        
        // ✅ IMAGEM
        ImagemUrl: l.imagemUrl?.substring(l.imagemUrl.lastIndexOf('/') + 1) || 'N/A',
        HasLocalImage: l.hasLocalImage ? 'SIM' : 'NÃO',
        
        // ✅ SINCRONIZAÇÃO
        SyncStatus: l.syncStatus.toUpperCase(),
        LastSync: l.lastSyncAt ? new Date(l.lastSyncAt).toLocaleString('pt-BR') : 'N/A',
        ErrorMsg: l.errorMessage?.substring(0, 30) + '...' || 'Nenhum',
        
        // ✅ TIMESTAMPS
        CriadoEm: l.createdAt.toLocaleString('pt-BR'),
        AtualizadoEm: l.updatedAt.toLocaleString('pt-BR')
      })));
      console.log(`\n📊 Total: ${leituras.length} leituras`);
      return leituras;
    } catch (error) {
      console.error('Erro ao buscar leituras:', error);
    }
  }

  /**
   * Mostrar todas as imagens
   */
  async showImagens() {
    try {
      const imagens = await database.get('imagens').query().fetch() as Imagem[];
      console.log('\n📸 === IMAGENS ===');
      console.table(imagens.map(i => ({
        // ✅ IDENTIFICAÇÃO
        ID: i.id,
        LeituraID: i.leituraId,
        LeituraServerID: i.leituraServerId,
        LeituraBackendID: i.leituraBackendId || 'N/A',
        
        // ✅ ARQUIVO
        LocalUri: i.localUri?.substring(i.localUri.lastIndexOf('/') + 1) || 'N/A',
        FileSize: i.fileSize ? `${(i.fileSize / 1024).toFixed(1)} KB` : 'N/A',
        MimeType: i.mimeType || 'N/A',
        
        // ✅ SINCRONIZAÇÃO
        SyncStatus: i.syncStatus.toUpperCase(),
        UploadedUrl: i.uploadedUrl?.substring(i.uploadedUrl.lastIndexOf('/') + 1) || 'N/A',
        ErrorMsg: i.errorMessage?.substring(0, 30) + '...' || 'Nenhum',
        
        // ✅ TIMESTAMPS
        CriadoEm: i.createdAt.toLocaleString('pt-BR'),
        AtualizadoEm: i.updatedAt.toLocaleString('pt-BR')
      })));
      console.log(`\n📸 Total: ${imagens.length} imagens`);
      return imagens;
    } catch (error) {
      console.error('Erro ao buscar imagens:', error);
    }
  }

  /**
   * Mostrar todos os logs
   */
  async showLogs() {
    try {
      const logs = await database.get('logs').query().fetch() as Log[];
      console.log('\n📝 === LOGS ===');
      console.table(logs.map(l => ({
        // ✅ IDENTIFICAÇÃO
        ID: l.id,
        Level: l.level.toUpperCase(),
        Category: l.category.toUpperCase(),
        
        // ✅ CONTEÚDO
        Message: l.message.substring(0, 50) + '...',
        Details: l.details ? l.details.substring(0, 30) + '...' : 'N/A',
        
        // ✅ CONTEXTO
        DeviceInfo: l.deviceInfo ? l.deviceInfo.substring(0, 25) + '...' : 'N/A',
        AppVersion: l.appVersion || 'N/A',
        UserEmail: l.userEmail || 'N/A',
        
        // ✅ SINCRONIZAÇÃO
        SyncStatus: l.syncStatus.toUpperCase(),
        ErrorMsg: l.errorMessage?.substring(0, 30) + '...' || 'Nenhum',
        
        // ✅ TIMESTAMPS
        CriadoEm: l.createdAt.toLocaleString('pt-BR'),
        AtualizadoEm: l.updatedAt.toLocaleString('pt-BR')
      })));
      console.log(`\n📝 Total: ${logs.length} logs`);
      return logs;
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    }
  }

  /**
   * Mostrar todas as observações
   */
  async showObservacoes() {
    try {
      const observacoes = await database.get('observacoes').query().fetch() as Observacao[];
      console.log('\n💬 === OBSERVAÇÕES ===');
      console.table(observacoes.map(o => ({
        // ✅ IDENTIFICAÇÃO
        ID: o.id,
        ServerID: o.serverId,
        LoteID: o.loteId,
        
        // ✅ CONTEÚDO
        Tipo: o.tipo.toUpperCase(),
        Status: o.status.toUpperCase(),
        Titulo: o.titulo.substring(0, 30) + (o.titulo.length > 30 ? '...' : ''),
        Descricao: o.descricao?.substring(0, 30) + (o.descricao && o.descricao.length > 30 ? '...' : '') || 'N/A',
        
        // ✅ USUÁRIOS
        CriadoPor: o.usuarioCriadorNome || `ID: ${o.usuarioCriadorId}`,
        FinalizadoPor: o.usuarioFinalizadorNome || (o.usuarioFinalizadorId ? `ID: ${o.usuarioFinalizadorId}` : 'N/A'),
        DataFinal: o.dataFinalizacao ? new Date(o.dataFinalizacao).toLocaleDateString('pt-BR') : 'N/A',
        
        // ✅ SINCRONIZAÇÃO
        SyncStatus: o.syncStatus.toUpperCase(),
        LastSync: o.syncedAt ? new Date(o.syncedAt).toLocaleString('pt-BR') : 'N/A',
        ErrorMsg: o.errorMessage?.substring(0, 30) + '...' || 'Nenhum',
        
        // ✅ TIMESTAMPS
        CriadoEm: o.createdAt.toLocaleString('pt-BR'),
        AtualizadoEm: o.updatedAt.toLocaleString('pt-BR')
      })));
      console.log(`\n💬 Total: ${observacoes.length} observações`);
      return observacoes;
    } catch (error) {
      console.error('Erro ao buscar observações:', error);
    }
  }

  /**
   * Mostrar todos os comentários de observações
   */
  async showComentarios() {
    try {
      const comentarios = await database.get('observacoes_comentarios').query().fetch() as ObservacaoComentario[];
      console.log('\n💭 === COMENTÁRIOS ===');
      console.table(comentarios.map(c => ({
        // ✅ IDENTIFICAÇÃO
        ID: c.id,
        ServerID: c.serverId,
        ObservacaoID: c.observacaoServerId,
        
        // ✅ CONTEÚDO
        Comentario: c.comentario.substring(0, 50) + (c.comentario.length > 50 ? '...' : ''),
        
        // ✅ USUÁRIO
        Usuario: c.usuarioNome || `ID: ${c.usuarioId}`,
        
        // ✅ SINCRONIZAÇÃO
        SyncStatus: c.syncStatus.toUpperCase(),
        LastSync: c.syncedAt ? new Date(c.syncedAt).toLocaleString('pt-BR') : 'N/A',
        ErrorMsg: c.errorMessage?.substring(0, 30) + '...' || 'Nenhum',
        
        // ✅ TIMESTAMPS
        CriadoEm: c.createdAt.toLocaleString('pt-BR'),
        AtualizadoEm: c.updatedAt.toLocaleString('pt-BR')
      })));
      console.log(`\n💭 Total: ${comentarios.length} comentários`);
      return comentarios;
    } catch (error) {
      console.error('Erro ao buscar comentários:', error);
    }
  }

  /**
   * Mostrar detalhes de uma observação específica com seus comentários
   */
  async showObservacaoDetalhes(observacaoId: string) {
    try {
      const observacao = await database.get('observacoes').find(observacaoId) as Observacao;
      const comentarios = await observacao.comentarios.fetch();
      
      console.log('\n💬 === DETALHES OBSERVAÇÃO ===');
      console.log('🆔 IDENTIFICAÇÃO:');
      console.log(`  ID: ${observacao.id}`);
      console.log(`  Server ID: ${observacao.serverId}`);
      console.log(`  Lote ID: ${observacao.loteId}`);
      
      console.log('\n📝 CONTEÚDO:');
      console.log(`  Tipo: ${observacao.tipo.toUpperCase()}`);
      console.log(`  Status: ${observacao.status.toUpperCase()}`);
      console.log(`  Título: ${observacao.titulo}`);
      console.log(`  Descrição: ${observacao.descricao || 'N/A'}`);
      
      console.log('\n👥 USUÁRIOS:');
      console.log(`  Criado por: ${observacao.usuarioCriadorNome || `ID: ${observacao.usuarioCriadorId}`}`);
      console.log(`  Finalizado por: ${observacao.usuarioFinalizadorNome || (observacao.usuarioFinalizadorId ? `ID: ${observacao.usuarioFinalizadorId}` : 'N/A')}`);
      console.log(`  Data Finalização: ${observacao.dataFinalizacao ? new Date(observacao.dataFinalizacao).toLocaleString('pt-BR') : 'N/A'}`);
      
      console.log('\n🔄 SINCRONIZAÇÃO:');
      console.log(`  Status Sync: ${observacao.syncStatus.toUpperCase()}`);
      console.log(`  Último Sync: ${observacao.syncedAt ? new Date(observacao.syncedAt).toLocaleString('pt-BR') : 'N/A'}`);
      console.log(`  Mensagem Erro: ${observacao.errorMessage || 'Nenhuma'}`);
      
      console.log('\n⏰ TIMESTAMPS:');
      console.log(`  Criado em: ${observacao.createdAt.toLocaleString('pt-BR')}`);
      console.log(`  Atualizado em: ${observacao.updatedAt.toLocaleString('pt-BR')}`);
      
      console.log(`\n💭 COMENTÁRIOS (${comentarios.length}):`);
      if (comentarios.length > 0) {
        comentarios.forEach((c, index) => {
          console.log(`\n  [${index + 1}] ${c.usuarioNome || `ID: ${c.usuarioId}`} - ${c.createdAt.toLocaleString('pt-BR')}`);
          console.log(`      ${c.comentario}`);
          console.log(`      Sync: ${c.syncStatus.toUpperCase()}`);
        });
      } else {
        console.log('  Nenhum comentário');
      }
      
      return { observacao, comentarios };
    } catch (error) {
      console.error('Erro ao buscar observação:', error);
    }
  }

  /**
   * Mostrar resumo geral
   */
  async showSummary() {
    try {
      const leituras = await database.get('leituras').query().fetchCount();
      const imagens = await database.get('imagens').query().fetchCount();
      const logs = await database.get('logs').query().fetchCount();
      const observacoes = await database.get('observacoes').query().fetchCount();
      const comentarios = await database.get('observacoes_comentarios').query().fetchCount();

      console.log('\n🎯 === RESUMO DATABASE ===');
      console.log(`📊 Leituras: ${leituras}`);
      console.log(`📸 Imagens: ${imagens}`);
      console.log(`📝 Logs: ${logs}`);
      console.log(`💬 Observações: ${observacoes}`);
      console.log(`💭 Comentários: ${comentarios}`);
      console.log(`💾 Total registros: ${leituras + imagens + logs + observacoes + comentarios}`);

      // ✅ Status de sincronização DETALHADO para LEITURAS
      const leiturasSynced = await database.get('leituras')
        .query(Q.where('sync_status', 'synced'))
        .fetchCount();
      const leiturasLocalEditadas = await database.get('leituras')
        .query(Q.where('sync_status', 'local_edited'))
        .fetchCount();
      const leiturasUploading = await database.get('leituras')
        .query(Q.where('sync_status', 'uploading'))
        .fetchCount();
      const leiturasError = await database.get('leituras')
        .query(Q.where('sync_status', 'error'))
        .fetchCount();

      // ✅ Status de sincronização DETALHADO para IMAGENS
      const imagensSynced = await database.get('imagens')
        .query(Q.where('sync_status', 'synced'))
        .fetchCount();
      const imagensUploading = await database.get('imagens')
        .query(Q.where('sync_status', 'uploading'))
        .fetchCount();
      const imagensError = await database.get('imagens')
        .query(Q.where('sync_status', 'error'))
        .fetchCount();

      // ✅ Status de sincronização DETALHADO para LOGS
      const logsPending = await database.get('logs')
        .query(Q.where('sync_status', 'pending'))
        .fetchCount();
      const logsUploading = await database.get('logs')
        .query(Q.where('sync_status', 'uploading'))
        .fetchCount();
      const logsSynced = await database.get('logs')
        .query(Q.where('sync_status', 'synced'))
        .fetchCount();
      const logsError = await database.get('logs')
        .query(Q.where('sync_status', 'error'))
        .fetchCount();
      
      console.log('\n🔄 === STATUS SINCRONIZAÇÃO DETALHADO ===');
      console.log('\n📊 LEITURAS:');
      console.log(`  ✅ Sincronizadas: ${leiturasSynced}`);
      console.log(`  ✏️ Editadas localmente: ${leiturasLocalEditadas}`);
      console.log(`  ⬆️ Enviando: ${leiturasUploading}`);
      console.log(`  ❌ Com erro: ${leiturasError}`);
      
      console.log('\n📸 IMAGENS:');
      console.log(`  ✅ Sincronizadas: ${imagensSynced}`);
      console.log(`  ⬆️ Enviando: ${imagensUploading}`);
      console.log(`  ❌ Com erro: ${imagensError}`);
      
      console.log('\n📝 LOGS:');
      console.log(`  ⏳ Pendentes: ${logsPending}`);
      console.log(`  ⬆️ Enviando: ${logsUploading}`);
      console.log(`  ✅ Sincronizados: ${logsSynced}`);
      console.log(`  ❌ Com erro: ${logsError}`);

      // ✅ Status de sincronização DETALHADO para OBSERVAÇÕES
      const observacoesSynced = await database.get('observacoes')
        .query(Q.where('sync_status', 'synced'))
        .fetchCount();
      const observacoesLocalEditadas = await database.get('observacoes')
        .query(Q.where('sync_status', 'local_edited'))
        .fetchCount();
      const observacoesUploading = await database.get('observacoes')
        .query(Q.where('sync_status', 'uploading'))
        .fetchCount();
      const observacoesError = await database.get('observacoes')
        .query(Q.where('sync_status', 'error'))
        .fetchCount();

      // ✅ Status de sincronização DETALHADO para COMENTÁRIOS
      const comentariosSynced = await database.get('observacoes_comentarios')
        .query(Q.where('sync_status', 'synced'))
        .fetchCount();
      const comentariosLocalEditados = await database.get('observacoes_comentarios')
        .query(Q.where('sync_status', 'local_edited'))
        .fetchCount();
      const comentariosUploading = await database.get('observacoes_comentarios')
        .query(Q.where('sync_status', 'uploading'))
        .fetchCount();
      const comentariosError = await database.get('observacoes_comentarios')
        .query(Q.where('sync_status', 'error'))
        .fetchCount();
      
      console.log('\n💬 OBSERVAÇÕES:');
      console.log(`  ✅ Sincronizadas: ${observacoesSynced}`);
      console.log(`  ✏️ Editadas localmente: ${observacoesLocalEditadas}`);
      console.log(`  ⬆️ Enviando: ${observacoesUploading}`);
      console.log(`  ❌ Com erro: ${observacoesError}`);
      
      console.log('\n💭 COMENTÁRIOS:');
      console.log(`  ✅ Sincronizados: ${comentariosSynced}`);
      console.log(`  ✏️ Editados localmente: ${comentariosLocalEditados}`);
      console.log(`  ⬆️ Enviando: ${comentariosUploading}`);
      console.log(`  ❌ Com erro: ${comentariosError}`);

      // ✅ Calcular totais por status
      const totalPendentes = leiturasLocalEditadas + logsPending + observacoesLocalEditadas + comentariosLocalEditados;
      const totalUploadingCalc = leiturasUploading + imagensUploading + logsUploading + observacoesUploading + comentariosUploading;
      const totalSynced = leiturasSynced + imagensSynced + logsSynced + observacoesSynced + comentariosSynced;

      // ⚠️ AVISO: Itens presos em 'uploading'
      if (totalUploadingCalc > 0) {
        console.log('\n⚠️  === ATENÇÃO: ITENS PRESOS EM "UPLOADING" ===');
        console.log(`🚨 Encontrados ${totalUploadingCalc} itens que podem estar presos!`);
        console.log('💡 Isso acontece quando o upload é interrompido antes de concluir.');
        console.log('🔧 Para resetar esses itens, execute: dbDebug.resetUploadingStatus()');
      }
      const totalErros = leiturasError + imagensError + logsError + observacoesError + comentariosError;

      console.log('\n🎲 === TOTAIS GERAIS ===');
      console.log(`⏳ Total pendentes: ${totalPendentes}`);
      console.log(`⬆️ Total enviando: ${totalUploadingCalc}`);
      console.log(`✅ Total sincronizados: ${totalSynced}`);
      console.log(`❌ Total com erro: ${totalErros}`);

    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
    }
  }

  /**
   * Mostrar detalhes completos de uma leitura específica
   */
  async showLeituraDetalhes(leituraId: string) {
    try {
      const leitura = await database.get('leituras').find(leituraId) as Leitura;
      
      console.log('\n📊 === DETALHES LEITURA ===');
      console.log('🆔 IDENTIFICAÇÃO:');
      console.log(`  ID: ${leitura.id}`);
      console.log(`  Server ID: ${leitura.serverId}`);
      console.log(`  Leitura Backend ID: ${leitura.leituraBackendId || 'N/A'}`);
      console.log(`  Mês Referência: ${leitura.mesReferencia}`);
      console.log(`  Ano Referência: ${leitura.anoReferencia}`);
      
      console.log('\n🏠 DADOS PARA EXIBIÇÃO:');
      console.log(`  Lote ID: ${leitura.loteId}`);
      console.log(`  Lote: ${leitura.loteNome}`);
      console.log(`  Situação Lote: ${leitura.loteSituacao}`);
      console.log(`  Mapa de Leitura: ${leitura.loteMapaLeitura || 'N/A'}`);
      console.log(`  Irrigante: ${leitura.irriganteNome}`);
      console.log(`  Hidrômetro: ${leitura.hidrometroCodigo}`);
      console.log(`  X10: ${leitura.hidrometroX10 ? 'SIM' : 'NÃO'}`);
      
      console.log('\n💧 DADOS DE LEITURA:');
      console.log(`  Leitura Atual: ${leitura.leituraAtual}`);
      console.log(`  Data Leitura: ${leitura.dataLeitura || 'N/A'}`);
      console.log(`  Leitura Anterior: ${leitura.leituraAnterior}`);
      console.log(`  Data Leitura Anterior: ${leitura.dataLeituraAnterior || 'N/A'}`);
      console.log(`  Consumo: ${leitura.consumo}`);
      console.log(`  Valor M³: ${leitura.valorLeituraM3}`);
      
      console.log('\n⚡ ESTADO/STATUS:');
      console.log(`  Fechada: ${leitura.fechada}`);
      console.log(`  Status: ${leitura.status}`);
      
      console.log('\n📸 IMAGEM:');
      console.log(`  URL Imagem: ${leitura.imagemUrl || 'N/A'}`);
      console.log(`  Tem Imagem Local: ${leitura.hasLocalImage ? 'SIM' : 'NÃO'}`);
      
      console.log('\n🔄 SINCRONIZAÇÃO:');
      console.log(`  Status Sync: ${leitura.syncStatus.toUpperCase()}`);
      console.log(`  Último Sync: ${leitura.lastSyncAt ? new Date(leitura.lastSyncAt).toLocaleString('pt-BR') : 'N/A'}`);
      console.log(`  Mensagem Erro: ${leitura.errorMessage || 'Nenhuma'}`);
      
      console.log('\n⏰ TIMESTAMPS:');
      console.log(`  Criado em: ${leitura.createdAt.toLocaleString('pt-BR')}`);
      console.log(`  Atualizado em: ${leitura.updatedAt.toLocaleString('pt-BR')}`);
      
      return leitura;
    } catch (error) {
      console.error('Erro ao buscar leitura:', error);
    }
  }

  /**
   * Mostrar detalhes completos de uma imagem específica
   */
  async showImagemDetalhes(imagemId: string) {
    try {
      const imagem = await database.get('imagens').find(imagemId) as Imagem;
      
      console.log('\n📸 === DETALHES IMAGEM ===');
      console.log('🆔 IDENTIFICAÇÃO:');
      console.log(`  ID: ${imagem.id}`);
      console.log(`  Leitura ID: ${imagem.leituraId}`);
      console.log(`  Leitura Server ID: ${imagem.leituraServerId}`);
      console.log(`  Leitura Backend ID: ${imagem.leituraBackendId || 'N/A'}`);
      
      console.log('\n📁 ARQUIVO:');
      console.log(`  URI Local: ${imagem.localUri}`);
      console.log(`  Tamanho: ${(imagem.fileSize / 1024).toFixed(1)} KB`);
      console.log(`  Tipo MIME: ${imagem.mimeType}`);
      
      console.log('\n🔄 SINCRONIZAÇÃO:');
      console.log(`  Status Sync: ${imagem.syncStatus.toUpperCase()}`);
      console.log(`  URL Upload: ${imagem.uploadedUrl || 'N/A'}`);
      console.log(`  Mensagem Erro: ${imagem.errorMessage || 'Nenhuma'}`);
      
      console.log('\n⏰ TIMESTAMPS:');
      console.log(`  Criado em: ${imagem.createdAt.toLocaleString('pt-BR')}`);
      console.log(`  Atualizado em: ${imagem.updatedAt.toLocaleString('pt-BR')}`);
      
      return imagem;
    } catch (error) {
      console.error('Erro ao buscar imagem:', error);
    }
  }

  /**
   * Mostrar detalhes completos de um log específico
   */
  async showLogDetalhes(logId: string) {
    try {
      const log = await database.get('logs').find(logId) as Log;
      
      console.log('\n📝 === DETALHES LOG ===');
      console.log('🆔 IDENTIFICAÇÃO:');
      console.log(`  ID: ${log.id}`);
      console.log(`  Level: ${log.level.toUpperCase()}`);
      console.log(`  Categoria: ${log.category.toUpperCase()}`);
      
      console.log('\n📄 CONTEÚDO:');
      console.log(`  Mensagem: ${log.message}`);
      console.log(`  Detalhes: ${log.details || 'N/A'}`);
      
      console.log('\n📱 CONTEXTO:');
      console.log(`  Info Device: ${log.deviceInfo || 'N/A'}`);
      console.log(`  Versão App: ${log.appVersion || 'N/A'}`);
      console.log(`  Email Usuário: ${log.userEmail || 'N/A'}`);
      
      console.log('\n🔄 SINCRONIZAÇÃO:');
      console.log(`  Status Sync: ${log.syncStatus.toUpperCase()}`);
      console.log(`  Mensagem Erro: ${log.errorMessage || 'Nenhuma'}`);
      
      console.log('\n⏰ TIMESTAMPS:');
      console.log(`  Criado em: ${log.createdAt.toLocaleString('pt-BR')}`);
      console.log(`  Atualizado em: ${log.updatedAt.toLocaleString('pt-BR')}`);
      
      return log;
    } catch (error) {
      console.error('Erro ao buscar log:', error);
    }
  }

  /**
   * ✅ FUNÇÃO DE SEGURANÇA: Resetar itens presos em 'uploading'
   * Corrige itens que ficaram em 'uploading' devido a falhas no upload
   */
  async resetUploadingStatus() {
    try {
      console.log('🔄 Resetando status de itens presos em "uploading"...\n');
      
      const collections = [
        { name: 'leituras', label: 'Leituras' },
        { name: 'imagens', label: 'Imagens' },
        { name: 'observacoes', label: 'Observações' },
        { name: 'observacoes_comentarios', label: 'Comentários' },
      ];

      let totalResetados = 0;

      for (const { name, label } of collections) {
        const collection = database.get(name);
        const itensPresos = await collection
          .query(Q.where('sync_status', 'uploading'))
          .fetch();

        if (itensPresos.length > 0) {
          console.log(`📌 ${label}: ${itensPresos.length} itens presos em "uploading"`);
          
          await database.write(async () => {
            for (const item of itensPresos) {
              await item.update((record: any) => {
                record.syncStatus = 'error';
                record.errorMessage = 'Upload interrompido - resetado manualmente';
              });
            }
          });

          totalResetados += itensPresos.length;
          console.log(`✅ ${label}: ${itensPresos.length} itens resetados para 'error'\n`);
        }
      }

      if (totalResetados === 0) {
        console.log('✅ Nenhum item preso em "uploading" foi encontrado!');
      } else {
        console.log(`✅ Total de ${totalResetados} itens resetados com sucesso!`);
        console.log('💡 Agora você pode tentar fazer upload novamente.');
      }
    } catch (error) {
      console.error('❌ Erro ao resetar status:', error);
    }
  }

  /**
   * Limpar todos os dados (para testes)
   */
  async clearAll() {
    try {
      await database.write(async () => {
        // Buscar todos os registros
        const leituras = await database.get('leituras').query().fetch() as Leitura[];
        const imagens = await database.get('imagens').query().fetch() as Imagem[];
        const logs = await database.get('logs').query().fetch() as Log[];

        // Marcar como deletados
        await Promise.all([
          ...leituras.map(l => l.markAsDeleted()),
          ...imagens.map(i => i.markAsDeleted()),
          ...logs.map(l => l.markAsDeleted())
        ]);
      });

      console.log('🗑️ Todos os dados foram removidos do banco');
    } catch (error) {
      console.error('Erro ao limpar banco:', error);
    }
  }
}

export const dbDebug = new DatabaseDebugger();

// Expor globalmente para facilitar uso no console
if (__DEV__) {
  (global as any).dbDebug = dbDebug;
  console.log('🔍 Database debugger disponível globalmente:');
  console.log('\n📊 VISÃO GERAL:');
  console.log('  - dbDebug.showSummary()      // Resumo completo do banco');
  console.log('  - dbDebug.showLeituras()     // Todas as leituras (tabela)');
  console.log('  - dbDebug.showImagens()      // Todas as imagens (tabela)');
  console.log('  - dbDebug.showLogs()         // Todos os logs (tabela)');
  console.log('  - dbDebug.showObservacoes()  // Todas as observações (tabela)');
  console.log('  - dbDebug.showComentarios()  // Todos os comentários (tabela)');
  console.log('\n🔍 DETALHES INDIVIDUAIS:');
  console.log('  - dbDebug.showLeituraDetalhes(id)     // Detalhes completos de uma leitura');
  console.log('  - dbDebug.showImagemDetalhes(id)      // Detalhes completos de uma imagem');
  console.log('  - dbDebug.showLogDetalhes(id)         // Detalhes completos de um log');
  console.log('  - dbDebug.showObservacaoDetalhes(id)  // Detalhes de uma observação + comentários');
  console.log('\n🔧 MANUTENÇÃO:');
  console.log('  - dbDebug.resetUploadingStatus()      // 🔄 Resetar itens presos em "uploading"');
  console.log('\n🗑️ LIMPEZA:');
  console.log('  - dbDebug.clearAll()                  // Limpar todos os dados (CUIDADO!)');
}
