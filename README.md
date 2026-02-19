# Obsidian Plugin Template

A clean, opinionated starting point for building [Obsidian](https://obsidian.md) plugins with TypeScript, esbuild, Jest, ESLint, and SCSS.

## Features

- **TypeScript** with strict mode and `@app/*` path aliases
- **esbuild** bundler for fast builds
- **Jest + ts-jest** test suite with 90% coverage threshold
- **ESLint** with Obsidian-specific rules
- **SCSS** compilation pipeline
- **i18n** with a minimal English locale and a ready-to-extend `LocalizationService`
- Working examples: command, ribbon icon, settings tab, and code block processor

## Getting Started

### 1. Clone or fork

```bash
git clone https://github.com/your-username/obsidian-plugin-template my-plugin
cd my-plugin
```

### 2. Update identity

Edit **`manifest.json`**:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What my plugin does",
  "author": "Your Name",
  "authorUrl": "https://github.com/your-username"
}
```

Edit **`package.json`** — update `name`, `description`, and `author`.

### 3. Install dependencies and start developing

```bash
npm install
npm run dev
```

Then copy the plugin folder into your vault's `.obsidian/plugins/` directory, enable it in Obsidian, and start iterating.

## Template Structure

```
my-plugin/
├── main.ts                          # Plugin entry point (ObsidianPluginTemplate)
├── manifest.json                    # Plugin metadata (id, name, version)
├── package.json
├── styles.source.scss               # SCSS entry point
├── app/
│   ├── features/
│   │   ├── example/
│   │   │   ├── ExampleView.ts       # Code block processor (MarkdownRenderChild)
│   │   │   └── __tests__/
│   │   └── settings/
│   │       ├── ExampleSettingsTab.ts # Settings tab (PluginSettingTab)
│   │       └── __tests__/
│   ├── i18n/
│   │   ├── LocalizationService.ts   # Singleton i18n service
│   │   ├── index.ts                 # Barrel export
│   │   ├── locales/
│   │   │   └── en.json              # English strings (add more locales here)
│   │   └── __tests__/
│   ├── styles/
│   │   ├── _base.scss               # Base plugin styles (BEM)
│   │   └── _variables.scss          # Obsidian CSS variable documentation
│   ├── types/
│   │   └── PluginTypes.ts           # PluginSettings interface + DEFAULT_SETTINGS
│   └── utils/
│       ├── ExampleUtils.ts          # Example pure utility function
│       └── __tests__/
└── __mocks__/
    └── obsidian.ts                  # Jest mocks for Obsidian API
```

## Development

| Command | Description |
|---|---|
| `npm run dev` | Watch mode — rebuilds CSS and JS on every save |
| `npm run build` | Production build (type check + CSS + minified bundle) |
| `npm test` | Run Jest test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Type check without emitting files |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |

Run a single test file:

```bash
npm test -- app/utils/__tests__/ExampleUtils.test.ts
```

## What the Examples Demonstrate

### Example command

`main.ts` registers one command (`Run example`) that shows an Obsidian `Notice`. Use this as a starting point for any command.

### Ribbon icon

A ribbon icon (star) is added to the left sidebar. Clicking it shows a `Notice`. Use `addRibbonIcon()` in `onload()` and `ribbonIconEl.remove()` in `onunload()` for proper cleanup.

### Settings tab (`ExampleSettingsTab`)

`app/features/settings/ExampleSettingsTab.ts` demonstrates all three core settings patterns:

- **Toggle** (`addToggle`) — boolean preference
- **Text input** (`addText`) — string preference with placeholder
- **Dropdown** (`addDropdown`) — enum-style preference with labelled options

All settings persist immediately via `plugin.saveSettings()` in each `onChange` callback. See `app/types/PluginTypes.ts` for the `PluginSettings` interface and `DEFAULT_SETTINGS`.

### Code block processor (`ExampleView`)

`app/features/example/ExampleView.ts` handles `example-block` fenced code blocks:

````markdown
```example-block
title: Hello World
color: accent
```
````

It parses YAML parameters using Obsidian's `parseYaml()`, renders DOM safely with `createEl`/`createDiv` (no `innerHTML`), and extends `MarkdownRenderChild` for correct lifecycle management.

## Adding New Features

### New command

```typescript
// in main.ts → onload()
this.addCommand({
  id: 'my-action',
  name: 'Do my action',
  callback: () => new Notice('Hello!'),
});
```

### New setting

1. Add the field to `PluginSettings` in `app/types/PluginTypes.ts`
2. Add a default to `DEFAULT_SETTINGS`
3. Add a `Setting` entry in `ExampleSettingsTab.display()`
4. Add the translation key to `app/i18n/locales/en.json`

### New code block processor

1. Create `app/features/[feature]/[Feature]View.ts` extending `MarkdownRenderChild`
2. Implement `onload()` (parse + render) and `onunload()` (cleanup)
3. Register in `main.ts`:
   ```typescript
   this.registerMarkdownCodeBlockProcessor('my-block', (source, el, ctx) => {
     const view = new MyFeatureView(el, source);
     ctx.addChild(view);
   });
   ```

### New utility

Create a pure function module in `app/utils/MyUtil.ts` and co-locate tests in `app/utils/__tests__/MyUtil.test.ts`. Import directly — no barrel file.

## i18n

Strings live in `app/i18n/locales/en.json`. The `LocalizationService` auto-detects the user's Obsidian locale via `window.moment.locale()` and loads the matching JSON, falling back to English.

**Adding a new language:**

1. Copy `app/i18n/locales/en.json` → `app/i18n/locales/<locale>.json` (e.g., `de.json`)
2. Translate all values (keep the keys identical)
3. Add a dynamic import case in `LocalizationService.loadLocaleFile()` for the new locale code

**Using translations in your code:**

```typescript
import { LocalizationService } from '@app/i18n';

const t = LocalizationService.getInstance()?.t.bind(LocalizationService.getInstance());
const label = t?.('settings.title') ?? 'Settings';
```

## Releasing

This template uses the standard Obsidian plugin release workflow:

1. Bump the version:
   ```bash
   npm run version
   ```
   This updates `manifest.json` and `versions.json` together.

2. Push a git tag matching the version (e.g., `1.0.1`):
   ```bash
   git tag 1.0.1 && git push origin 1.0.1
   ```

3. The included GitHub Actions workflow (`.github/workflows/release.yml`) triggers on the tag, runs `npm run build`, and creates a GitHub Release with `main.js`, `manifest.json`, and `styles.css` as assets.

> Users install the plugin by downloading those three files into `.obsidian/plugins/<plugin-id>/`.

## DOE Framework (Optional)

This template is built with the **DOE Framework** (Directive / Orchestration / Execution) — a development methodology for AI-assisted coding that keeps logic deterministic and documentation current. See `CLAUDE.md` for the full methodology, architectural patterns, and Obsidian best practices.

## License

MIT
