import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 7, // ✅ MIGRAÇÃO: versão 6 → 7 (adicionar lote_id na tabela leituras)
  tables: [
    // ===== TABELA DE LEITURAS =====
    tableSchema({
      name: 'leituras',
      columns: [
        { name: 'server_id', type: 'number', isIndexed: true }, // ID da fatura no servidor
        { name: 'leitura_backend_id', type: 'number', isOptional: true, isIndexed: true }, // ✅ ID da leitura no backend
        { name: 'mes_referencia', type: 'string', isIndexed: true },
        { name: 'ano_referencia', type: 'number', isIndexed: true },

        // ✅ DADOS ESSENCIAIS PARA EXIBIÇÃO NA TELA
        { name: 'lote_id', type: 'number', isIndexed: true }, // ✅ ID do lote no servidor (para vincular com observações)
        { name: 'lote_nome', type: 'string' },
        { name: 'lote_situacao', type: 'string' }, // "Operacional" ou "Abandonado"
        { name: 'lote_mapa_leitura', type: 'number', isOptional: true }, // Número do mapa de leitura
        { name: 'irrigante_nome', type: 'string' },
        { name: 'hidrometro_codigo', type: 'string' },
        { name: 'hidrometro_x10', type: 'boolean' }, // FLAG CRÍTICA!

        // ✅ DADOS ESSENCIAIS PARA UPLOAD
        { name: 'leitura_atual', type: 'number' },
        { name: 'data_leitura', type: 'string', isOptional: true },

        // ✅ DADOS PARA EXIBIÇÃO/COMPARAÇÃO
        { name: 'leitura_anterior', type: 'number' },
        { name: 'data_leitura_anterior', type: 'string', isOptional: true },
        { name: 'consumo', type: 'number' },
        { name: 'valor_leitura_m3', type: 'number' }, // ✅ NOVO CAMPO
        { name: 'imagem_url', type: 'string', isOptional: true },
        
        // ✅ CAMPOS DE ESTADO/STATUS
        { name: 'fechada', type: 'string' },
        { name: 'status', type: 'string' }, // ✅ NOVO CAMPO

        // FLAGS DE SINCRONIZAÇÃO
        { name: 'sync_status', type: 'string' }, // synced | local_edited | uploading | error
        { name: 'has_local_image', type: 'boolean' }, // Tem imagem local?
        { name: 'last_sync_at', type: 'number', isOptional: true }, // timestamp
        { name: 'error_message', type: 'string', isOptional: true },

        // Metadados
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ===== TABELA DE IMAGENS =====
    tableSchema({
      name: 'imagens',
      columns: [
        { name: 'leitura_id', type: 'string', isIndexed: true }, // Relacionamento com leituras (watermelonDB ID)
        { name: 'leitura_server_id', type: 'number', isIndexed: true }, // ID da fatura no servidor
        { name: 'leitura_backend_id', type: 'number', isOptional: true, isIndexed: true }, // ✅ ID da leitura no backend
        { name: 'local_uri', type: 'string' }, // Caminho FileSystem local
        { name: 'file_size', type: 'number' }, // Bytes
        { name: 'mime_type', type: 'string' },

        // FLAGS DE SINCRONIZAÇÃO
        { name: 'sync_status', type: 'string' }, // synced | uploading | error
        { name: 'uploaded_url', type: 'string', isOptional: true },
        { name: 'error_message', type: 'string', isOptional: true },

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ===== TABELA DE LOGS =====
    tableSchema({
      name: 'logs',
      columns: [
        { name: 'level', type: 'string', isIndexed: true }, // debug | info | warning | error | critical
        { name: 'category', type: 'string', isIndexed: true }, // auth | api | sync | upload | general
        { name: 'message', type: 'string' },
        { name: 'details', type: 'string', isOptional: true }, // JSON stringified

        // Contexto automático (igual LoggerService atual)
        { name: 'device_info', type: 'string', isOptional: true },
        { name: 'app_version', type: 'string', isOptional: true },
        { name: 'user_email', type: 'string', isOptional: true },

        // FLAGS DE SINCRONIZAÇÃO
        { name: 'sync_status', type: 'string' }, // pending | uploading | synced | error
        { name: 'error_message', type: 'string', isOptional: true },

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ===== TABELA DE OBSERVAÇÕES =====
    tableSchema({
      name: 'observacoes',
      columns: [
        { name: 'server_id', type: 'number', isIndexed: true }, // ID da observação no servidor
        { name: 'lote_id', type: 'number', isIndexed: true }, // ID do lote no servidor
        { name: 'tipo', type: 'string', isIndexed: true }, // pendencia | vistoria | outros
        { name: 'status', type: 'string', isIndexed: true }, // vigente | finalizada
        { name: 'titulo', type: 'string' },
        { name: 'descricao', type: 'string', isOptional: true },
        { name: 'usuario_criador_id', type: 'number' },
        { name: 'usuario_criador_nome', type: 'string', isOptional: true },
        { name: 'usuario_finalizador_id', type: 'number', isOptional: true },
        { name: 'usuario_finalizador_nome', type: 'string', isOptional: true },
        { name: 'data_finalizacao', type: 'number', isOptional: true },

        // FLAGS DE SINCRONIZAÇÃO
        { name: 'sync_status', type: 'string' }, // synced | local_edited | uploading | error
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'error_message', type: 'string', isOptional: true },

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ===== TABELA DE COMENTÁRIOS DE OBSERVAÇÕES =====
    tableSchema({
      name: 'observacoes_comentarios',
      columns: [
        { name: 'server_id', type: 'number', isIndexed: true }, // ID do comentário no servidor
        { name: 'observacao_id', type: 'string', isIndexed: true }, // WatermelonDB ID da observação local
        { name: 'observacao_server_id', type: 'number', isIndexed: true }, // ID da observação no servidor
        { name: 'comentario', type: 'string' },
        { name: 'usuario_id', type: 'number' },
        { name: 'usuario_nome', type: 'string', isOptional: true },

        // FLAGS DE SINCRONIZAÇÃO
        { name: 'sync_status', type: 'string' }, // synced | local_edited | uploading | error
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'error_message', type: 'string', isOptional: true },

        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
