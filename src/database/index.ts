import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import migrations from './migrations'; // ✅ NOVO: Importar migrations
import Leitura from './models/Leitura';
import Imagem from './models/Imagem';
import Log from './models/Log';
import Observacao from './models/Observacao';
import ObservacaoComentario from './models/ObservacaoComentario';

const adapter = new SQLiteAdapter({
  schema,
  migrations, // ✅ NOVO: Habilitar migrations automáticas
  jsi: true, // JSI para melhor performance (se disponível)
  onSetUpError: (error) => {
    console.error('❌ Erro ao configurar banco WatermelonDB:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Leitura, Imagem, Log, Observacao, ObservacaoComentario],
});

// Database Debug Helper - Console visual
if (__DEV__) {
  console.log('🔍 Database debug helper será carregado pelo app');
  console.log('💡 Use no console: dbDebug.showSummary()');
}

console.log('✅ Banco WatermelonDB inicializado');
