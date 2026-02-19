# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## DOE Framework for AI Development

This project follows the **DOE Framework** (Directive, Orchestration, Execution) for AI-assisted development. This framework ensures reliable, maintainable, and self-improving code.

### Framework Architecture

#### D - Directive Layer (The Manager)

**What**: Documentation files (Markdown SOPs - Standard Operating Procedures) written in natural language.

**Function**: Defines **what** needs to be done:

- Objectives and strategies
- Required inputs and outputs
- Which scripts/tools to use
- How to handle edge cases
- Project-specific patterns and conventions

**Analogy**: The manager who establishes rules and strategy but doesn't execute the work directly.

**In this project**: This CLAUDE.md file serves as the primary directive, along with inline documentation and architectural decisions.

#### O - Orchestration Layer (The Employee)

**What**: The LLM itself (Claude Code) working within the development environment.

**Function**: Acts as the **bridge** between directives and execution:

- Reads and interprets directives (D)
- Decides which execution tools (E) to activate
- Follows established procedures rather than inventing solutions
- Delegates complex, deterministic tasks to scripts/tools

**Analogy**: The employee who receives orders from the manager and executes the plan using provided tools.

**Critical Rule**: The orchestrator should **follow procedures**, not invent complex implementations. When complexity is needed, delegate to deterministic code (E layer).

#### E - Execution Layer (The Tools)

**What**: Deterministic scripts, build tools, tests, and automation.

**Function**: Executes the **"dirty work"**:

- Build system (esbuild, SCSS compiler, TypeScript compiler)
- Test suite (Jest)
- Linting and formatting (ESLint)
- Data processing scripts
- API calls and external integrations

**Analogy**: The tools and machinery that the employee uses to complete the work.

**Philosophy**: Delegate complexity to **rigid, deterministic code** rather than probabilistic AI reasoning. Scripts don't hallucinate or make random mistakes.

### Self-Learning Mechanism

The DOE framework includes a **self-improvement loop**:

1. **Error Detection**: When a script (E) fails, the orchestrator (O) reads error logs
2. **Root Cause Analysis**: Understanding the problem and its context
3. **Script Correction**: Autonomously rewriting the script to fix the issue
4. **Directive Update**: If necessary, updating directives (D) to prevent future occurrences
5. **Knowledge Accumulation**: The system becomes more robust with each error encountered

**Result**: The system transitions from **probabilistic** (typical AI behavior) to **deterministic and reliable** behavior over time.

### Applying DOE in This Project

When working on this codebase:

1. **Consult Directives First**: Always read this CLAUDE.md and related documentation before implementing features
2. **Follow Established Patterns**: Use the patterns described in "Key Development Patterns" section
3. **Delegate to Tools**:
   - Use build system for compilation
   - Use Jest for testing
   - Use ESLint for code quality
   - Don't manually validate what tools can check
4. **Update Documentation**: When discovering new patterns or solving complex problems, update this CLAUDE.md
5. **Prefer Code Over Instructions**: For complex logic, create deterministic utilities/services rather than relying on AI reasoning each time

**Example**:

- ❌ **Wrong**: Manually processing data in a component each time
- ✅ **Right**: Create a dedicated service/utility (E layer) with deterministic logic

## Development Commands

```bash
npm run dev          # Development build with watch mode (CSS + esbuild)
npm run build        # Production build (tsc check + CSS + minified bundle)
npm test             # Run Jest test suite
npm run test:watch   # Jest in watch mode
npm run test:coverage # Jest with coverage report
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run version      # Bump version in manifest.json and versions.json
```

**Run single test**: `npm test -- app/utils/__tests__/ExampleUtils.test.ts`

## Build System

1. **CSS**: `node build-css.mjs` - SCSS compiles `styles.source.scss` → `styles.css`
2. **TypeScript**: `tsc -noEmit -skipLibCheck` - Type checking only (no emit)
3. **Bundle**: esbuild bundles `main.ts` → `main.js` with Obsidian externals

