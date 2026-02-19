# Linee Guida del Progetto

Regole obbligatorie per lo sviluppo del plugin Obsidian. Derivate dalle linee guida ufficiali Obsidian e dalle convenzioni interne del progetto.

---

## Sicurezza

### DOM
- **Mai** `innerHTML`, `outerHTML`, `insertAdjacentHTML`
- Costruire il DOM con `createEl()`, `createDiv()`, `createSpan()`
- Pulire il contenuto HTML con `el.empty()`

### Accesso all'App
- **Mai** usare `app` globale o `window.app`
- Usare sempre `this.app` dall'istanza del plugin

---

## Gestione Risorse

### Lifecycle
- Tutto cio che viene creato in `onload()` deve avere cleanup in `onunload()`
- Usare `registerEvent()` e `addCommand()` per auto-cleanup
- Non serve rimuovere risorse che vanno in garbage collection con il loro elemento DOM

### Leaf
- **Mai** rimuovere leaf in `onunload()` per preservare il layout utente
- Al ricaricamento del plugin le leaf vengono reinizializzate nella posizione originale

### Servizi
- Distruggere i servizi e svuotare le cache in `onunload()`

---

## Comandi

- **Mai** impostare hotkey di default (rischio conflitti tra plugin)
- ID comando: lowercase, senza suffisso "command"
- Nome comando: sentence case, senza suffisso "command"
- Callback appropriato:
  - `callback` - comando incondizionato
  - `checkCallback` - comando condizionale (return false per nascondere)
  - `editorCallback` - richiede editor attivo

---

## UI e Testo

- **Sentence case** ovunque: "Open settings" non "Open Settings"
- Usare `setHeading()` per i titoli nelle impostazioni, non `<h1>` o `<h2>`
- Non aggiungere heading "General" o nome del plugin come primo heading nelle impostazioni
- Evitare "settings" negli heading delle sezioni impostazioni ("Advanced" non "Advanced settings")
- Heading di sezione solo se ci sono piu sezioni

---

## Workspace

- Usare `getActiveViewOfType(MarkdownView)` per ottenere la view attiva, non `workspace.activeLeaf`
- Usare `app.workspace.activeEditor?.editor` per l'editor attivo
- Usare `app.workspace.getActiveLeavesOfType()` per iterare le leaf di un tipo
- Non mantenere riferimenti a view custom (causa memory leak)

---

## Vault e File

- Preferire **Vault API** (`app.vault`) rispetto a Adapter API (`app.vault.adapter`) per caching e safety
- Usare `Vault.process()` per modifiche atomiche ai file
- Usare `FileManager.processFrontMatter()` per modificare il frontmatter
- Usare `normalizePath()` per tutti i percorsi definiti dall'utente
- Usare `Vault.getFileByPath()` / `getFolderByPath()` per trovare file, mai iterare tutti i file

### Editor
- Preferire **Editor API** rispetto a `Vault.modify()` per il file attivo (preserva cursore, selezione, fold)
- `Vault.modify()` solo per file non aperti, meglio ancora `Vault.process()` per atomicita

---

## Stili CSS

- **Mai** colori hardcoded o stili inline
- Usare classi CSS e variabili Obsidian:
  - Background: `--background-primary`, `--background-secondary`
  - Testo: `--text-normal`, `--text-muted`, `--text-faint`
  - Interazione: `--interactive-accent`, `--interactive-hover`
  - Errori: `--text-error`, `--text-warning`
- Convenzione BEM: `.obsidian-plugin-template__element--modifier`
- Build SCSS: `node build-css.mjs`

---

## TypeScript

- `const` e `let`, mai `var`
- `async/await`, mai catene di `Promise.then()`
- Strict mode: `strict`, `strictNullChecks`, `noImplicitAny`
- Path alias: `@app/*` per tutti gli import

---

## Compatibilita Mobile

- **Mai** usare API Node.js o Electron (non disponibili su mobile)
- **Mai** regex lookbehind (supporto solo da iOS 16.4+)
- Testare interazioni touch: `touchstart`/`touchend` insieme a click

---

## Testing

- Framework: Jest con ts-jest
- Copertura minima: 90% (statements, branches, functions, lines)
- Test co-locati in `__tests__/` accanto al sorgente
- Mock Obsidian API: `__mocks__/obsidian.ts`
- Nomi descrittivi: `it("should return greeting with trimmed name")`
- Raggruppare per feature/comportamento con `describe()`

---

## Import e Moduli

- Sempre `@app/*` path alias, mai percorsi relativi
- Import diretto dal file specifico
- Mai barrel file tranne `app/i18n/index.ts`
- Nessun log in console tranne errori

---

## Logging

- Evitare log non necessari in console
- La console di default deve mostrare solo messaggi di errore
