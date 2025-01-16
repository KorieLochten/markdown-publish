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

type CodeFontFamily =
  | "monospace"
  | "Courier New"
  | "Consolas"
  | "Lucida Console"
  | "Source Code Pro"
  | "Fira Code"
  | "Roboto Mono"
  | "Inconsolata";
type GeneralFontFamily =
  | "sans-serif"
  | "Arial"
  | "Arial Black"
  | "Comic Sans MS"
  | "Courier New"
  | "Georgia"
  | "Impact"
  | "Lucida Console"
  | "Lucida Sans Unicode"
  | "Palatino Linotype"
  | "Tahoma"
  | "Times New Roman"
  | "Trebuchet MS"
  | "Verdana";

export type Settings = {
  token: string;
  assetDirectory: string;
  convertCodeToPng: boolean;
  createTOC: boolean;
  useDarkTheme: boolean;
  loadTime: number;
  useCodeBlockLanguageForCaption: boolean;
  ignoreBeginningNewlines: boolean;
  customWidth: boolean;
  targetWidth: number;
  imageScale: number;
  smoothing: boolean;
  generalFontFamily: GeneralFontFamily;
  codeFontFamily: CodeFontFamily;
} & MeData;

export const DEFAULT_SETTINGS: Settings = {
  token: "",
  assetDirectory: "medium-assets",
  id: "",
  username: "",
  name: "",
  url: "",
  imageUrl: "",
  loadTime: 100,
  convertCodeToPng: false,
  createTOC: true,
  useCodeBlockLanguageForCaption: false,
  useDarkTheme: false,
  ignoreBeginningNewlines: true,
  customWidth: false,
  targetWidth: 2560,
  imageScale: 4,
  codeFontFamily: "Lucida Console",
  generalFontFamily: "sans-serif",
  smoothing: true
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
      .setName("Ignore Beginning Newlines")
      .setDesc("Ignore the newlines between the title and the content")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.ignoreBeginningNewlines);
        toggle.onChange(async (value) => {
          this.plugin.settings.ignoreBeginningNewlines = value;
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

    this.createGroup("Image");

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
      .setName("Code Font Family")
      .setDesc("The font family for the code snippets")
      .addDropdown((dropdown) => {
        dropdown.addOption("monospace", "Monospace");
        dropdown.addOption("Courier New", "Courier New");
        dropdown.addOption("Consolas", "Consolas");
        dropdown.addOption("Lucida Console", "Lucida Console");
        dropdown.addOption("Source Code Pro", "Source Code Pro");
        dropdown.addOption("Fira Code", "Fira Code");
        dropdown.addOption("Roboto Mono", "Roboto Mono");
        dropdown.addOption("Inconsolata", "Inconsolata");
        dropdown.setValue(this.plugin.settings.codeFontFamily);
        dropdown.onChange(async (value) => {
          this.plugin.settings.codeFontFamily = value as CodeFontFamily;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("General Font Family")
      .setDesc("The font family for the general text")
      .addDropdown((dropdown) => {
        dropdown.addOption("sans-serif", "Sans Serif");
        dropdown.addOption("Arial", "Arial");
        dropdown.addOption("Arial Black", "Arial Black");
        dropdown.addOption("Comic Sans MS", "Comic Sans MS");
        dropdown.addOption("Courier New", "Courier New");
        dropdown.addOption("Georgia", "Georgia");
        dropdown.addOption("Impact", "Impact");
        dropdown.addOption("Lucida Console", "Lucida Console");
        dropdown.addOption("Lucida Sans Unicode", "Lucida Sans Unicode");
        dropdown.addOption("Palatino Linotype", "Palatino Linotype");
        dropdown.addOption("Tahoma", "Tahoma");
        dropdown.addOption("Times New Roman", "Times New Roman");
        dropdown.addOption("Trebuchet MS", "Trebuchet MS");
        dropdown.addOption("Verdana", "Verdana");
        dropdown.setValue(this.plugin.settings.generalFontFamily);
        dropdown.onChange(async (value) => {
          this.plugin.settings.generalFontFamily = value as GeneralFontFamily;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Use Code Block Language for Caption")
      .setDesc(
        "Use the language of the code block as the caption for the image if caption is not provided"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.useCodeBlockLanguageForCaption);
        toggle.onChange(async (value) => {
          this.plugin.settings.useCodeBlockLanguageForCaption = value;
          await this.plugin.saveSettings();
        });
      });

    const voidElement = document.createElement("div");

    const targetWidth = new Setting(voidElement)
      .setName("Target Width")
      .setDesc("The target width for the images")
      .addText((text) => {
        text.setValue(this.plugin.settings.targetWidth.toString());
        text.onChange(async (value) => {
          if (!this.plugin.settings.customWidth) {
            text.setValue(this.plugin.settings.targetWidth.toString());
            return;
          }
          if (value === "") {
            return;
          }
          const match = value.match(/^\d+$/);
          if (!match) {
            text.setValue(this.plugin.settings.targetWidth.toString());
            return;
          }
          this.plugin.settings.targetWidth = parseInt(value);
          await this.plugin.saveSettings();
        });
      });

    targetWidth.controlEl.style.display = this.plugin.settings.customWidth
      ? "block"
      : "none";

    new Setting(containerEl)
      .setName("Custom Width")
      .setDesc("Use custom width for the images")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.customWidth);
        toggle.onChange(async (value) => {
          this.plugin.settings.customWidth = value;
          targetWidth.setDisabled(!value);
          targetWidth.controlEl.style.display = value ? "block" : "none";
          await this.plugin.saveSettings();
        });
      });

    containerEl.appendChild(voidElement);

    new Setting(containerEl)
      .setName("Image Scale")
      .setDesc("The scale factor for the images")
      .addText((text) => {
        text.setValue(this.plugin.settings.imageScale.toString());
        text.onChange(async (value) => {
          if (value === "") {
            return;
          }
          const match = value.match(/^\d+$/);
          if (!match) {
            text.setValue(this.plugin.settings.imageScale.toString());
            return;
          }
          this.plugin.settings.imageScale = parseInt(value);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Smoothing")
      .setDesc("Use image smoothing")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.smoothing);
        toggle.onChange(async (value) => {
          this.plugin.settings.smoothing = value;
          await this.plugin.saveSettings();
        });
      });

    this.createGroup("Advanced");

    new Setting(containerEl)
      .setName("Load Time")
      .setDesc("Time in milliseconds to wait before loading each code block")
      .addText((text) => {
        text.setValue(this.plugin.settings.loadTime.toString());
        text.onChange(async (value) => {
          this.plugin.settings.loadTime = parseInt(value);
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
