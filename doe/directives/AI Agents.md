# Obsidian AI Agents Plugin — Project Plan

**Nome progetto:** `obsidian-ai-agents`
**Autore:** Rares
**Data inizio:** 2026-02-18
**Stato:** Planning

---

## 1. Visione

Un plugin per Obsidian che trasforma il vault in un ecosistema di agenti AI configurabili tramite file markdown. Ogni agente è definito da un singolo file `agent.md` dove il frontmatter YAML contiene la configurazione e il body markdown è il system prompt. La knowledge base può risiedere ovunque nel vault — l'agente la referenzia tramite path globali. L'utente chatta con gli agenti direttamente dentro Obsidian, e gli agenti possono leggere, scrivere, spostare e creare file nel vault secondo un sistema di permessi granulare.

---

## 2. Struttura Vault (lato utente)

```
vault/
  ├── agents/                          # Cartella agenti
  │   ├── assistant/
  │   │   ├── agent.md                 # Config (YAML) + Prompt (body)
  │   │   └── logs/                    # Conversazioni (auto-generato)
  │   │       ├── 2026-01-25.md
  │   │       └── 2026-01-26.md
  │   ├── writer/
  │   │   ├── agent.md
  │   │   └── logs/
  │   └── coder/
  │       ├── agent.md
  │       └── logs/
  │
  ├── knowledge/                       # Knowledge base condivisa (esempio)
  │   ├── company/
  │   │   ├── guidelines.md
  │   │   └── brand-voice.md
  │   ├── projects/
  │   │   └── roadmap.md
  │   └── docs/
  │       └── api-reference.md
  │
  ├── data/                            # Dati referenziabili dagli agenti
  │   └── context.md
  ├── journal/                         # Qualsiasi cartella del vault
  │   └── 2026-01-25.md
  └── ...
```

La knowledge base non è vincolata alla cartella dell'agente. Ogni agente dichiara nel frontmatter i path (assoluti rispetto al vault root) dei file/cartelle da usare come contesto. Più agenti possono condividere la stessa knowledge, e un singolo agente può attingere da cartelle sparse nel vault.

---

## 3. Schema `agent.md` (file unico: config + prompt)

Ogni agente è definito da un singolo `agent.md`. Il frontmatter YAML è la configurazione, il body markdown è il system prompt. Obsidian parsa nativamente il frontmatter, quindi il file è editabile normalmente nel vault.

```yaml
---
name: "Writing Coach"
description: "Helps improve writing style and clarity"
author: "User"
avatar: "✍️"
enabled: "true"
type: "conversational"      # conversational | task | scheduled
provider: "ollama"
#TODO: add in interface
temperature: 0.7
max_tokens: 2000
top_p: 0.9
stream: true              # Streaming delle risposte
model: "llama3"
sources: [                   # Path RELATIVI AL VAULT ROOT (non alla cartella agente)
    "knowledge/company/**"  # Tutta la sottocartella company
    ,"knowledge/docs/api-reference.md"  # File singolo
    , "data/context.md"       # File in un'altra cartella del vault
    , "journal/2026-*.md"     # Glob pattern
]
strategy: "inject_all"
max_context_tokens: 4000
read: [
    "data/**",
     "journal/**",
    "tasks/**"
]
write: [
    "data/**",
     "journal/**",
    "tasks/**"
]
create: [
    "data/**",
     "journal/**",
    "tasks/**"
]
move: [
    "data/**",
     "journal/**",
    "tasks/**"
]
delete: [
    "data/**",
     "journal/**",
    "tasks/**"
]
vault_root_access: "false"
confirm_destructive: "true"
logging_enabled: "false"
logging_path: "logs"
logging_format: "daily"
logging_include_metadata: "true"
---

You are a **Writing Coach**. Your role is to help the user improve their
writing by providing direct, actionable feedback.

## Guidelines

Be concise and specific. Point out what works and what doesn't.
Don't sugarcoat — give honest critique with concrete suggestions.

## User Context

{{READ: data/context.md}}

## Knowledge Base

{{knowledge_context}}

## Rules

Keep feedback focused on clarity, structure, and tone.
Always suggest a rewritten version when critiquing.
```

### 3.1 Parsing

Il plugin splitta il file su `---`:

- **Parte 1** (frontmatter) → `parseYaml()` → oggetto config
- **Parte 2** (body) → stringa raw del system prompt → passa al `TemplateEngine`

### 3.2 Knowledge Sources — Path Resolution

Tutti i path in `knowledge.sources` sono **relativi al vault root**, non alla cartella dell'agente. Questo permette:

