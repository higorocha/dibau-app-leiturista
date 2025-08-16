// src/utils/storageIntegrity.ts - Utilitário para verificação de integridade do AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

// Interface para resultado da verificação
interface IntegrityCheckResult {
  isHealthy: boolean;
  corruptedKeys: string[];
  repairedKeys: string[];
  errors: string[];
  warnings: string[];
}

// Chaves críticas que devem ser verificadas
const CRITICAL_KEYS = [
  'dibau_token',
  'dibau_user',
  'pendingLeituraUpdates',
  'pendingLeiturasSyncs',
  'leituras_faturas_selecionadas',
  'leituras_mes_ano_selecionado'
];

// Função principal de verificação de integridade
export const checkStorageIntegrity = async (): Promise<IntegrityCheckResult> => {
  const result: IntegrityCheckResult = {
    isHealthy: true,
    corruptedKeys: [],
    repairedKeys: [],
    errors: [],
    warnings: []
  };

  console.log('[STORAGE_INTEGRITY] Iniciando verificação de integridade...');

  try {
    for (const key of CRITICAL_KEYS) {
      try {
        const value = await AsyncStorage.getItem(key);
        
        if (value === null) {
          // Chave não existe - não é necessariamente um problema
          console.log(`[STORAGE_INTEGRITY] Chave ${key} não existe (OK)`);
          continue;
        }

        // Verificar se o valor é uma string válida
        if (typeof value !== 'string') {
          result.corruptedKeys.push(key);
          result.errors.push(`Chave ${key} não é string`);
          continue;
        }

        // Verificar se chaves que devem ser JSON são válidas
        if (key.includes('pending') || key.includes('faturas') || key === 'dibau_user') {
          try {
            const parsed = JSON.parse(value);
            
            // Verificações específicas por tipo de dados
            if (key === 'dibau_user') {
              if (!parsed.id || !parsed.nome || !parsed.email) {
                result.warnings.push(`Dados de usuário incompletos na chave ${key}`);
              }
            } else if (key.includes('pending')) {
              if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                result.corruptedKeys.push(key);
                result.errors.push(`Estrutura inválida na chave ${key}`);
              }
            }
          } catch (parseError) {
            result.corruptedKeys.push(key);
            result.errors.push(`JSON inválido na chave ${key}: ${parseError.message}`);
          }
        } else if (key === 'dibau_token') {
          // Verificar se o token tem tamanho mínimo esperado
          if (value.length < 20) {
            result.warnings.push(`Token muito pequeno: ${value.length} caracteres`);
          }
        }
      } catch (keyError) {
        result.corruptedKeys.push(key);
        result.errors.push(`Erro ao acessar chave ${key}: ${keyError.message}`);
      }
    }

    // Determinar se o storage está saudável
    result.isHealthy = result.corruptedKeys.length === 0 && result.errors.length === 0;

    console.log(`[STORAGE_INTEGRITY] Verificação concluída. Saudável: ${result.isHealthy}`);
    if (result.corruptedKeys.length > 0) {
      console.warn(`[STORAGE_INTEGRITY] Chaves corrompidas: ${result.corruptedKeys.join(', ')}`);
    }

  } catch (error) {
    result.isHealthy = false;
    result.errors.push(`Erro geral na verificação: ${error.message}`);
    console.error('[STORAGE_INTEGRITY] Erro crítico na verificação:', error);
  }

  return result;
};

// Função para reparar dados corrompidos
export const repairCorruptedData = async (corruptedKeys: string[]): Promise<string[]> => {
  const repairedKeys: string[] = [];

  console.log('[STORAGE_INTEGRITY] Iniciando reparo de dados corrompidos...');

  for (const key of corruptedKeys) {
    try {
      const backupKey = `${key}_backup`;
      const backupValue = await AsyncStorage.getItem(backupKey);

      if (backupValue) {
        // Tentar restaurar do backup
        try {
          // Verificar se o backup é válido
          if (key.includes('pending') || key.includes('faturas') || key === 'dibau_user') {
            JSON.parse(backupValue); // Validar JSON
          }
          
          await AsyncStorage.setItem(key, backupValue);
          repairedKeys.push(key);
          console.log(`[STORAGE_INTEGRITY] Chave ${key} restaurada do backup`);
        } catch (backupError) {
          console.error(`[STORAGE_INTEGRITY] Backup também corrompido para ${key}:`, backupError);
          await repairWithDefaultValue(key);
          repairedKeys.push(key);
        }
      } else {
        // Não há backup, usar valor padrão
        await repairWithDefaultValue(key);
        repairedKeys.push(key);
      }
    } catch (error) {
      console.error(`[STORAGE_INTEGRITY] Erro ao reparar chave ${key}:`, error);
    }
  }

  console.log(`[STORAGE_INTEGRITY] Reparo concluído. ${repairedKeys.length} chaves reparadas.`);
  return repairedKeys;
};

// Função para criar valores padrão para chaves corrompidas
const repairWithDefaultValue = async (key: string): Promise<void> => {
  let defaultValue: string;

  switch (key) {
    case 'pendingLeituraUpdates':
    case 'pendingLeiturasSyncs':
      defaultValue = '{}';
      break;
    case 'leituras_faturas_selecionadas':
      defaultValue = '[]';
      break;
    case 'leituras_mes_ano_selecionado':
      defaultValue = '';
      break;
    default:
      // Para chaves críticas como token e user, remover completamente
      await AsyncStorage.removeItem(key);
      console.log(`[STORAGE_INTEGRITY] Chave crítica ${key} removida (requer novo login)`);
      return;
  }

  await AsyncStorage.setItem(key, defaultValue);
  console.log(`[STORAGE_INTEGRITY] Chave ${key} reparada com valor padrão`);
};

// Função para criar backup de dados críticos
export const createDataBackup = async (key: string, value: string): Promise<void> => {
  try {
    const backupKey = `${key}_backup`;
    await AsyncStorage.setItem(backupKey, value);
    console.log(`[STORAGE_INTEGRITY] Backup criado para ${key}`);
  } catch (error) {
    console.error(`[STORAGE_INTEGRITY] Erro ao criar backup para ${key}:`, error);
  }
};

// Função para verificação rápida antes de operações críticas
export const quickIntegrityCheck = async (): Promise<boolean> => {
  try {
    // Verificar apenas as chaves mais críticas
    const criticalKeys = ['dibau_token', 'dibau_user'];
    
    for (const key of criticalKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value && key === 'dibau_user') {
        JSON.parse(value); // Verificar se é JSON válido
      }
    }
    
    return true;
  } catch (error) {
    console.error('[STORAGE_INTEGRITY] Falha na verificação rápida:', error);
    return false;
  }
};

// Função para limpeza segura de dados
export const safeDataCleanup = async (keysToClean: string[]): Promise<void> => {
  console.log('[STORAGE_INTEGRITY] Iniciando limpeza segura de dados...');
  
  for (const key of keysToClean) {
    try {
      // Criar backup antes de limpar (exceto para dados sensíveis)
      if (!key.includes('token') && !key.includes('password')) {
        const currentValue = await AsyncStorage.getItem(key);
        if (currentValue) {
          await createDataBackup(key, currentValue);
        }
      }
      
      await AsyncStorage.removeItem(key);
      console.log(`[STORAGE_INTEGRITY] Chave ${key} limpa com segurança`);
    } catch (error) {
      console.error(`[STORAGE_INTEGRITY] Erro ao limpar chave ${key}:`, error);
    }
  }
}; 