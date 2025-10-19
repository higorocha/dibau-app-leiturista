# SyncLoadingOverlay - Componente de Loading Profissional

## 🎯 Propósito

Substitui os toasts simples por um overlay profissional e moderno para feedback de sincronização e operações de loading.

## ✨ Características

- **Overlay centralizado** com fundo semi-transparente
- **Animações suaves** de entrada e saída
- **3 tipos visuais**: loading, success, error
- **Spinner animado** com efeito de pulso para loading
- **Ícones contextuais** para success/error
- **Design responsivo** e consistente
- **Animação de pulso** contínua durante loading

## 🚀 Como Usar

```typescript
import SyncLoadingOverlay from '../../components/common/SyncLoadingOverlay';

// No seu componente
const [syncOverlay, setSyncOverlay] = useState({
  visible: false,
  title: '',
  subtitle: '',
  type: 'loading' as 'loading' | 'success' | 'error',
});

// Funções auxiliares
const showSyncOverlay = (title: string, subtitle?: string, type: 'loading' | 'success' | 'error' = 'loading') => {
  setSyncOverlay({ visible: true, title, subtitle: subtitle || '', type });
};

const hideSyncOverlay = () => {
  setSyncOverlay(prev => ({ ...prev, visible: false }));
};

const updateSyncOverlay = (updates: Partial<typeof syncOverlay>) => {
  setSyncOverlay(prev => ({ ...prev, ...updates }));
};

// No JSX
<SyncLoadingOverlay
  visible={syncOverlay.visible}
  title={syncOverlay.title}
  subtitle={syncOverlay.subtitle}
  type={syncOverlay.type}
/>
```

## 📝 Exemplos de Uso

### Loading
```typescript
showSyncOverlay('Sincronizando...', 'Buscando dados atualizados do servidor', 'loading');
```

### Success
```typescript
updateSyncOverlay({ 
  title: 'Sincronizado!', 
  subtitle: '15 registros atualizados com sucesso', 
  type: 'success' 
});
setTimeout(() => hideSyncOverlay(), 2000);
```

### Error
```typescript
updateSyncOverlay({ 
  title: 'Erro na sincronização', 
  subtitle: 'Verifique sua conexão e tente novamente', 
  type: 'error' 
});
setTimeout(() => hideSyncOverlay(), 3000);
```

## 🎨 Design System

### Cores
- **Loading**: #2a9d8f (verde principal do app)
- **Success**: #155724 (verde escuro)
- **Error**: #721c24 (vermelho escuro)

### Animações
- **Entrada**: Fade in (300ms) + Scale up (spring)
- **Loading**: Pulso contínuo (2s loop)
- **Saída**: Fade out (200ms) + Scale down

### Responsividade
- Largura máxima: 320px ou 80% da tela
- Padding adaptável
- Suporte a diferentes tamanhos de texto

## 🔄 Migração de Toasts

### Antes (Toast)
```typescript
Toast.show({
  type: 'info',
  text1: 'Sincronizando...',
  text2: 'Buscando dados atualizados',
  position: 'bottom',
  visibilityTime: 2000,
});
```

### Depois (SyncLoadingOverlay)
```typescript
showSyncOverlay('Sincronizando...', 'Buscando dados atualizados', 'loading');
```

## 🔧 Implementado em

- ✅ **LeiturasScreen**: Sincronização principal
- 🟡 **LotesScreen**: Candidato para migração
- 🟡 **LeiturasDetalhesScreen**: Verificar se há toasts de loading

## 💡 Benefícios

1. **Visual mais profissional** - Overlay central vs toast na borda
2. **Melhor UX** - Usuário foca na operação em andamento
3. **Consistência** - Padrão único para toda aplicação
4. **Feedback claro** - Mensagens mais visíveis e legíveis
5. **Animações suaves** - Transições elegantes entre estados