- **Condivisione**: più agenti puntano a `knowledge/company/**` senza duplicare file
- **Trasversalità**: un agente può leggere da `journal/`, `data/`, `projects/` etc.
- **Granularità**: mix di glob patterns (`**`, `*`) e file specifici
- **Isolamento**: l'agente vede solo i file dichiarati, non tutto il vault

Esempi validi:

```yaml
knowledge:
  sources:
    - "knowledge/company/**" # Tutti i file ricorsivi
    - "projects/current/README.md" # Singolo file specifico
    - "notes/2026-01-*.md" # Pattern temporale
    - "shared-kb/**/*.md" # Solo .md ricorsivi
```

---

## 4. Template Variables (nel body di agent.md)

Il body markdown di `agent.md` è il system prompt. Supporta queste variabili che il `TemplateEngine` risolve prima di inviare al modello:

| Variabile                   | Descrizione                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `{{agent_name}}`            | Nome dell'agente dal frontmatter `metadata.name`               |
| `{{user_name}}`             | Nome utente dalle settings del plugin                          |
| `{{date}}`                  | Data corrente (YYYY-MM-DD)                                     |
| `{{time}}`                  | Ora corrente (HH:MM)                                           |
| `{{datetime}}`              | Data e ora completa                                            |
| `{{READ: path/to/file.md}}` | Inietta il contenuto di un file specifico dal vault            |
| `{{knowledge_context}}`     | Inietta tutti i file dichiarati in `knowledge.sources`         |
| `{{conversation_summary}}`  | Riassunto delle ultime N conversazioni dai log                 |
| `{{vault_structure}}`       | Albero delle cartelle accessibili (basato su permissions.read) |

### Risoluzione `{{READ: ...}}`

Il path è relativo al vault root. Il `TemplateEngine`:

1. Verifica che il path sia nei `permissions.read` o in `knowledge.sources`
2. Legge il file dal vault
3. Lo wrappa in un blocco contestuale per il modello:

```
--- START: data/context.md ---
[contenuto del file]
--- END: data/context.md ---
```

### Risoluzione `{{knowledge_context}}`

1. Espande tutti i glob in `knowledge.sources`
2. Per ogni file matchato, legge il contenuto
3. Concatena tutto con separatori, rispettando `max_context_tokens`
4. Se supera il limite, tronca i file meno recenti (per `modified date`)

---

## 5. Architettura Plugin

### 5.1 Struttura Sorgente

```
obsidian-ai-agents/
  ├── manifest.json
  ├── package.json
  ├── tsconfig.json
  ├── esbuild.config.mjs
  ├── styles.css
  └── src/
      ├── main.ts                     # Entry point, registra viste e comandi
      ├── settings.ts                 # Settings tab del plugin
      ├── types.ts                    # Interfacce TypeScript condivise
      │
      ├── core/
      │   ├── AgentRegistry.ts        # Scansione agents/, parsing, lifecycle
      │   ├── AgentConfig.ts          # Parser agent.md (frontmatter + body)
      │   ├── TemplateEngine.ts       # Risoluzione {{variabili}} nel prompt body
      │   ├── KnowledgeResolver.ts    # Espande glob, carica file da ovunque nel vault
      │   └── PermissionGuard.ts      # Verifica permessi su ogni operazione
      │
      ├── api/
      │   ├── ApiRouter.ts            # Smista al provider corretto
      │   ├── providers/
      │   │   ├── BaseProvider.ts     # Interfaccia comune
      │   │   ├── OpenAilikeProvider.ts   # ollama e openrouter
      │   └── ToolHandler.ts          # Gestisce function calling / tool use
      │
      ├── fileops/
      │   ├── FileOperations.ts       # CRUD file con permission check
      │   ├── GlobMatcher.ts          # Matching pattern glob per permessi
      │   └── VaultBrowser.ts         # Esplora vault per {{vault_structure}}
      │
      ├── chat/
      │   ├── ChatView.ts             # ItemView principale della chat
      │   ├── ChatManager.ts          # Gestisce sessioni, history, context
      │   ├── MessageRenderer.ts      # Render messaggi (markdown, code, etc)
      │   └── ChatInput.ts            # Input con autocomplete e comandi
      │
      ├── logging/
      │   ├── ConversationLogger.ts   # Scrive log in markdown
      │   └── TokenTracker.ts         # Traccia usage per agente
      │
      └── ui/
          ├── AgentSelectorModal.ts   # Modale per scegliere agente
          ├── PermissionModal.ts      # Modale conferma operazioni
          ├── StatusBar.ts            # Info agente attivo nella status bar
          └── AgentSidebar.ts         # Lista agenti nella sidebar
```

### 5.2 Dipendenze

