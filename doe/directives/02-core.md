# Layer 2 - Core

## Cos'e

Il layer Core contiene il **lifecycle del plugin** e i **servizi centrali** che fanno funzionare l'intera applicazione. E il collante tra Features e Infrastructure.

## Componenti

### main.ts - Entry Point

Il file radice del plugin. Obsidian chiama `onload()` all'attivazione e `onunload()` alla disattivazione.

```
ObsidianPluginTemplate (extends Plugin)
├── onload()
│   ├── loadSettings()                    # Merge dati salvati con DEFAULT_SETTINGS
│   ├── LocalizationService.initialize()  # Setup i18n
│   ├── addCommand()                      # Registra comandi
│   ├── addRibbonIcon()                   # Icona sidebar
│   ├── addSettingTab()                   # Tab impostazioni
│   └── registerMarkdownCodeBlockProcessor()  # Code block processor
│
└── onunload()
    ├── ribbonIconEl.remove()             # Rimuovi icona
    └── LocalizationService.destroy()     # Libera traduzioni
```

**Ordine in onload() (importante):**
1. Caricare settings (servono ai componenti successivi)
2. Inizializzare i18n (serve prima di qualsiasi UI)
3. Registrare comandi, ribbon, settings tab, code block processor

### i18n - LocalizationService

```
app/i18n/
├── LocalizationService.ts   # Servizio singleton
├── index.ts                 # Barrel export (unico barrel permesso)
└── locales/
    └── en.json              # Stringhe inglese
```

**Comportamento:**
- Singleton: una sola istanza per sessione
- Auto-detect della locale Obsidian via `window.moment.locale()`
- Carica il JSON corrispondente da `locales/`
- Fallback a `en` in caso di errore

**Uso nelle feature:**
```typescript
import { LocalizationService } from "@app/i18n";

const t = LocalizationService.getInstance()?.t.bind(LocalizationService.getInstance());
const title = t?.("settings.title") ?? "Settings";
```

## Regole

### Dipendenze Consentite
- Puo importare da **Infrastructure** (types, utils, constants)
- **Non** puo importare da Features

### Gestione Risorse
- Tutto cio che viene creato in `onload()` deve avere un corrispondente cleanup in `onunload()`
- Usare `registerEvent()` e `addCommand()` per auto-cleanup dove possibile
- Non rimuovere le leaf in `onunload()` (preserva il layout utente)

### Settings
- `loadSettings()` usa `Object.assign({}, DEFAULT_SETTINGS, storedData)` per forward-compatibility
- `saveSettings()` persiste l'intero oggetto settings
- I nuovi campi devono sempre avere un default in `DEFAULT_SETTINGS`

## Come Aggiungere un Nuovo Servizio Core

1. Creare `app/services/[ServiceName].ts` (creare la cartella `services/` se non esiste)
2. Inizializzare in `main.ts → onload()` dopo le sue dipendenze
3. Aggiungere cleanup in `main.ts → onunload()` se gestisce risorse
4. Import diretto, nessun barrel file
5. Esporre tramite plugin instance solo se serve accesso esterno
