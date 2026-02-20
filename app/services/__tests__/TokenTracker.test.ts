import { TokenTracker } from "../TokenTracker";
import { PluginSettings, DEFAULT_SETTINGS } from "@app/types/PluginTypes";

describe("TokenTracker", () => {
    let settings: PluginSettings;
    let saveSettingsMock: jest.Mock;
    let tracker: TokenTracker;

    beforeEach(() => {
        saveSettingsMock = jest.fn().mockResolvedValue(undefined);
        settings = { ...DEFAULT_SETTINGS, agentUsage: {} };
        tracker = new TokenTracker(settings, saveSettingsMock);
    });

    it("should initialize agentUsage if not present", () => {
        const s = { ...DEFAULT_SETTINGS } as PluginSettings;
        delete (s as any).agentUsage;
        new TokenTracker(s, saveSettingsMock);
        expect(s.agentUsage).toEqual({});
    });

    it("should update token usage and call saveSettings", async () => {
        await tracker.update("agent1", { promptTokens: 10, completionTokens: 20, totalTokens: 30 });
        expect(settings.agentUsage["agent1"]).toBe(30);
        expect(saveSettingsMock).toHaveBeenCalledTimes(1);

        await tracker.update("agent1", { promptTokens: 5, completionTokens: 5, totalTokens: 10 });
        expect(settings.agentUsage["agent1"]).toBe(40);
        expect(saveSettingsMock).toHaveBeenCalledTimes(2);
    });

    it("should retrieve total tokens correctly", async () => {
        await tracker.update("agent2", { promptTokens: 50, completionTokens: 50, totalTokens: 100 });
        expect(tracker.getTotalTokens("agent2")).toBe(100);
        expect(tracker.getTotalTokens("nonexistent")).toBe(0);
    });

    it("should handle invalid inputs gracefully", async () => {
        await tracker.update("", { promptTokens: 10, completionTokens: 10, totalTokens: 20 });
        await tracker.update("agent3", null as any);
        expect(saveSettingsMock).not.toHaveBeenCalled();
        expect(settings.agentUsage[""]).toBeUndefined();
        expect(settings.agentUsage["agent3"]).toBeUndefined();
    });
});
