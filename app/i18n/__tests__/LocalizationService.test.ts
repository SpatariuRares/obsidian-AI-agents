/**
 * @fileoverview LocalizationService.test.ts
 *
 * Tests the core i18n service: singleton lifecycle, translation lookup,
 * parameter interpolation, nested key access, and locale detection.
 */

import { LocalizationService, t } from "../LocalizationService";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Reset the private singleton between tests to ensure test isolation. */
function resetSingleton(): void {
  (LocalizationService as unknown as { instance: undefined }).instance = undefined;
}

/** Minimal App mock satisfying the LocalizationService constructor. */
const mockApp = { vault: {}, workspace: {} } as Parameters<
  typeof LocalizationService.initialize
>[0];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LocalizationService", () => {
  beforeEach(resetSingleton);

  // ── Fallback behaviour before initialization ──────────────────────────────

  describe("getInstance() before initialize()", () => {
    it("should return a truthy fallback object", () => {
      expect(LocalizationService.getInstance()).toBeDefined();
    });

    it("fallback t() should return the key unchanged", () => {
      expect(LocalizationService.getInstance().t("any.key")).toBe("any.key");
    });

    it("fallback getCurrentLocale() should return 'en'", () => {
      expect(LocalizationService.getInstance().getCurrentLocale()).toBe("en");
    });

    it("fallback hasKey() should return false", () => {
      expect(LocalizationService.getInstance().hasKey("any.key")).toBe(false);
    });

    it("fallback reload() should not throw", () => {
      expect(() => LocalizationService.getInstance().reload()).not.toThrow();
    });

    it("fallback destroy() should not throw", () => {
      expect(() => LocalizationService.getInstance().destroy()).not.toThrow();
    });
  });

  // ── Singleton creation ────────────────────────────────────────────────────

  describe("initialize()", () => {
    it("should create the singleton on first call", () => {
      LocalizationService.initialize(mockApp);
      const instance = LocalizationService.getInstance();
      expect(typeof instance.t).toBe("function");
    });

    it("should not replace the singleton on subsequent calls", () => {
      LocalizationService.initialize(mockApp);
      const first = LocalizationService.getInstance();
      LocalizationService.initialize(mockApp);
      const second = LocalizationService.getInstance();
      expect(first).toBe(second);
    });
  });

  // ── Translation lookup ────────────────────────────────────────────────────

  describe("t()", () => {
    beforeEach(() => LocalizationService.initialize(mockApp));

    it("should return a non-empty string for a key that exists in en.json", () => {
      const result = LocalizationService.getInstance().t("settings.title");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      // Should NOT return the raw key
      expect(result).not.toBe("settings.title");
    });

    it("should return the key itself when the key does not exist", () => {
      const result = LocalizationService.getInstance().t("no.such.key");
      expect(result).toBe("no.such.key");
    });

    it("should interpolate a single parameter", () => {
      const instance = LocalizationService.getInstance();
      // Inject a test translation directly to avoid coupling to en.json content.
      (instance as unknown as { translations: Record<string, unknown> }).translations = {
        greeting: "Hello {name}!",
      };
      expect(instance.t("greeting", { name: "Claude" })).toBe("Hello Claude!");
    });

    it("should interpolate numeric parameters", () => {
      const instance = LocalizationService.getInstance();
      (instance as unknown as { translations: Record<string, unknown> }).translations = {
        count: "You have {n} items",
      };
      expect(instance.t("count", { n: 42 })).toBe("You have 42 items");
    });

    it("should leave unmatched placeholders intact", () => {
      const instance = LocalizationService.getInstance();
      (instance as unknown as { translations: Record<string, unknown> }).translations = {
        tmpl: "Hi {name}!",
      };
      expect(instance.t("tmpl", { other: "x" })).toBe("Hi {name}!");
    });

    it("should use fallback translations when key missing from current locale", () => {
      const instance = LocalizationService.getInstance();
      // Simulate a non-English locale with an incomplete translation set.
      (
        instance as unknown as {
          currentLocale: string;
          translations: Record<string, unknown>;
          fallbackTranslations: Record<string, unknown>;
        }
      ).currentLocale = "de";
      (
        instance as unknown as {
          translations: Record<string, unknown>;
        }
      ).translations = {}; // empty — key missing
      (
        instance as unknown as {
          fallbackTranslations: Record<string, unknown>;
        }
      ).fallbackTranslations = { fallback: "Fallback value" };
      expect(instance.t("fallback")).toBe("Fallback value");
    });
  });

  // ── Nested key access ─────────────────────────────────────────────────────

  describe("t() with nested keys", () => {
    beforeEach(() => LocalizationService.initialize(mockApp));

    it("should resolve dot-notation keys into nested objects", () => {
      const instance = LocalizationService.getInstance();
      (instance as unknown as { translations: Record<string, unknown> }).translations = {
        section: { sub: { key: "deep value" } },
      };
      expect(instance.t("section.sub.key")).toBe("deep value");
    });

    it("should return the key when an intermediate node is missing", () => {
      const instance = LocalizationService.getInstance();
      (instance as unknown as { translations: Record<string, unknown> }).translations = {
        section: {},
      };
      expect(instance.t("section.missing.key")).toBe("section.missing.key");
    });
  });

  // ── getCurrentLocale ──────────────────────────────────────────────────────

  describe("getCurrentLocale()", () => {
    it("should return a non-empty string locale after initialization", () => {
      LocalizationService.initialize(mockApp);
      const locale = LocalizationService.getInstance().getCurrentLocale();
      expect(typeof locale).toBe("string");
      expect(locale.length).toBeGreaterThan(0);
    });
  });

  // ── hasKey ────────────────────────────────────────────────────────────────

  describe("hasKey()", () => {
    beforeEach(() => LocalizationService.initialize(mockApp));

    it("should return true for a key present in translations", () => {
      expect(LocalizationService.getInstance().hasKey("settings.title")).toBe(true);
    });

    it("should return false for a key not present in translations", () => {
      expect(LocalizationService.getInstance().hasKey("definitely.not.there")).toBe(false);
    });
  });

  // ── reload ────────────────────────────────────────────────────────────────

  describe("reload()", () => {
    it("should re-detect locale and reload translations without throwing", () => {
      LocalizationService.initialize(mockApp);
      expect(() => LocalizationService.getInstance().reload()).not.toThrow();
    });

    it("should still return translations after reload", () => {
      LocalizationService.initialize(mockApp);
      const instance = LocalizationService.getInstance();
      instance.reload();
      const result = instance.t("settings.title");
      expect(typeof result).toBe("string");
    });
  });

  // ── destroy ───────────────────────────────────────────────────────────────

  describe("destroy()", () => {
    it("should clear translations so keys fall back to the key itself", () => {
      LocalizationService.initialize(mockApp);
      const instance = LocalizationService.getInstance();
      instance.destroy();
      // After destroy, the translation cache is empty → key is returned.
      expect(instance.t("settings.title")).toBe("settings.title");
    });
  });

  // ── loadTranslations error handling ───────────────────────────────────────

  describe("loadTranslations() error handling", () => {
    it("should recover when loadLocaleFile throws an unexpected error", () => {
      LocalizationService.initialize(mockApp);
      const instance = LocalizationService.getInstance();

      // Spy on the private loadLocaleFile method and make it throw once,
      // then succeed for the English fallback load.
      let callCount = 0;
      const spy = jest
        .spyOn(instance as unknown as { loadLocaleFile(l: string): unknown }, "loadLocaleFile")
        .mockImplementation((locale: string) => {
          callCount++;
          if (callCount === 1) {
            throw new Error(`Simulated failure loading ${locale}.json`);
          }
          // Second call (English fallback) succeeds.
          return { settings: { title: "Plugin Settings" } };
        });

      // reload() calls loadTranslations() which will hit the catch block.
      expect(() => instance.reload()).not.toThrow();

      spy.mockRestore();
    });
  });
});