The build process is sequential and must complete in order. Development mode (`npm run dev`) watches for changes and rebuilds automatically.

## Project Architecture

**Plugin Type**: Obsidian plugin template — a clean starting point for building TypeScript-based Obsidian plugins with a working settings tab, code block processor, i18n, and full dev tooling.

**Core Principles:**

- **Feature-Based Organisation**: Code grouped by feature rather than by technical layer
- **Type Safety**: Strict TypeScript with path aliases (`@app/*`)
- **i18n Ready**: Localisation service initialised on load, English locale included
- **Embedded Views**: Example code block processor (`example-block`) demonstrates the `MarkdownRenderChild` pattern

### TypeScript Configuration

```json
{
  "baseUrl": ".",
  "paths": { "@app/*": ["app/*"] },
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true
}
```

**Always use `@app/*` imports instead of relative paths** (e.g., `@app/features/settings/ExampleSettingsTab` not `../../features/settings/ExampleSettingsTab`)

### Main Plugin (main.ts)

```
ObsidianPluginTemplate (extends Plugin)
├── onload()
│   ├── loadSettings()                  # Merge stored data with DEFAULT_SETTINGS
│   ├── LocalizationService.initialize() # i18n setup
│   ├── addCommand()                    # Example command (Notice)
│   ├── addRibbonIcon()                 # Sidebar ribbon icon
│   ├── addSettingTab()                 # ExampleSettingsTab
│   └── registerMarkdownCodeBlockProcessor() # 'example-block' → ExampleView
│
└── onunload()
    ├── ribbonIconEl.remove()           # Clean up ribbon icon
    └── LocalizationService.destroy()   # Free translation data
```

**Key Lifecycle:**

1. `onload()`: Load settings → initialise i18n → register command → add ribbon → attach settings tab → register code block processor
2. `onunload()`: Remove ribbon icon, destroy LocalizationService

### Template Directory Structure

```
ai-agent/
├── main.ts                          # Plugin entry point
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
│   ├── components/
│   │   ├── atoms/                   # Minimal, indivisible UI elements
│   │   └── molecules/               # Compositions of atoms with own logic
│   ├── styles/
│   │   ├── _base.scss               # Base plugin styles (BEM)
│   │   └── _variables.scss          # Obsidian CSS variable documentation
│   ├── types/
│   │   └── PluginTypes.ts           # PluginSettings interface + DEFAULT_SETTINGS
│   └── utils/
│       ├── ExampleUtils.ts          # Example pure utility function
│       └── __tests__/
├── __mocks__/
│   └── obsidian.ts                  # Jest mocks for Obsidian API
└── styles.source.scss               # SCSS entry point
```

### Example Code Block Processor (ExampleView)

`ExampleView` extends `MarkdownRenderChild` and handles the `example-block` fenced code block:

````markdown
```example-block
title: My Title
color: accent
```
````

- **YAML parsing**: Uses Obsidian's `parseYaml()` with typed `ExampleBlockParams` interface
- **DOM safety**: Renders exclusively via `createEl`/`createDiv` (no `innerHTML`)
- **Lifecycle**: `onload()` builds DOM; `onunload()` provides teardown hook
- **Colour tokens**: `accent` → `--interactive-accent`, `warning` → `--text-warning`, `error` → `--text-error`

### Settings Tab (ExampleSettingsTab)

`ExampleSettingsTab` extends `PluginSettingTab` and demonstrates three core settings patterns:

- **Toggle** (`addToggle`) — `exampleToggle: boolean`
- **Text input** (`addText`) — `exampleText: string`
- **Dropdown** (`addDropdown`) — `exampleDropdown: string`

All settings persist immediately via `plugin.saveSettings()` in each `onChange` callback.

### i18n (LocalizationService)

Singleton service that auto-detects the user's Obsidian locale via `window.moment.locale()` and loads the matching JSON from `app/i18n/locales/`. Falls back to `en` on any error.

