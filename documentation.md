# 📱 **DIBAU - Sistema de Irrigação Mobile**
*Documentação Técnica Completa v1.0.0*

---

## 📋 **Sumário**

1. [Visão Geral](#-visão-geral)
2. [Arquitetura do Sistema](#-arquitetura-do-sistema)
3. [Funcionalidades Principais](#-funcionalidades-principais)
4. [Stack Tecnológica](#-stack-tecnológica)
5. [Estrutura do Projeto](#-estrutura-do-projeto)
6. [Instalação e Configuração](#-instalação-e-configuração)
7. [Sistema de Build](#-sistema-de-build)
8. [Sistema OTA (Over-The-Air)](#-sistema-ota-over-the-air)
9. [Sistema de Logging](#-sistema-de-logging)
10. [Sincronização e Offline](#-sincronização-e-offline)
11. [API e Conectividade](#-api-e-conectividade)
12. [Navegação e Interface](#-navegação-e-interface)
13. [Gerenciamento de Estado](#-gerenciamento-de-estado)
14. [Sistema de Captura de Imagens](#-sistema-de-captura-de-imagens)
15. [Autenticação e Segurança](#-autenticação-e-segurança)
16. [Performance e Otimizações](#-performance-e-otimizações)
17. [Testes e Debugging](#-testes-e-debugging)
18. [Deploy e Distribuição](#-deploy-e-distribuição)
19. [Troubleshooting](#-troubleshooting)
20. [Roadmap e Melhorias](#-roadmap-e-melhorias)

---

## 🎯 **Visão Geral**

O **DIBAU** é um aplicativo móvel desenvolvido para facilitar a captura e gerenciamento de leituras de hidrômetros em sistemas de irrigação. O app permite que irrigantes registrem leituras de consumo de água, capturem fotos dos hidrômetros e sincronizem dados com o sistema central.

### **Características Principais:**
- 📱 Interface nativa para Android e iOS
- 🔄 Funcionamento offline com sincronização automática
- 📸 Captura de imagens dos hidrômetros
- 🚀 Atualizações OTA (Over-The-Air)
- 📊 Sistema avançado de logging
- 🎨 Interface adaptável para tablets e smartphones
- 🔐 Autenticação segura com JWT

---

## 🏗️ **Arquitetura do Sistema**

### **Padrão Arquitetural:**
- **MVVM** (Model-View-ViewModel) com Context API
- **Componentização** modular e reutilizável
- **Services** para lógica de negócio
- **Hooks personalizados** para estado e efeitos

### **Fluxo de Dados:**
```
API Backend ↔ Services ↔ Contexts ↔ Components ↔ UI
                ↓
         AsyncStorage (Cache/Offline)
```

### **Camadas da Aplicação:**
1. **Apresentação:** Screens, Components, Navigation
2. **Lógica:** Contexts, Services, Utils
3. **Dados:** API, AsyncStorage, Cache
4. **Infraestrutura:** Logging, OTA, Sync

---

## ⚡ **Funcionalidades Principais**

### **1. Autenticação**
- Login seguro com email/senha
- Tokens JWT com renovação automática
- Logout e limpeza de dados
- Validação de sessão

### **2. Gerenciamento de Lotes**
- Visualização de lotes agrícolas
- Busca e filtros avançados
- Informações de culturas
- Sincronização offline

### **3. Captura de Leituras**
- Seleção de período (mês/ano)
- Edição de leituras de hidrômetros
- Validação de valores (incluindo x10)
- Replicação automática de datas
- Status visual (lido/não lido)

### **4. Sistema de Imagens**
- Captura via câmera
- Seleção da galeria
- Compressão automática
- Upload com retry
- Visualização de imagens existentes

### **5. Funcionamento Offline**
- Cache local com AsyncStorage
- Sincronização automática
- Indicadores de status de rede
- Retry automático de operações

### **6. Relatórios e Status**
- Contadores de leituras
- Progresso por período
- Estatísticas de sincronização
- Logs de atividades

---

## 💻 **Stack Tecnológica**

### **Core Framework:**
- **React Native** 0.73+ com New Architecture
- **Expo SDK** 52+ com Router
- **TypeScript** 5+ para tipagem estática
- **Metro** como bundler

### **Navegação:**
- **Expo Router** (file-based routing)
- **React Navigation** 7+ (drawer + tabs)
- **Stack Navigation** para modais

### **Estado e Dados:**
- **Context API** para estado global
- **AsyncStorage** para persistência
- **Axios** para requisições HTTP
- **NetInfo** para status de conectividade

### **UI e UX:**
- **Expo Vector Icons** para iconografia
- **React Native Elements** (declarações personalizadas)
- **Toast Messages** para notificações
- **Modal e Overlays** personalizados

### **Recursos Nativos:**
- **Expo Camera** para captura de imagens
- **Expo Image Picker** para galeria
- **Expo Image Manipulator** para compressão
- **Expo Application** para informações do app
- **Expo Device** para info do dispositivo
- **Expo Location** para geolocalização

### **Build e Deploy:**
- **EAS Build** para builds nativas
- **EAS Update** para OTA
- **EAS Submit** para stores

---

## 📁 **Estrutura do Projeto**

```
SistemaIrrigacaoApp/
├── app/                          # Expo Router (file-based routing)
│   ├── (drawer)/                 # Layout com drawer
│   │   ├── (tabs)/              # Layout com tabs
│   │   │   ├── index.tsx        # Tela de Lotes
│   │   │   └── leituras.tsx     # Tela de Leituras
│   │   ├── LeiturasDetalhes.tsx # Tela de captura
│   │   └── _layout.tsx          # Layout do drawer
│   ├── _layout.tsx              # Layout raiz
│   ├── index.tsx                # Redirecionamento inicial
│   └── login.tsx                # Tela de login
├── src/
│   ├── api/
│   │   └── axiosConfig.ts       # Configuração da API
│   ├── components/              # Componentes reutilizáveis
│   │   ├── common/              # Componentes gerais
│   │   ├── drawer/              # Componentes do drawer
│   │   ├── inputs/              # Inputs customizados
│   │   ├── leituras/            # Componentes de leituras
│   │   ├── lotes/               # Componentes de lotes
│   │   └── UpdateHandler.tsx    # Sistema OTA
│   ├── contexts/                # Contextos globais
│   │   ├── AuthContext.tsx      # Autenticação
│   │   └── LeiturasContext.tsx  # Estado de leituras
│   ├── screens/                 # Telas principais
│   │   ├── auth/                # Telas de autenticação
│   │   ├── leituras/            # Telas de leituras
│   │   └── lotes/               # Telas de lotes
│   ├── services/                # Serviços e lógica
│   │   ├── LoggerService.ts     # Sistema de logging
│   │   ├── SyncService.ts       # Sincronização
│   │   ├── ImagemLeituraService.ts # Gerenciar imagens
│   │   └── CulturasSyncService.ts  # Sync de culturas
│   ├── types/                   # Definições de tipos
│   │   ├── models.ts            # Interfaces de dados
│   │   └── declarations.d.ts    # Declarações globais
│   └── utils/                   # Utilitários
│       └── formatters.ts        # Formatação de dados
├── assets/                      # Recursos estáticos
│   ├── images/                  # Imagens do app
│   ├── icons/                   # Ícones SVG
│   └── fonts/                   # Fontes customizadas
├── constants/                   # Constantes globais
│   ├── Colors.ts                # Paleta de cores
│   └── navigationTheme.ts       # Tema de navegação
├── scripts/                     # Scripts utilitários
│   ├── update.js                # Script de OTA
│   └── reset-project.js         # Reset do projeto
├── app.json                     # Configuração do Expo
├── eas.json                     # Configuração do EAS
├── package.json                 # Dependências
└── tsconfig.json               # Configuração TypeScript
```

---

## 🚀 **Instalação e Configuração**

### **Pré-requisitos:**
- Node.js 18+ LTS
- npm ou yarn
- Expo CLI
- EAS CLI
- Android Studio (Android)
- Xcode (iOS - macOS apenas)

### **Instalação:**

```bash
# 1. Clonar repositório
git clone <url-do-repositorio>
cd SistemaIrrigacaoApp

# 2. Instalar dependências
npm install

# 3. Instalar EAS CLI globalmente
npm install -g @expo/eas-cli

# 4. Fazer login no Expo
expo login
eas login
```

### **Configuração do Ambiente:**

#### **Desenvolvimento Local:**
```bash
# Iniciar servidor de desenvolvimento
npm start

# Executar no Android
npm run android

# Executar no iOS
npm run ios
```

#### **Configuração de IP (src/api/axiosConfig.ts):**
```typescript
const config = {
  development: 'http://SEU_IP_LOCAL:5001',
  production: 'https://sistema-irrigacao-backend.onrender.com',
  test: 'http://localhost:5001'
};
```

---

## 🏗️ **Sistema de Build**

### **Perfis de Build (eas.json):**

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "channel": "preview"
    },
    "production": {
      "channel": "production"
    }
  }
}
```

### **Comandos de Build:**

```bash
# Build de desenvolvimento
eas build --profile development --platform android

# Build de preview (APK)
npm run build:preview

# Build de produção (AAB)
npm run build:production

# Build para ambas as plataformas
eas build --profile production --platform all
```

### **Processo de Build:**
1. **Desenvolvimento:** Build com dev client para hot reload
2. **Preview:** APK interno para testes
3. **Produção:** AAB otimizado para Google Play Store

---

## 🔄 **Sistema OTA (Over-The-Air)**

### **Configuração (app.json):**
```json
{
  "updates": {
    "fallbackToCacheTimeout": 0,
    "checkAutomatically": "ON_ERROR_RECOVERY",
    "url": "https://u.expo.dev/8182f75d-927d-45df-900b-b6ece4780706"
  }
}
```

### **Como Usar:**

#### **Método Rápido:**
```bash
# Script interativo
npm run update
# 1. Escolher canal (production/preview)
# 2. Digitar mensagem da atualização
```

#### **Comandos Diretos:**
```bash
# Produção
npm run update:production "Correção de bug crítico"

# Preview
npm run update:preview "Nova funcionalidade em teste"
```

### **Verificação Automática:**
- **Inicialização:** 3 segundos após abrir o app
- **Retorno ao app:** Quando sai e volta
- **Periódica:** A cada 30 minutos
- **Manual:** Via menu lateral

### **Interface do Usuário:**
- Modal elegante com status visual
- Botões "Atualizar agora" / "Mais tarde"
- Indicador de progresso durante download
- Reinicialização automática após instalação

### **Limitações:**
- ❌ Não funciona no Expo Go
- ❌ Não permite mudanças nativas
- ✅ Funciona para código JS/TS, estilos, componentes

---

## 📊 **Sistema de Logging**

### **Arquitetura do Logger:**
- **Singleton Pattern** para instância única
- **Níveis hierárquicos** (debug → critical)
- **Armazenamento offline** com limite
- **Sincronização automática** quando online
- **Enriquecimento automático** com contexto

### **Níveis de Log:**
```typescript
type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
```

### **Configuração Atual:**
- **Nível mínimo:** `warning` (só loga warning+ por padrão)
- **Logs offline:** Máximo 500 entries
- **Sync automática:** Quando volta online
- **Batch size:** 10 logs por requisição

### **Uso Básico:**
```typescript
const logger = LoggerService.getInstance();

// Logs diretos por nível
await logger.warning('Título', 'Mensagem detalhada');
await logger.error('Erro crítico', 'Stack trace completo');

// Logs especializados
await logger.logAuth('login_attempt', false, { reason: 'invalid_credentials' });
await logger.logApiRequest('/api/leituras', 'POST', 400, requestData, responseData);
await logger.logSync('leituras_sync', false, { error: 'network_timeout' });
await logger.logStorage('save_faturas', 'faturas_key', false, error);
```

### **Campos Automáticos:**
- **Dispositivo:** OS, modelo, versão, memória
- **Rede:** Tipo, conectividade, IP
- **Localização:** GPS (se permitido)
- **App:** Versão, sessão, timestamp
- **Contexto:** Stack trace, dados extras

### **Configuração Avançada:**
```typescript
// Alterar nível mínimo
logger.setMinLogLevel('debug'); // Para desenvolvimento
logger.setMinLogLevel('error');  // Para produção

// Estatísticas offline
const stats = logger.getOfflineStats();
console.log(`Total offline: ${stats.total}, Erros: ${stats.porNivel.error}`);

// Limpar cache (usar com cuidado)
await logger.clearOfflineLogs();
```

---

## 🔄 **Sincronização e Offline**

### **Estratégia de Cache:**
- **AsyncStorage** como fonte única offline
- **Sincronização bidirecional** (upload/download)
- **Merge inteligente** de dados
- **Retry automático** com backoff

### **Tipos de Sincronização:**

#### **1. Leituras:**
```typescript
// Sincronização manual
import { syncPendingLeituras } from '@/src/services/SyncService';

const result = await syncPendingLeituras({
  onProgress: (current, total) => console.log(`${current}/${total}`),
  onComplete: (success, count) => console.log(`Sync: ${success}, Count: ${count}`),
  specificIds: ['123', '456'] // Opcional: IDs específicos
});
```

#### **2. Imagens:**
```typescript
// Upload de imagens pendentes
import ImagemLeituraService from '@/src/services/ImagemLeituraService';

const service = ImagemLeituraService.getInstance();
const result = await service.uploadImagensPendentes({
  onProgress: (current, total) => console.log(`Upload: ${current}/${total}`),
  specificFaturaIds: [123, 456] // Opcional: faturas específicas
});
```

#### **3. Culturas:**
```typescript
// Sincronização de culturas
import { syncPendingCulturas } from '@/src/services/CulturasSyncService';

const result = await syncPendingCulturas({
  onProgress: (current, total) => console.log(`Culturas: ${current}/${total}`)
});
```

### **Indicadores Visuais:**
- **Badges de pendência** em cards
- **Ícones de status** (sync, offline, erro)
- **Barra de progresso** durante sync
- **Toast messages** informativos

### **Políticas de Retry:**
- **Exponential backoff** para falhas de rede
- **Limite de tentativas** por operação
- **Queue management** para múltiplas operações

---

## 🌐 **API e Conectividade**

### **Configuração Base:**
```typescript
// Ambientes suportados
const config = {
  development: 'http://192.168.88.23:5001',
  production: 'https://sistema-irrigacao-backend.onrender.com',
  test: 'http://localhost:5001'
};
```

### **Interceptors:**

#### **Request:**
- Adiciona token JWT automaticamente
- Verifica conectividade antes do envio
- Log estruturado de requisições

#### **Response:**
- Trata erros 401 (renovação de token)
- Log detalhado de erros
- Retry automático para falhas de rede

### **Principais Endpoints:**

#### **Autenticação:**
- `POST /auth/login` - Login do usuário
- `GET /auth/verify` - Verificação de token

#### **Leituras:**
- `GET /faturamensal/app/leituras` - Listar períodos
- `GET /faturamensal/app/faturas/:mesAno` - Faturas do período
- `PUT /faturamensal/app/atualizar-leitura/:id` - Atualizar leitura

#### **Lotes:**
- `GET /lotesagricolas` - Listar lotes
- `GET /culturas` - Listar culturas
- `PUT /lotesagricolas/:id` - Atualizar lote

#### **Imagens:**
- `POST /api/imagens-leitura/upload` - Upload de imagem
- `GET /api/imagens-leitura/leitura/:id` - Buscar imagem
- `DELETE /api/imagens-leitura/:id` - Deletar imagem

#### **Logs:**
- `POST /api/logs` - Enviar log individual
- `POST /api/logs/bulk` - Enviar logs em lote

### **Tratamento de Erro:**
```typescript
// Tipos de erro tratados
- Network errors (timeout, no response)
- HTTP errors (4xx, 5xx)
- Configuration errors
- Authentication errors (401)
```

---

## 🗺️ **Navegação e Interface**

### **Estrutura de Navegação:**
```
App
├── Login (/login)
└── Drawer
    ├── Tabs
    │   ├── Lotes (/(tabs)/index)
    │   └── Leituras (/(tabs)/leituras)
    └── Leituras Detalhes (/LeiturasDetalhes)
```

### **Componentes de Navegação:**

#### **Drawer Customizado:**
- Header com info do usuário
- Menu de navegação
- Botão de verificar atualizações
- Botão de logout

#### **Tabs Bottom:**
- Lotes Agrícolas (ícone: map-outline)
- Leituras (ícone: water-outline)

#### **Stack Navigation:**
- Modais para captura de imagem
- Telas de detalhes
- Overlays de progresso

### **Adaptabilidade:**

#### **Detecção de Dispositivo:**
```typescript
const smallerDimension = Math.min(width, height);
const largerDimension = Math.max(width, height);
const isTablet = smallerDimension >= 550 || largerDimension >= 900;
```

#### **Layouts Responsivos:**
- **Smartphone:** Layout vertical, 1 coluna
- **Tablet:** Layout horizontal, 2 colunas
- **Fontes escaláveis** baseadas no dispositivo
- **Espaçamentos adaptativos**

### **Tema e Cores:**
```typescript
const Colors = {
  primary: '#008bac99',     // Azul principal
  success: '#2a9d8f',       // Verde sucesso
  warning: '#ffd700',       // Amarelo atenção
  error: '#e63946',         // Vermelho erro
  text: '#333',             // Texto principal
  background: '#f5f5f5'     // Fundo padrão
};
```

---

## 🎛️ **Gerenciamento de Estado**

### **Context API:**

#### **AuthContext:**
```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
```

#### **LeiturasContext:**
```typescript
interface LeiturasContextType {
  faturasSelecionadas: Fatura[];
  mesAnoSelecionado: string;
  setFaturasSelecionadas: (faturas: Fatura[]) => void;
  setMesAnoSelecionado: (mesAno: string) => void;
  atualizarFaturaLocal: (id: number, dados: Partial<Fatura>) => Promise<void>;
}
```

### **Estado Local:**
- **useState** para estado componente-específico
- **useEffect** para side effects
- **useCallback** para otimização de renders
- **useMemo** para cálculos custosos

### **Persistência:**
- **AsyncStorage** para dados críticos
- **Cache automático** de API responses
- **Cleanup** automático de dados antigos

---

## 📸 **Sistema de Captura de Imagens**

### **Funcionalidades:**
- Captura via câmera nativa
- Seleção da galeria
- Preview antes do upload
- Compressão automática
- Upload com retry
- Visualização de imagens existentes

### **Configuração de Qualidade:**
```typescript
const imageConfig = {
  quality: 0.8,           // 80% de qualidade
  compress: 0.7,          // Compressão 70%
  resize: { width: 1200 }, // Redimensionar para largura máxima
  format: 'jpeg'          // Formato JPEG
};
```

### **Processo de Upload:**
1. **Captura/Seleção** da imagem
2. **Compressão** automática
3. **Preview** para confirmação
4. **Upload** com progress
5. **Retry** em caso de falha
6. **Cache local** da imagem

### **Estados Visuais:**
- **Camera icon:** Sem imagem
- **Image icon:** Com imagem existente
- **Loading:** Durante upload
- **Error:** Falha no upload

### **Permissões:**
```json
{
  "NSCameraUsageDescription": "Precisamos da sua câmera para registrar fotos das leituras de hidrômetros",
  "NSPhotoLibraryUsageDescription": "Precisamos de acesso à sua galeria para selecionar fotos de leituras de hidrômetros"
}
```

---

## 🔐 **Autenticação e Segurança**

### **Fluxo de Autenticação:**
1. **Login** com email/senha
2. **Validação** no backend
3. **Recebimento** de token JWT
4. **Armazenamento** seguro local
5. **Uso automático** em requisições

### **Segurança de Token:**
```typescript
// Validação de expiração
const isTokenValid = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
  }
};
```

### **Proteção de Rotas:**
```typescript
// Redirecionamento baseado em autenticação
if (isAuthenticated) {
  return <Redirect href="/(tabs)" />;
} else {
  return <Redirect href="/login" />;
}
```

### **Logout Seguro:**
- Limpeza de tokens
- Remoção de dados sensíveis
- Redirecionamento para login
- Limpeza de cache de API

### **Armazenamento Seguro:**
```typescript
// Chaves de armazenamento
const STORAGE_KEYS = {
  TOKEN: 'dibau_token',
  USER: 'dibau_user',
  FATURAS: 'leituras_faturas_selecionadas'
};
```

---

## ⚡ **Performance e Otimizações**

### **Otimizações de Render:**

#### **Memoização:**
```typescript
// Componentes memoizados
const FaturaItem = memo<FaturaItemProps>(({ item, ... }) => {
  // Component logic
});

// Callbacks otimizados
const handleSave = useCallback(async (fatura, valor) => {
  // Save logic
}, [dependencies]);
```

#### **Inputs de Alta Performance:**
```typescript
// Input que não causa re-renders desnecessários
<HighPerformanceInput
  ref={inputRef}
  placeholder="Informe a leitura"
  keyboardType="numeric"
  // Não usa value/onChangeText para evitar re-renders
/>
```

### **Otimizações de Lista:**
- **FlatList** com `keyExtractor` otimizado
- **getItemLayout** para listas grandes
- **removeClippedSubviews** para economia de memória
- **maxToRenderPerBatch** controlado

### **Otimizações de Imagem:**
- **Compressão automática** antes do upload
- **Redimensionamento** para resolução ideal
- **Cache local** de imagens
- **Lazy loading** em listas

### **Gerenciamento de Memória:**
- **Cleanup** de listeners em useEffect
- **Debounce** em buscas e inputs
- **Throttle** em scroll events
- **Cache LRU** para dados frequentes

---

## 🧪 **Testes e Debugging**

### **Ferramentas de Debug:**

#### **Logs Estruturados:**
```bash
[API] Enviando requisição para: POST /api/leituras
[AUTH] Autenticação restaurada com sucesso: João Silva
[SYNC] Sincronizando 5 leituras pendentes
[OTA] Verificando atualizações...
```

#### **Console Debugging:**
- **Network Inspector** para requisições
- **AsyncStorage** debugger
- **Performance Monitor** do React Native

#### **Flipper Integration:**
- Network plugin para API calls
- AsyncStorage plugin para dados
- Redux plugin para estado

### **Teste Manual:**
```bash
# Testar sem conexão
adb shell svc wifi disable
adb shell svc data disable

# Simular baixa conectividade
adb shell tc qdisc add dev wlan0 root netem delay 2000ms

# Limpar dados do app
adb shell pm clear com.sistemairrigacao.app
```

### **Logs de Produção:**
- Sistema de logging integrado
- Envio automático para backend
- Dashboard de monitoramento
- Alertas em tempo real

---

## 🚀 **Deploy e Distribuição**

### **Processo de Release:**

#### **1. Preparação:**
```bash
# Atualizar versão
# Em app.json: version + runtimeVersion
# Em package.json: version

# Build de produção
npm run build:production
```

#### **2. Testes:**
```bash
# Build de preview primeiro
npm run build:preview

# Testar em dispositivos reais
# Validar funcionalidades críticas
# Testar cenários offline
```

#### **3. Deploy:**
```bash
# Submit para Play Store
eas submit --platform android --latest

# Ou manual upload do AAB
# Download do EAS e upload manual
```

#### **4. OTA Post-Release:**
```bash
# Atualizações rápidas pós-release
npm run update:production "Hotfix crítico"
```

### **Checklist de Release:**
- [ ] Versões atualizadas (app.json, package.json)
- [ ] Testes em dispositivos reais
- [ ] Validação de APIs de produção
- [ ] Backup de dados importantes
- [ ] Monitoramento pós-deploy ativo

### **Ambientes:**
- **Development:** IP local com hot reload
- **Preview:** Build APK para testes internos
- **Production:** AAB otimizado para Play Store

---

## 🔧 **Troubleshooting**

### **Problemas Comuns:**

#### **1. Build Failures:**
```bash
# Limpar cache
expo r -c
npm run android -- --reset-cache

# Reinstalar node_modules
rm -rf node_modules package-lock.json
npm install
```

#### **2. Metro Bundle Errors:**
```bash
# Reset Metro cache
npx react-native start --reset-cache

# Verificar imports circulares
# Verificar sintaxe TypeScript
```

#### **3. EAS Build Issues:**
```bash
# Login novamente
eas logout
eas login

# Verificar configuração
eas config

# Build verbose
eas build --platform android --profile production --clear-cache
```

#### **4. OTA Not Working:**
- Verificar se não está no Expo Go
- Confirmar runtimeVersion compatibility
- Verificar channel configuration
- Testar build de produção

#### **5. Sync Issues:**
```bash
# Limpar dados de sync
# AsyncStorage.removeItem('pendingLeituraUpdates')
# AsyncStorage.removeItem('pendingLeiturasSyncs')

# Verificar conectividade
# NetInfo.fetch()

# Logs detalhados
# LoggerService.getInstance().setMinLogLevel('debug')
```

#### **6. Authentication Problems:**
```bash
# Limpar tokens
# AsyncStorage.removeItem('dibau_token')
# AsyncStorage.removeItem('dibau_user')

# Verificar expiração de token
# Testar endpoint de login diretamente
```

### **Logs de Debug:**
```typescript
// Ativar logs detalhados
LoggerService.getInstance().setMinLogLevel('debug');

// Verificar estado de conectividade
const netInfo = await NetInfo.fetch();
console.log('Network:', netInfo);

// Verificar dados em cache
const faturas = await AsyncStorage.getItem('leituras_faturas_selecionadas');
console.log('Cached faturas:', faturas);
```

---

## 🛣️ **Roadmap e Melhorias**

### **Próximas Funcionalidades:**

#### **v1.1.0:**
- [ ] Push notifications para atualizações
- [ ] Backup automático na nuvem
- [ ] Filtros avançados de leituras
- [ ] Modo escuro completo
- [ ] Relatórios exportáveis

#### **v1.2.0:**
- [ ] OCR para leitura automática de hidrômetros
- [ ] Geolocalização das leituras
- [ ] Chat support integrado
- [ ] Analytics de uso

#### **v2.0.0:**
- [ ] Refatoração para Expo SDK 53+
- [ ] Nova arquitetura de estado (Redux Toolkit)
- [ ] Migração para React Native 0.75+
- [ ] Suporte a iOS

### **Otimizações Técnicas:**

#### **Performance:**
- [ ] Code splitting por rota
- [ ] Lazy loading de componentes
- [ ] Virtual scrolling em listas grandes
- [ ] Web Workers para processos pesados

#### **UX/UI:**
- [ ] Skeleton screens
- [ ] Micro-interactions
- [ ] Animações fluidas
- [ ] Acessibilidade completa

#### **Infraestrutura:**
- [ ] CI/CD automatizado
- [ ] Testes automatizados (Jest + Detox)
- [ ] Monitoring em tempo real
- [ ] Crash reporting avançado

### **Métricas de Sucesso:**
- Taxa de crash < 0.1%
- Tempo de carregamento < 2s
- Sincronização offline 99% confiável
- Satisfação do usuário > 4.5/5

---

## 📞 **Suporte e Contato**

### **Documentação Técnica:**
- **GitHub:** [Link do repositório]
- **Wiki:** [Link da wiki]
- **API Docs:** [Link da documentação da API]

### **Contato Técnico:**
- **Email:** suporte@dibau.com.br
- **Slack:** #dibau-mobile
- **Issues:** GitHub Issues

### **Resources:**
- **Expo Docs:** https://docs.expo.dev/
- **React Native:** https://reactnative.dev/
- **EAS Build:** https://docs.expo.dev/build/introduction/

---

## 📄 **Licença e Créditos**

### **Licença:**
Proprietary - DIBAU Sistema de Irrigação

### **Tecnologias Utilizadas:**
- React Native & Expo (Meta/Expo)
- TypeScript (Microsoft)
- React Navigation (React Navigation)
- Axios (axios contributors)

### **Créditos:**
- **Desenvolvimento:** Equipe DIBAU
- **Design:** Equipe UX/UI DIBAU
- **Backend:** API Sistema de Irrigação

---

*Documentação atualizada em: Dezembro 2024*
*Versão do App: 1.0.0*
*Versão da Documentação: 1.0* 