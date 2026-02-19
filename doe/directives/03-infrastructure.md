# Layer 3 - Infrastructure

## Cos'e

Il layer Infrastructure contiene le **fondamenta condivise** del progetto: tipi, utility, costanti, componenti riutilizzabili e stili. Non ha dipendenze verso gli altri layer.

## Componenti

### Types

```
app/types/
└── PluginTypes.ts    # PluginSettings interface + DEFAULT_SETTINGS
```

- Definisce le interfacce e i tipi condivisi
- `PluginSettings` e l'interfaccia centrale per le impostazioni
- `DEFAULT_SETTINGS` fornisce i valori iniziali
- Aggiungere nuovi tipi come file separati (es. `app/types/ViewTypes.ts`)
- Import diretto: `import { PluginSettings } from "@app/types/PluginTypes"`

### Utils

```
app/utils/
├── ExampleUtils.ts
└── __tests__/
    └── ExampleUtils.test.ts
```

- **Funzioni pure e stateless**: nessun side effect
- Ogni utility in un file dedicato
- Test co-locati in `__tests__/`
- Import diretto: `import { greet } from "@app/utils/ExampleUtils"`
- Nessun barrel file

### Constants

```
app/constants/
└── [ConstantFile].ts
```

- Valori costanti condivisi tra feature
- Enums, magic strings, configurazioni statiche
- Import diretto dal file specifico

### Components (Atomic Design)

```
app/components/
├── atoms/                   # Elementi UI minimi e indivisibili
│   ├── Button.ts
│   ├── Icon.ts
│   ├── Label.ts
│   └── __tests__/
└── molecules/               # Composizioni di atoms con logica propria
    ├── SettingRow.ts
    ├── SearchBar.ts
    └── __tests__/
```

Il sistema di componenti segue il pattern **Atomic Design** con due livelli:

**Atoms** - L'unita UI piu piccola e indivisibile:
- Un singolo elemento DOM con un'unica responsabilita
- Nessuna logica di business, solo presentazione
- Configurabili tramite parametri (label, classe CSS, callback)
- Esempio: un bottone, un'icona, un'etichetta di testo

**Molecules** - Composizioni di atoms che formano un'unita funzionale:
- Combinano 2+ atoms in un componente con significato proprio
- Possono contenere logica di interazione interna
- Riutilizzabili in piu feature
- Esempio: una riga di impostazione (label + toggle), una barra di ricerca (input + icona + bottone)

**Regole comuni:**
- Elementi DOM costruiti esclusivamente con `createEl()`, `createDiv()`, `createSpan()`
- Mai `innerHTML` per sicurezza
- Stili tramite classi CSS e variabili Obsidian, mai inline
- Atoms non importano da molecules (dipendenza solo verso il basso)

### Styles

```
app/styles/
├── _variables.scss     # Documentazione variabili CSS Obsidian
└── _base.scss          # Stili base del plugin (BEM)
styles.source.scss      # Entry point SCSS (root del progetto)
styles.css              # Output compilato (git-ignored)
```

**Regole CSS:**
- Mai colori hardcoded, usare variabili CSS Obsidian
- Convenzione BEM: root `.obsidian-plugin-template` con `__element` e `--modifier`
- Variabili principali: `--background-primary`, `--text-normal`, `--interactive-accent`
- Build: `node build-css.mjs` compila SCSS in `styles.css`

## Regole

### Zero Dipendenze Verso l'Alto
- Infrastructure **non importa** da Core o Features
- E il layer piu stabile e indipendente
- Tutti gli altri layer possono importare da qui

### Import
- Sempre `@app/*` path alias
- Mai barrel file (import diretto dal file specifico)
- Eccezione: `app/i18n/index.ts` (ma quello e nel layer Core)

### Testing
- Utility: test co-locati in `__tests__/`
- Components: test co-locati in `__tests__/`
- Copertura minima: 90%

### TypeScript Strict

```json
{
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true
}
```

## Come Aggiungere Nuovi Elementi

### Nuovo Tipo
1. Creare `app/types/[NomeTipo].ts`
2. Esportare interfacce e costanti correlate
3. Import diretto: `import { MyType } from "@app/types/NomeTipo"`

### Nuovo Utility
1. Creare `app/utils/[NomeUtil].ts` con funzioni pure
2. Creare `app/utils/__tests__/[NomeUtil].test.ts`
3. Import diretto: `import { fn } from "@app/utils/NomeUtil"`

### Nuovo Atom
1. Creare `app/components/atoms/[NomeAtom].ts`
2. Singola responsabilita, nessuna logica di business
3. Usare solo `createEl()` e API DOM Obsidian
4. Creare `app/components/atoms/__tests__/[NomeAtom].test.ts`

### Nuova Molecule
1. Creare `app/components/molecules/[NomeMolecule].ts`
2. Comporre atoms esistenti in un'unita funzionale
3. Creare `app/components/molecules/__tests__/[NomeMolecule].test.ts`

### Nuova Costante
1. Aggiungere a un file esistente in `app/constants/` se tematicamente correlata
2. Oppure creare `app/constants/[NomeFile].ts` per un nuovo gruppo
