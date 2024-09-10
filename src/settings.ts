import {
  debounce,
  PluginSettingTab,
  prepareFuzzySearch,
  SearchResult,
  Setting
} from "obsidian";
import { type MeData } from "./api/response";
import { createReactModal } from "./ui/modal";
import type MediumPublishPlugin from "./main";
import styles from "./setting.module.css";

export type Settings = {
  token: string;
  assetDirectory: string;
  convertCodeToPng: boolean;
  createTOC: boolean;
  useDarkTheme: boolean;
} & MeData;

export const DEFAULT_SETTINGS: Settings = {
  token: "",
  assetDirectory: "medium-assets",
  id: "",
  username: "",
  name: "",
  url: "",
  imageUrl: "",
  convertCodeToPng: false,
  createTOC: true,
  useDarkTheme: false
};

export class MediumPublishSettingTab extends PluginSettingTab {
  readonly plugin: MediumPublishPlugin;

  constructor(plugin: MediumPublishPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;

    containerEl.empty();

    this.createGroup("Medium");

    new Setting(containerEl)
      .setName("API Token")
      .setDesc("Your Medium API token")
      .addButton((button) =>
        button.setButtonText("Set Token").onClick(async () => {
          createReactModal(this.plugin, "TokenValidatorModal").open();
        })
      );

    this.createGroup("General");

    const setting = new Setting(containerEl)
      .setName("Asset Directory")
      .setDesc("The directory where the plugin will store images");

    this.createItemControl(setting.controlEl);

    new Setting(containerEl)
      .setName("Use Dark Theme")
      .setDesc(
        "Use dark theme for the generated images. Light theme is used by default for better compatibility with Medium"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.useDarkTheme);
        toggle.onChange(async (value) => {
          this.plugin.settings.useDarkTheme = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Code Snippets as PNG")
      .setDesc(
        "Instead of using Medium's code block, convert code snippets to PNG images"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.convertCodeToPng);
        toggle.onChange(async (value) => {
          this.plugin.settings.convertCodeToPng = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Create TOC")
      .setDesc("Create a Table of Contents for the post")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.createTOC);
        toggle.onChange(async (value) => {
          this.plugin.settings.createTOC = value;
          await this.plugin.saveSettings();
        });
      });
  }

  private createItemControl(el: HTMLElement) {
    const input = createEl("input");
    input.type = "text";
    input.spellcheck = false;
    input.value = this.plugin.settings.assetDirectory;
    input.placeholder = "Example: folder 1/folder 2";

    const suggestionContainer = createDiv();
    suggestionContainer.className = "suggestion-container";
    const folders = this.plugin.app.vault.getAllFolders(true).map((folder) => {
      return folder.name.length > 0 ? folder.name : "/";
    });
    let results: {
      item: string;
      result: SearchResult;
    }[] = [];

    const search = () => {
      this.plugin.settings.assetDirectory = input.value;
      this.plugin.saveSettings();

      suggestionContainer.innerHTML = "";
      const search = prepareFuzzySearch(input.value);
      results = [];

      for (const folder of folders) {
        const result = search(folder);
        if (result && result.score <= 0) {
          results.push({
            item: folder,
            result
          });
        }
      }

      results.sort((a, b) => b.result.score - a.result.score);

      for (let i = 0; i < 5 && i < results.length; i++) {
        const div = createDiv();
        div.className = styles["suggestion-item"];
        div.innerText = results[i].item;
        div.tabIndex = 0;
        div.addEventListener("click", () => {
          input.value = results[i].item;
          this.plugin.settings.assetDirectory = results[i].item;
          this.plugin.saveSettings();
          suggestionContainer.remove();
        });

        suggestionContainer.appendChild(div);
      }
    };

    const debouncer = debounce(search, 25);

    input.addEventListener("input", debouncer);

    input.addEventListener("focus", () => {
      suggestionContainer.style.top = `${
        input.getBoundingClientRect().bottom
      }px`;
      suggestionContainer.style.left = `${
        input.getBoundingClientRect().left
      }px`;
      suggestionContainer.style.opacity = "100";
      search();

      document.body.appendChild(suggestionContainer);
    });

    input.addEventListener("blur", () => {
      suggestionContainer.style.opacity = "0";
      setTimeout(() => {
        suggestionContainer.remove();
      }, 150);
    });

    el.appendChild(input);
  }

  private createGroup(title: string) {
    this.containerEl.createEl("h3", { text: title });
  }
}
