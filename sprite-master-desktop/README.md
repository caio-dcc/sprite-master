# 🎮 Sprite Master Ultra – Desktop Edition

**Customização profissional de sprites para animações 2D. Processamento inteligente de spritesheets com suporte a edição inline, composição de camadas e exportação em lote.**

---

## 📋 Índice

- [🎯 Funcionalidades Principais](#-funcionalidades-principais)
- [🚀 Instalação & Setup](#-instalação--setup)
- [💻 Como Usar](#-como-usar)
- [⌨️ Atalhos de Teclado](#️-atalhos-de-teclado)
- [🏗️ Arquitetura](#️-arquitetura)
- [🔧 Desenvolvimento](#-desenvolvimento)
- [📦 Dependências](#-dependências)

---

## 🎯 Funcionalidades Principais

### 1. **Importação & Processamento de Spritesheets**
- Carregue qualquer spritesheet (PNG, JPG) e defina a grade automaticamente
- **Auto-detecção de grade**: Analisa dimensões e encontra a melhor divisão
- Divisão em frames individuais com controle fino de parâmetros

### 2. **Limpeza Inteligente de Fundo** 🧹
- **Magic Background Removal**: Algoritmo proprietário que detecta cores dominantes nas bordas
- **IA-powered**: Integração com `@imgly/background-removal` para fundos complexos
- **Checkerboard cleanup**: Removes quadrados de fundo isolados dentro do sprite
- Intensidade ajustável: Fraco, Médio, Forte

### 3. **Editor Inline Profissional** ✏️
- Edite cada frame individualmente com **ferramentas de pintura**:
  - 🖌️ **Pincel**: Desenhe com cores personalizadas
  - ⌫ **Borracha**: Remove transparentemente
  - 🧹 **Limpa Brancos**: Remove cores claras (com sensibilidade ajustável)
  - 💧 **Conta-gotas**: Capture cores do canvas

### 4. **Ajustes de Imagem**
- Brilho, Contraste, Saturação, Hue (Matriz de Cor)
- Aplique a um frame ou a TODOS os frames de uma vez
- Sistema de **desfazer/refazer** com histórico até 30 ações

### 5. **Processamento Avançado**
- **Anti-Bleed**: Remove pixels semitransparentes nas bordas
- **Anti-Aliasing**: Suaviza/desfoca arestas
- **Contorno**: Adiciona sombra/contorno aos sprites
- **Ruído**: Remove artefatos isolados
- **Estabilidade**: Alinha frames pelo centro de massa (0-100%)

### 6. **Gerenciamento de Frames**
- ✅/❌ Incluir/excluir frames da exportação
- 🔄 Reordenar por drag-and-drop
- ⧉ Duplicar frames
- 🗑️ Deletar com recuperação (Lixeira)
- Preencher até 30 frames automaticamente

### 7. **Composição de Camadas**
- Sobreponha folhas de acessórios (cabelo, roupa, armas)
- Limpa fundo do acessório automaticamente
- Offset X/Y para ajuste fino
- Usa a mesma grade do personagem principal

### 8. **Exportação Profissional**
- Exporte como **ZIP organizado** com nomes de ações
- Apenas frames não-excluídos
- Formato PNG com transparência total
- Pronto para integração em engines de jogo

### 9. **Visualização em Tempo Real**
- Preview de animação ao vivo (ajustável)
- Guias visuais de grade opcionais
- Indicadores de exclusão por frame

---

## 🚀 Instalação & Setup

### Pré-requisitos
- **Node.js** 16+ (recomendado 18+)
- **npm** ou **yarn**

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/caio-dcc/sprite-master.git
cd sprite-master/sprite-master-desktop

# 2. Instale dependências
npm install

# 3. Desenvolvimento (com HMR)
npm run dev

# 4. Build para produção
npm run build

# 5. Package para Windows
npm run package
```

**Output:**
- `dist/` – Aplicação web compilada (Vite)
- `dist-electron/` – Código Electron compilado
- `dist-build/` – Executável portable (.exe)

---

## 💻 Como Usar

### Fluxo Básico

#### 1️⃣ **Importar Sprite**
```
Clique em "Importar Primeiro Sprite" ou use a entrada de arquivo
```

#### 2️⃣ **Definir Grade**
```
Opção A: Selecione um preset (3x4, 4x4, 5x4, 6x3, 8x2, 16x1)
Opção B: Clique em ⚡ para auto-detectar
```

#### 3️⃣ **Processar (Opcional)**
Use os controles na lateral para:
- Limpeza inteligente (Magic Button)
- Anti-bleed, Anti-aliasing, Contorno
- Ruído e Estabilidade

#### 4️⃣ **Editar Frames Individuais (Opcional)**
```
Clique em "✏️" em qualquer frame → Editor inline abre
- Pinte/apague/limpe brancos
- Ajuste brilho, contraste, saturação, hue
- Desfaça com Ctrl+Z
- Retorne com "← Voltar à Grade"
```

#### 5️⃣ **Compor Camadas (Opcional)**
```
Clique em "Compor Acessório (Folha)"
- Selecione a folha (mesmo tamanho/grade do sprite base)
- Ative "Limpar fundo do acessório" se necessário
- Ajuste Offset X/Y
- Clique para aplicar a todos os frames
```

#### 6️⃣ **Exportar**
```
1. Digite o nome da ação (ex: "andando_calmo", "atacando")
2. Clique em "Exportar ZIP"
3. Arquivo será salvo em Downloads/
```

---

## ⌨️ Atalhos de Teclado

### No Editor Inline

| Tecla | Ação |
|-------|------|
| **C** | Pincel |
| **B** | Borracha |
| **W** | Limpa Brancos |
| **Z** | Conta-gotas |
| **R** | Resetar para Original |
| **Ctrl+Z** | Desfazer |

### No Painel Global

| Tecla | Ação |
|-------|------|
| **Clique + Arraste** | Reordenar frames |
| **Clique em Frame** | Editar |
| **Clique em ⚡** | Auto-detectar grade |

---

## 🏗️ Arquitetura

```
sprite-master-desktop/
├── src/
│   ├── App.tsx                 # Componente raiz (620 linhas)
│   ├── main.tsx                # Entry point React
│   ├── index.css               # Estilos globais
│   ├── App.css                 # Estilos da aplicação
│   │
│   ├── components/
│   │   ├── FrameGrid.tsx       # Grade de frames com drag-drop
│   │   ├── AnimationPreview.tsx # Preview em tempo real
│   │   ├── CanvasView.tsx      # Visualizador de canvas
│   │   └── ExportTray.tsx      # Interface de exportação
│   │
│   ├── hooks/
│   │   └── useSpriteProcessor.ts # State management de processamento
│   │
│   └── utils/
│       └── imageProcessing.ts  # Algoritmos de processamento pixel-level
│
├── electron/                    # Código Electron (main process)
├── package.json                # Dependencies
├── vite.config.ts              # Config Vite + Electron plugins
├── tsconfig.json               # Config TypeScript
└── index.html                  # Template HTML
```

### Fluxo de Dados

```
User Input (File/Slider)
    ↓
App.tsx (State Management)
    ↓
useSpriteProcessor (Processamento)
    ↓
imageProcessing.ts (Algoritmos Pixel-Level)
    ↓
Canvas Rendering
    ↓
FrameGrid / InlineEditor (UI)
```

---

## 🔧 Desenvolvimento

### Stack Tecnológico

- **Frontend**: React 19.2 + TypeScript 5.9
- **Build Tool**: Vite 8.0
- **Desktop**: Electron 41.1
- **UI Framework**: Mantine 9.0 (hooks/dropzone)
- **Image Processing**: Canvas API + @imgly/background-removal
- **Linting**: ESLint 9.39 + TypeScript-ESLint

### Scripts Disponíveis

```bash
npm run dev              # Dev com HMR
npm run build           # Build Vite + TypeScript
npm run lint            # ESLint check
npm run package         # Build + Electron Builder (Windows portable)
```

### Modificar Algoritmos

1. **Background Removal**: `/src/utils/imageProcessing.ts` → `magicBackgroundRemoval()`
2. **Noise Filter**: `/src/utils/imageProcessing.ts` → `applyNoiseFilter()`
3. **Editor Tools**: `/src/App.tsx` → `InlineEditor()` component
4. **Grid Detection**: `/src/App.tsx` → `detectGridIA()` function

---

## 📦 Dependências

### Produção
- `react` (19.2.4) – UI Framework
- `react-dom` (19.2.4) – React DOM
- `@mantine/core` (9.0.0) – UI Components
- `@mantine/hooks` (9.0.0) – React Hooks
- `@mantine/dropzone` (9.0.0) – File Upload
- `@tabler/icons-react` (3.41.1) – Icon Library
- `@imgly/background-removal` (1.7.0) – AI Background Removal
- `jszip` (3.10.1) – ZIP Creation

### Desenvolvimento
- `typescript` (5.9.3) – Type Safety
- `vite` (8.0.1) – Build Tool
- `electron` (41.1.0) – Desktop Runtime
- `electron-builder` (26.8.1) – App Packager
- `eslint` (9.39.4) – Linting
- `@vitejs/plugin-react` (6.0.1) – Vite React Plugin
- `vite-plugin-electron` (0.29.1) – Electron Integration

---

## 📝 Notas Técnicas

### Performance
- Canvas context cacheado com `willReadFrequently: true`
- Processamento assíncrono com debouncing (50ms)
- Preview em tempo real com `requestAnimationFrame`

### Compatibilidade
- Windows (Portable .exe)
- Testar em macOS/Linux (build pendente)
- Tamanho máximo de spritesheet: Limitado pela memória do sistema

### Segurança
- Sem acesso à rede (offline-first)
- Todos os arquivos processados localmente
- Sem telemetria

---

## 🎓 Exemplos de Uso

### Exemplo 1: Animar um Personagem Caminhando
```
1. Importar spritesheet 16x1 (16 frames de walk cycle)
2. Selecionar preset "Horizontal 16x1"
3. Limpar fundo com Magic (Intensidade: Média)
4. Nomear ação como "walk"
5. Exportar ZIP → usar em engine de jogo
```

### Exemplo 2: Remover Fundo Complexo
```
1. Importar sprite com fundo gradiente/foto
2. Usar "Limpar" com intensidade FORTE
3. Se necessário, usar editor para toques manuais (pincel/borracha)
4. Aplicar Anti-Bleed (3-5) para arestas limpas
5. Exportar
```

### Exemplo 3: Compor Acessórios
```
1. Importar base do personagem (4x4 = 16 frames)
2. Criar folha de cabelo (mesma grade 4x4)
3. Selecionar "Compor Acessório"
4. Ativar "Limpar fundo"
5. Ajustar offset se necessário
6. Exportar → sprite com cabelo sobreposto
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| Fundo não limpa bem | Aumentar intensidade ou usar IA mode |
| Editor não abre | Certifique-se de que o frame foi carregado |
| Zip não exporta | Verificar permissões de pasta de Downloads |
| Performance lenta | Reduzir tamanho do sprite ou limpar histórico |

---

## 📄 Licença

MIT

---

**Desenvolvido com ❤️ por caio-dcc**

Perguntas? Abra uma issue no repositório!