```json
{
  "dependencies": {
    "obsidian": "latest"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0",
    "builtin-modules": "^3.3.0",
    "micromatch": "^4.0.5"
  }
}
```

> **Nota:** Le chiamate API vengono fatte con `requestUrl` nativo di Obsidian (no axios/fetch esterni). `micromatch` serve per il glob matching dei permessi.

---

## 6. Flusso Principale

### 6.1 Startup

```
Plugin.onload()
  → AgentRegistry.scan("agents/")
    → Per ogni sottocartella:
      → Leggi agent.md
      → Split su "---" → frontmatter + body
      → parseYaml(frontmatter) → config object
      → Valida schema (enabled, model, permissions)
      → Salva body come raw prompt template
      → Registra agente nel registry
  → Registra ChatView
  → Registra comandi (palette, hotkey)
  → Inizializza StatusBar
```

### 6.2 Avvio Chat

```
Utente apre ChatView → seleziona agente
  → ChatManager.startSession(agent)
    → TemplateEngine.resolve(agent.promptBody)
      → Espande knowledge.sources (glob → file list dal vault)
      → Legge file referenziati ({{READ:...}})
      → Inietta {{knowledge_context}} con i file risolti
      → Sostituisce variabili ({{date}}, {{user_name}}, etc.)
    → Carica history (se esiste log di oggi)
    → Inizializza conversation array con system prompt risolto
```

### 6.3 Invio Messaggio

```
Utente invia messaggio
  → ChatManager.addMessage("user", text)
  → ApiRouter.send(agent.model, messages[])
    → Provider.chat(messages, parameters)
      → Se il modello richiede tool_use:
        → ToolHandler.execute(tool_call)
          → PermissionGuard.check(operation, path)
            → Se permesso: FileOperations.execute()
            → Se confirm_destructive: PermissionModal → attendi conferma
            → Se negato: return error al modello
        → Reinvia risultato al modello → continua
      → Ricevi risposta finale
  → MessageRenderer.render(response)
  → ConversationLogger.append(user_msg, assistant_msg)
  → TokenTracker.update(usage)
```

---

## 7. Sistema Permessi (dettaglio)

### 7.1 Operazioni

| Operazione                          | Permesso richiesto   | Descrizione              |
| ----------------------------------- | -------------------- | ------------------------ |
| `vault.read(path)`                  | `permissions.read`   | Legge contenuto file     |
| `vault.modify(path, content)`       | `permissions.write`  | Modifica file esistente  |
| `vault.create(path, content)`       | `permissions.create` | Crea nuovo file          |
| `fileManager.rename(file, newPath)` | `permissions.move`   | Sposta/rinomina file     |
| `fileManager.trashFile(file)`       | `permissions.delete` | Elimina file             |
| `vault.adapter.list(path)`          | `permissions.read`   | Lista contenuto cartella |

### 7.2 Glob Matching

Il `PermissionGuard` usa glob patterns:

- `data/**` → qualsiasi file ricorsivo in `data/`
- `tasks/*.md` → solo file .md direttamente in `tasks/`
- `journal/2026-*.md` → file che matchano il pattern
- `!private/**` → negazione esplicita (blocca path)

### 7.3 Sicurezza

- **Nessun permesso di default**: se `permissions` non è definito, l'agente può solo chattare senza accesso al vault.
- **Vault root bloccato**: `vault_root_access: false` impedisce accesso a file fuori dai pattern.
- **Path traversal protection**: blocca `../` e path assoluti.
- **Confirm destructive**: per write/move/delete mostra modale di conferma all'utente prima di eseguire.
- **Rate limiting**: max N operazioni file per messaggio (configurabile).

---

## 8. Tool Use / Function Calling

Quando un agente ha permessi file, il plugin espone queste "tools" nella chiamata API:

```typescript
const tools = [
  {
    name: "read_file",
    description: "Leggi il contenuto di un file dal vault",
    parameters: {
      path: { type: "string", description: "Path relativo al vault root" },
    },
  },
  {
    name: "write_file",
    description: "Scrivi o modifica un file nel vault",
    parameters: {
      path: { type: "string" },
      content: { type: "string" },
      mode: { type: "string", enum: ["overwrite", "append", "prepend"] },
    },
  },
  {
    name: "create_file",
    description: "Crea un nuovo file nel vault",
    parameters: {
      path: { type: "string" },
      content: { type: "string" },
    },
  },
  {
    name: "move_file",
    description: "Sposta o rinomina un file",
    parameters: {
      from: { type: "string" },
      to: { type: "string" },
    },
  },
  {
    name: "list_files",
    description: "Lista file in una cartella",
    parameters: {
      path: { type: "string" },
      recursive: { type: "boolean" },
    },
  },
  {
    name: "search_vault",
    description: "Cerca testo nei file del vault",
    parameters: {
      query: { type: "string" },
      path: { type: "string", description: "Cartella dove cercare" },
    },
  },
];
```