**Adding a new language:**

1. Copy `app/i18n/locales/en.json` → `app/i18n/locales/<locale>.json` (e.g., `de.json`)
2. Translate all values (keep the keys identical)
3. Add a dynamic import case in `LocalizationService.loadLocaleFile()` for the new locale code

**Translation usage:**

```typescript
import { LocalizationService } from "@app/i18n";

const t = LocalizationService.getInstance()?.t.bind(LocalizationService.getInstance());
const title = t?.("settings.title") ?? "Settings";
```

## Key Development Patterns

### Adding New Code Block Processors

1. Create a view class extending `MarkdownRenderChild` in `app/features/[feature]/`
2. Implement `onload()` to parse the code block source and render DOM
3. Implement `onunload()` for cleanup (remove listeners, clear references)
4. Register in `main.ts` via `this.registerMarkdownCodeBlockProcessor('block-name', ...)`
5. Add inline comments explaining the YAML parameters and DOM structure

### Adding New Settings

1. Add the new field to `PluginSettings` interface in `app/types/PluginTypes.ts`
2. Add a sensible default to `DEFAULT_SETTINGS` in the same file
3. Add a corresponding `Setting` entry in `ExampleSettingsTab.display()`
4. Persist changes via `plugin.saveSettings()` in the `onChange` callback
5. Add translation keys to `app/i18n/locales/en.json`

### Adding New Commands

1. Call `this.addCommand({ id, name, callback })` in `main.ts → onload()`
2. Use `callback` for unconditional commands, `checkCallback` for conditional ones
3. Keep the command `id` short and lowercase (no "command" suffix — ESLint rule)
4. Keep the command `name` in sentence case (no "command" suffix — ESLint rule)

### Adding New Components (Atomic Design)

The `app/components/` directory follows **Atomic Design** with two levels:

**Atoms** (`app/components/atoms/`) — The smallest, indivisible UI unit:
- A single DOM element with one responsibility
- No business logic, presentation only
- Configurable via parameters (label, CSS class, callback)
- Example: a button, an icon, a text label

**Molecules** (`app/components/molecules/`) — Compositions of atoms forming a functional unit:
- Combine 2+ atoms into a component with its own meaning
- May contain internal interaction logic
- Reusable across multiple features
- Example: a setting row (label + toggle), a search bar (input + icon + button)

**Rules:**
- Build DOM exclusively with `createEl()`, `createDiv()`, `createSpan()` — never `innerHTML`
- Style via CSS classes and Obsidian variables, never inline
- Atoms must not import from molecules (dependency flows downward only)
- Co-located tests in `__tests__/`

1. **Atom**: Create `app/components/atoms/[AtomName].ts` — single responsibility, no business logic
2. **Molecule**: Create `app/components/molecules/[MoleculeName].ts` — compose existing atoms
3. Write tests in the corresponding `__tests__/` directory
4. Import directly: `import { MyAtom } from "@app/components/atoms/MyAtom"` (no barrel file)

### Adding New Utilities

1. Create a pure function module in `app/utils/[UtilName].ts`
2. Write co-located tests in `app/utils/__tests__/[UtilName].test.ts`
3. Import directly: `import { myUtil } from "@app/utils/MyUtil"` (no barrel file)
4. Avoid side effects — utilities should be stateless pure functions

### Adding New Services

1. Create the service in `app/services/[ServiceName].ts` (create `services/` directory if needed)
2. Initialise in `main.ts → onload()` after any dependencies it requires
3. Add cleanup in `main.ts → onunload()` if the service manages resources
4. Expose through the plugin instance only if external code needs access
5. DO NOT create a barrel `index.ts` — import services directly

## Testing

