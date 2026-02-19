# 3 Layers Architecture - Overview

Il codice del plugin e organizzato in **3 layer** che separano le responsabilita in modo chiaro e mantenibile.

## I 3 Layer

```
┌─────────────────────────────────────────────┐
│  FEATURES                                   │
│  Moduli funzionali del plugin               │
│  Ogni feature e autonoma e isolata          │
├─────────────────────────────────────────────┤
│  CORE                                       │
│  Servizi centrali e lifecycle del plugin    │
│  i18n, entry point, configurazione          │
├─────────────────────────────────────────────┤
│  INFRASTRUCTURE                             │
│  Fondamenta condivise                       │
│  Tipi, utility, costanti, stili            │
└─────────────────────────────────────────────┘
```

## Flusso delle Dipendenze

```
Features  ──>  Core  ──>  Infrastructure
   │                          ▲
   └──────────────────────────┘
```

- **Features** possono importare da Core e Infrastructure
- **Core** puo importare solo da Infrastructure
- **Infrastructure** non importa dagli altri layer (zero dipendenze verso l'alto)

## Mapping sulle Cartelle

```
ai-agent/
├── main.ts                      # CORE - Entry point e lifecycle
├── app/
│   ├── features/                # FEATURES
│   │   ├── example/             #   Code block processor
│   │   ├── settings/            #   Settings tab
│   │   └── [nuova-feature]/     #   Ogni nuova funzionalita qui
│   ├── i18n/                    # CORE - Servizio di localizzazione
│   ├── components/              # INFRASTRUCTURE - Componenti UI (Atomic Design)
│   │   ├── atoms/               #   Elementi UI minimi e indivisibili
│   │   └── molecules/           #   Composizioni di atoms
│   ├── constants/               # INFRASTRUCTURE - Costanti condivise
│   ├── types/                   # INFRASTRUCTURE - Interfacce e tipi
│   ├── utils/                   # INFRASTRUCTURE - Funzioni pure
│   └── styles/                  # INFRASTRUCTURE - SCSS e variabili CSS
```

## Regole Generali

- Usare sempre import con path alias `@app/*`
- Mai barrel file tranne `app/i18n/index.ts`
- Ogni feature e autocontenuta nella propria cartella
- I test sono co-locati in cartelle `__tests__/` accanto al sorgente
- Copertura test minima: 90%

## Navigazione

- [Layer Features](01-features.md)
- [Layer Core](02-core.md)
- [Layer Infrastructure](03-infrastructure.md)
- [Linee Guida](04-guidelines.md)