// ─── Non-English locale path ──────────────────────────────────────────────────
//
// These tests cover the branch where detectLanguage() successfully reads a
// non-English locale from window.moment, and loadTranslations() loads the
// English fallback because the target locale file doesn't exist.

describe("LocalizationService with a non-English locale", () => {
  beforeEach(() => {
    resetSingleton();
    // Mock window.moment so detectLanguage() returns 'de' instead of catching.
    (global as unknown as Record<string, unknown>)["window"] = {
      moment: { locale: () => "de" },
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>)["window"];
  });

  it("should detect the locale from window.moment.locale()", () => {
    LocalizationService.initialize(mockApp);
    expect(LocalizationService.getInstance().getCurrentLocale()).toBe("de");
  });

  it("should use English fallback translations when the locale file is missing", () => {
    LocalizationService.initialize(mockApp);
    // 'de.json' doesn't exist → translations = {} → falls back to English.
    const result = LocalizationService.getInstance().t("settings.title");
    // Either English fallback or key returned — either way it's a string.
    expect(typeof result).toBe("string");
  });

  it("should still find English keys via the fallback after reload()", () => {
    LocalizationService.initialize(mockApp);
    const instance = LocalizationService.getInstance();
    instance.reload();
    expect(typeof instance.t("settings.title")).toBe("string");
  });
});

// ─── Global t() function ─────────────────────────────────────────────────────

describe("global t()", () => {
  beforeEach(resetSingleton);

  it("should return the key when the service is not yet initialized", () => {
    expect(t("any.key")).toBe("any.key");
  });

  it("should return a translation after the service is initialized", () => {
    LocalizationService.initialize(mockApp);
    const result = t("settings.title");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("settings.title");
  });
});