**Framework**: Jest with ts-jest
**Coverage Target**: 90% (statements, branches, functions, lines)

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
npm test -- app/utils/__tests__/ExampleUtils.test.ts  # Single file
```

**Test Organisation:**

- Tests in `__tests__/` directories co-located with source files
- Mock Obsidian API: `__mocks__/obsidian.ts` (at project root)
- The `Setting` mock immediately invokes builder callbacks (`addToggle`, `addText`, `addDropdown`) and fires `onChange` with safe defaults so settings tab `onChange` bodies are exercised

**Coverage Configuration:**

```javascript
collectCoverageFrom: [
  "app/**/*.ts",
  "!app/**/__tests__/**",
  "!app/**/*.test.ts",
  "!app/**/index.ts",   // Barrel files excluded
  "!app/**/*.d.ts",
];
```

**Test Patterns:**

- Group tests by feature/behaviour using `describe()`
- Use descriptive test names: `it("should return greeting with trimmed name")`
- Access private methods in tests via `(instance as any).methodName()` when needed to cover unreachable branches
- Mock plugin instance and app instance for component tests

## Barrel Files Strategy

**✅ DO use barrel files for:**

- i18n: `app/i18n/index.ts` (re-exports `LocalizationService`)

**❌ DO NOT use barrel files for:**

- Features (import directly from specific files)
- Components (import directly from `@app/components/atoms/Button` or `@app/components/molecules/SearchBar`)
- Utils (import directly from `@app/utils/ExampleUtils`)
- Types (import directly from `@app/types/PluginTypes`)
- Services (import directly from specific service files)

**Rationale**: Barrel files add indirection and can cause circular dependency issues. Only use where they provide genuine organisational value.

## Obsidian Plugin Best Practices

### Critical Rules

- **Use `this.app`** - Never use global `app` or `window.app`
- **Sentence case in UI** - "Open settings" not "Open Settings"
- **Use `setHeading()`** - Not `<h1>` or `<h2>` in settings

### DOM Security

- **Never use `innerHTML`** - Use `createEl()`, `createDiv()`, `createSpan()` helpers
- **Use `el.empty()`** - To clear HTML element contents safely

### Resource Management

- **Clean up on unload** - Use `registerEvent()`, `addCommand()` for auto-cleanup
- **Don't detach leaves** - In `onunload()` to preserve the user's layout
- **Clear caches** - Call service cleanup methods in `onunload()`

### Commands

- **No default hotkeys** - Let users configure their own
- **Use appropriate callback**:
  - `callback` - Unconditional command
  - `checkCallback` - Conditional command (return false to hide)
  - `editorCallback` - Requires active editor

### Workspace

- **Use `getActiveViewOfType(MarkdownView)`** - Not `workspace.activeLeaf` directly
- **Use `app.workspace.iterateRootLeaves()`** - To iterate through all leaves

### Vault Operations

- **Use Vault API** - Not Adapter API (better caching and safety)
- **Use `normalizePath()`** - For user-defined paths
- **Use `Vault.process()`** - For atomic file modifications
- **Use `FileManager.processFrontMatter()`** - For frontmatter modifications

### Styling

- **Use Obsidian CSS variables**:
  - `--background-primary`, `--background-secondary`
  - `--text-normal`, `--text-muted`, `--text-faint`
  - `--interactive-accent`, `--interactive-hover`
- **Never hardcode colors** - Use CSS classes and variables

### Mobile Compatibility

- **Avoid Node/Electron APIs** - Not available on mobile
- **Avoid regex lookbehind** - Only supported iOS 16.4+
- **Test touch interactions** - Use `touchstart`/`touchend` alongside click events

## CSS Organisation

```
app/styles/
├── _variables.scss     # Obsidian CSS variable documentation (comments only)
└── _base.scss          # Base plugin styles using BEM and CSS variables
styles.source.scss      # Entry point — @use's the partials above
styles.css              # Built output (git-ignored)
```

**Build**: `node build-css.mjs` compiles SCSS → outputs `styles.css`

**Usage**: Import Obsidian CSS variables; never hardcode colour values

**BEM convention**: Root class `.obsidian-plugin-template` with `__element` and `--modifier` suffixes. Rename to match your plugin when forking.
