# Layer 1 - Features

## Cos'e

Il layer Features contiene i **moduli funzionali** del plugin. Ogni feature e un'unita autonoma e isolata che implementa una funzionalita specifica rivolta all'utente.

## Cartella

```
app/features/
├── example/
│   ├── ExampleView.ts           # Code block processor (MarkdownRenderChild)
│   └── __tests__/
│       └── ExampleView.test.ts
├── settings/
│   ├── ExampleSettingsTab.ts    # Settings tab (PluginSettingTab)
│   └── __tests__/
│       └── ExampleSettingsTab.test.ts
└── [nuova-feature]/
    ├── [Feature].ts
    └── __tests__/
```

## Regole

### Isolamento
- Ogni feature vive nella propria cartella sotto `app/features/`
- Una feature non importa mai direttamente da un'altra feature
- Se due feature condividono logica, questa va estratta in Infrastructure (utils o components)

### Dipendenze Consentite
- Puo importare da **Core** (i18n, plugin instance)
- Puo importare da **Infrastructure** (types, utils, constants, components)
- **Non** puo importare da altre feature

### Naming
- Cartella: lowercase con trattini (`my-feature`)
- File: PascalCase (`MyFeatureView.ts`)
- Test co-locati in `__tests__/`

## Pattern: Code Block Processor

Una feature che renderizza un fenced code block personalizzato.

**Struttura:**
1. Classe che estende `MarkdownRenderChild`
2. `onload()` - parsing del sorgente YAML + rendering DOM con `createEl()`
3. `onunload()` - cleanup di listener e riferimenti
4. Registrazione in `main.ts` via `registerMarkdownCodeBlockProcessor()`

**Esempio d'uso nelle note:**
````markdown
```example-block
title: Titolo
color: accent
```
````

## Pattern: Settings Tab

Una feature che espone configurazioni nell'interfaccia impostazioni.

**Struttura:**
1. Classe che estende `PluginSettingTab`
2. `display()` - costruisce i controlli con l'API `Setting`
3. Ogni `onChange` persiste via `plugin.saveSettings()`

**Tipi di controllo:**
- `addToggle` - boolean
- `addText` - stringa libera
- `addDropdown` - selezione da opzioni

## Come Aggiungere una Nuova Feature

1. Creare la cartella `app/features/[nome-feature]/`
2. Creare il file principale (`[NomeFeature]View.ts` o `[NomeFeature]Tab.ts`)
3. Creare `__tests__/[NomeFeature].test.ts`
4. Registrare in `main.ts → onload()`
5. Aggiungere cleanup in `main.ts → onunload()` se necessario
6. Aggiungere chiavi di traduzione in `app/i18n/locales/en.json`
