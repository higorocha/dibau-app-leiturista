import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Migrações do banco de dados WatermelonDB
 *
 * VERSÃO 1 → 2: Adicionado campos completos de Lote, Cliente e Hidrômetro
 * VERSÃO 2 → 3: Modelo simplificado - removidos campos desnecessários, adicionados campos essenciais
 * VERSÃO 3 → 4: Adicionado leitura_backend_id para corrigir upload de imagens
 * VERSÃO 4 → 5: Adicionado lote_situacao (Operacional/Abandonado)
 * VERSÃO 5 → 6: Adicionado tabelas de observações e comentários
 * VERSÃO 6 → 7: Re-adicionado lote_id na tabela leituras (para vincular com observações)
 */
export default schemaMigrations({
  migrations: [
    {
      // Migração da versão 1 para versão 2
      toVersion: 2,
      steps: [
        addColumns({
          table: 'leituras',
          columns: [
            // DADOS DO LOTE
            { name: 'lote_id', type: 'number' },

            // DADOS DO CLIENTE
            { name: 'cliente_id', type: 'number' },

            // DADOS DO HIDRÔMETRO
            { name: 'hidrometro_id', type: 'number' },
            { name: 'hidrometro_codigo', type: 'string' },
            { name: 'hidrometro_modelo', type: 'string', isOptional: true },
            { name: 'hidrometro_x10', type: 'boolean' },

            // LEITURAS
            { name: 'data_leitura_anterior', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      // Migração da versão 2 para versão 3 - Modelo simplificado
      toVersion: 3,
      steps: [
        addColumns({
          table: 'leituras',
          columns: [
            // ✅ NOVOS CAMPOS ESSENCIAIS
            { name: 'valor_leitura_m3', type: 'number' },
            { name: 'status', type: 'string' },
          ],
        }),
      ],
    },
    {
      // ✅ Migração da versão 3 para versão 4 - Adicionar ID da leitura do backend
      toVersion: 4,
      steps: [
        addColumns({
          table: 'leituras',
          columns: [
            // ✅ ID da leitura no backend (para upload de imagem)
            { name: 'leitura_backend_id', type: 'number', isOptional: true },
          ],
        }),
        addColumns({
          table: 'imagens',
          columns: [
            // ✅ ID da leitura no backend (para upload de imagem)
            { name: 'leitura_backend_id', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // ✅ Migração da versão 4 para versão 5 - Adicionar situação e mapa do lote
      toVersion: 5,
      steps: [
        addColumns({
          table: 'leituras',
          columns: [
            // ✅ Situação do lote ("Operacional" ou "Abandonado")
            { name: 'lote_situacao', type: 'string' },
            // ✅ Número do mapa de leitura
            { name: 'lote_mapa_leitura', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      // ✅ Migração da versão 5 para versão 6 - Criar tabelas de observações e comentários
      toVersion: 6,
      steps: [
        createTable({
          name: 'observacoes',
          columns: [
            { name: 'server_id', type: 'number', isIndexed: true },
            { name: 'lote_id', type: 'number', isIndexed: true },
            { name: 'tipo', type: 'string', isIndexed: true },
            { name: 'status', type: 'string', isIndexed: true },
            { name: 'titulo', type: 'string' },
            { name: 'descricao', type: 'string', isOptional: true },
            { name: 'usuario_criador_id', type: 'number' },
            { name: 'usuario_criador_nome', type: 'string', isOptional: true },
            { name: 'usuario_finalizador_id', type: 'number', isOptional: true },
            { name: 'usuario_finalizador_nome', type: 'string', isOptional: true },
            { name: 'data_finalizacao', type: 'number', isOptional: true },
            { name: 'sync_status', type: 'string' },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'error_message', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'observacoes_comentarios',
          columns: [
            { name: 'server_id', type: 'number', isIndexed: true },
            { name: 'observacao_id', type: 'string', isIndexed: true },
            { name: 'observacao_server_id', type: 'number', isIndexed: true },
            { name: 'comentario', type: 'string' },
            { name: 'usuario_id', type: 'number' },
            { name: 'usuario_nome', type: 'string', isOptional: true },
            { name: 'sync_status', type: 'string' },
            { name: 'synced_at', type: 'number', isOptional: true },
            { name: 'error_message', type: 'string', isOptional: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // ✅ Migração da versão 6 para versão 7 - Re-adicionar lote_id
      toVersion: 7,
      steps: [
        addColumns({
          table: 'leituras',
          columns: [
            { name: 'lote_id', type: 'number', isIndexed: true }, // ID do lote no servidor
          ],
        }),
      ],
    },
  ],
});