Le tools vengono generate dinamicamente in base ai permessi dell'agente: se non ha `write`, la tool `write_file` non viene inclusa.

---

## 9. Formato Log

### Log giornaliero (`logs/2026-01-25.md`)

```markdown
---
agent: "Writing Coach"
model: "gemini-flash"
date: 2026-01-25
sessions: 2
total_tokens: 3420
---

# Writing Coach — 2026-01-25

## Sessione 1 — 09:15

> **User** (09:15): Can you review this paragraph for my blog post?
> **Writing Coach** (09:15): The opening is weak. Lead with the key insight, not background. Here's a rewrite...

> **User** (09:22): What about the conclusion?
> **Writing Coach** (09:22): Too abrupt. Add a callback to your opening hook. Try this...

**🔧 Tool calls:** read_file → data/context.md

---

## Sessione 2 — 14:30

> **User** (14:30): I rewrote the intro, take a look.
> **Writing Coach** (14:30): Much better. The hook lands now. One tweak...
```

---

## 10. Settings del Plugin

```typescript
interface PluginSettings {
  // Cartella agenti
  agentsFolder: string; // default: "agents"

  // API Keys (salvate in data.json, encrypted)
  apiKeys: {
    openai?: string;
    gemini?: string;
    anthropic?: string;
    mistral?: string;
    custom?: Record<string, string>; // Per endpoint custom/oss
  };

  // Provider custom (per modelli self-hosted)
  customProviders: {
    name: string;
    baseUrl: string;
    apiKeyRef: string; // Riferimento a apiKeys.custom
    isOpenAICompatible: boolean; // Usa formato OpenAI
  }[];

  // Utente
  userName: string; // Per {{user_name}} nel prompt
  locale: string; // it, en, etc.

  // Comportamento
  defaultModel: string;
  maxHistoryMessages: number; // Quanti messaggi mantenere nel context
  autoSaveInterval: number; // Secondi tra auto-save del log
  confirmDestructiveOps: boolean; // Override globale conferma operazioni
  maxFileOpsPerMessage: number; // Rate limit operazioni file

  // UI
  chatPosition: "right" | "left" | "tab";
  showStatusBar: boolean;
  showTokenCount: boolean;
}
```

---

## 11. Fasi di Sviluppo

### Fase 1 — Fondamenta (settimana 1-2)

- [x] **DONE** Scaffold progetto (manifest, package.json, esbuild)
- [x] **DONE** `types.ts` — Tutte le interfacce TypeScript (`AgentTypes.ts`, `PluginTypes.ts`)
- [x] **DONE** `AgentConfig.ts` — Parser agent.md (frontmatter → config, body → prompt)
- [x] **DONE** `AgentRegistry.ts` — Scansione cartella, lifecycle agenti
- [x] **DONE** `KnowledgeResolver.ts` — Espansione glob, caricamento file da qualsiasi path nel vault
- [x] **DONE** `TemplateEngine.ts` — Risoluzione {{variabili}} nel body di agent.md
- [x] **DONE** `settings.ts` — Settings tab con API keys e configurazione base
- [x] **DONE** Test: creare 2-3 agenti di esempio e verificare parsing corretto

### Fase 2 — Chat Core (settimana 3-4)

- [x] **DONE** `ChatView.ts` — Vista principale con lista messaggi e input
- [x] **DONE** `ChatManager.ts` — Gestione sessione, history, context window
- [x] **DONE** `MessageRenderer.ts` — Render markdown nelle risposte
- [x] **DONE** `AgentSelectorModal.ts` — Modale scelta agente (Sostituisce select inline in ChatView)
- [x] **DONE** `ApiRouter.ts` + `BaseProvider.ts` — Interfaccia comune provider
- [x] **DONE** `OpenAilikeProvider.ts` — ollama e openrouter
- [ ] Test: chat funzionante con un modello OpenAI-compatible

### Fase 3 — Provider (settimana 5)

- [x] **DONE** Streaming responses per tutti i provider
- [ ] Test: verificare tutti i provider, fallback, streaming

### Fase 3.5 — Modal

- [x] **DONE** pagina per la creazione e modifica degli agenti

### Fase 4 — File Operations (settimana 6-7)

