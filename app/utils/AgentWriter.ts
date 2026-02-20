import { App, normalizePath, stringifyYaml } from "obsidian";
import { AgentConfig } from "@app/types/AgentTypes";

export class AgentWriter {
    static async saveAgent(
        app: App,
        agentsFolder: string,
        id: string,
        config: AgentConfig,
        promptTemplate: string
    ): Promise<string> {
        const folderPath = normalizePath(`${agentsFolder}/${id}`);
        const filePath = normalizePath(`${folderPath}/agent.md`);

        // Check if folder exists, if not create it
        const folderExists = await app.vault.adapter.exists(folderPath);
        if (!folderExists) {
            await app.vault.createFolder(folderPath);
        }

        // Generate the file content
        // Note: stringifyYaml adds a trailing newline, so we just append ---
        const yamlString = stringifyYaml(config);
        // eslint-disable-next-line i18next/no-literal-string
        const fileContent = `---\n${yamlString}---\n\n${promptTemplate}\n`;

        // Check if file exists to modify or create
        const fileExists = await app.vault.adapter.exists(filePath);
        if (fileExists) {
            const file = app.vault.getAbstractFileByPath(filePath);
            if (file) {
                // @ts-ignore - casting to TFile
                await app.vault.modify(file, fileContent);
            } else {
                await app.vault.adapter.write(filePath, fileContent);
            }
        } else {
            await app.vault.create(filePath, fileContent);
        }

        return filePath;
    }
}
