import { TAbstractFile, AbstractInputSuggest, App } from "obsidian";

export class PathSuggest extends AbstractInputSuggest<TAbstractFile> {
    private inputEl: HTMLInputElement;

    constructor(app: App, textInputEl: HTMLInputElement) {
        super(app, textInputEl);
        this.inputEl = textInputEl;
    }

    getSuggestions(query: string): TAbstractFile[] {
        const files = this.app.vault.getAllLoadedFiles();
        const lowerCaseQuery = query.toLowerCase();

        return files.filter(file => file.path.toLowerCase().includes(lowerCaseQuery));
    }

    renderSuggestion(file: TAbstractFile, el: HTMLElement): void {
        el.setText(file.path);
    }

    selectSuggestion(file: TAbstractFile): void {
        this.inputEl.value = file.path;
        this.inputEl.trigger("input");
        this.close();
    }
}