- [x] `GlobMatcher.ts` — Pattern matching per permessi
- [x] `PermissionGuard.ts` — Verifica pre-esecuzione
- [x] `FileOperations.ts` — CRUD con guard integrato
- [x] `ToolHandler.ts` — Traduce tool_call API in operazioni vault
- [x] `PermissionModal.ts` — Conferma operazioni distruttive
- [x] Generazione dinamica tools in base ai permessi
- [x] Test: operazioni permesse/negate, path traversal, conferme UI

### Fase 5 — Logging & Polish (settimana 8)

- [x] `ConversationLogger.ts` — Scrittura log markdown
- [x] `TokenTracker.ts` — Tracciamento usage
- [x] `StatusBar.ts` — Agente attivo + token usati
- [x] `AgentSidebar.ts` — Lista agenti con stato
- [x] Hot reload: watch su agent.md per aggiornare config e prompt senza restart
- [x] Error handling robusto su tutte le chiamate API
- [x] Test end-to-end completo

### Fase 6 — Extra (futuro)

- [ ] `VaultBrowser.ts` — Esplorazione vault per l'agente
- [ ] RAG strategy per knowledge base grandi
- [ ] Agent type "scheduled" — esegue task a orari definiti
- [ ] Agent type "task" — one-shot, non conversazionale
- [ ] Comandi slash nella chat (`/switch writer`, `/clear`, `/export`)
- [ ] Import/export agenti (zip della cartella)
- [ ] Marketplace agenti (condivisione community)

---

## 12. Note Tecniche

**API calls**: Usare `requestUrl` di Obsidian, non `fetch` diretto. Questo garantisce compatibilità con mobile e gestisce CORS correttamente.

**YAML parsing**: Obsidian espone `parseYaml()` e `stringifyYaml()` nel suo API — usare quelli invece di librerie esterne.

**File watching**: Usare `this.registerEvent(this.app.vault.on('modify', ...))` per reagire a modifiche su agent.md e ricaricare config + prompt senza restart. Monitorare anche i file in `knowledge.sources` per invalidare la cache del contesto.

**Streaming**: Implementare con `ReadableStream` dove il provider lo supporta. Aggiornare il `MessageRenderer` incrementalmente.

**Sicurezza API keys**: Le chiavi vengono salvate nel `data.json` del plugin (standard Obsidian). Valutare se aggiungere un layer di encryption locale opzionale.

**Mobile**: Il plugin deve funzionare anche su Obsidian Mobile. Testare `requestUrl`, UI responsive, e file operations su iOS/Android.

---

## 14. File di Esempio per Testing

Creare al setup iniziale:

```
vault/
  ├── agents/
  │   ├── echo/                        # Agente di test minimale
  │   │   └── agent.md                 # Config base + prompt "Ripeti quello che dice l'utente"
  │   └── file_tester/                 # Agente per testare file operations
  │       └── agent.md                 # Tutti i permessi su test_sandbox/
  │
  ├── knowledge/                       # Knowledge base condivisa
  │   └── test/
  │       ├── readme.md
  │       └── context.md
  │
  └── test_sandbox/                    # Cartella per testare file ops
      └── sample.md
```

### Esempio `agents/echo/agent.md`

```yaml
---
---
description: "Helps improve writing style and clarity"
author: "User"
name: "Echo"
avatar: "🔊"
enabled: "true"
type: "conversational"      # conversational | task | scheduled
provider: "ollama"
#TODO: add in interface
temperature: 0.7
max_tokens: 2000
top_p: 0.9
stream: true              # Streaming delle risposte
strategy: "inject_all"
max_context_tokens: 4000
vault_root_access: "false"
confirm_destructive: "true"
logging_enabled: "false"
logging_path: "logs"
logging_format: "daily"
logging_include_metadata: "true"
---

Sei un bot di echo. Ripeti esattamente quello che dice l'utente,
preceduto da "Echo: ". Non aggiungere nient'altro.
```

### Esempio `agents/file_tester/agent.md`

```yaml
---
description: "Helps improve writing style and clarity"
author: "User"
name: "File Tester"
avatar: "🔧"
enabled: "true"
type: "conversational" # conversational | task | scheduled
provider: "ollama"
#TODO: add in interface
temperature: 0.7
max_tokens: 2000
top_p: 0.9
stream: true # Streaming delle risposte
strategy: "inject_all"
max_context_tokens: 4000
vault_root_access: "false"
confirm_destructive: "true"
logging_enabled: "false"
logging_path: "logs"
logging_format: "daily"
logging_include_metadata: "true"
---
Sei un agente di test per le operazioni file. Quando l'utente ti chiede
di leggere, scrivere, creare o spostare file, esegui l'operazione
richiesta nella cartella test_sandbox/.

{{knowledge_context}}
```
