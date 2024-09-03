import {
  addIcon,
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginManifest
} from "obsidian";
import { createServices, type Services } from "./services";
import { DEFAULT_SETTINGS, Settings } from "./settings";
import { createReactModal } from "./ui/modal";
import { getMediumIcon } from "./utils";

export default class MediumPublishPlugin extends Plugin {
  services: Services;
  settings: Settings = DEFAULT_SETTINGS;
  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);

    this.services = createServices(this);
  }

  async onload() {
    await this.loadSettings();
    addIcon("medium", getMediumIcon());

    if (!(await this.services.api.validateToken())) {
      createReactModal(this, "TokenValidatorModal").open();
    }

    this.addRibbonIcon("medium", "Publish to Medium", async () => {
      const currentFile = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (currentFile) {
        const element = document.querySelector(
          ".workspace-leaf.mod-active .workspace-leaf-content"
        ) as HTMLElement;

        if (element.getAttribute("data-mode") !== "source") {
          new Notice("Please open a markdown in editing mode");
          return;
        }

        if (!element.querySelector(".is-live-preview")) {
          new Notice("Please turn off source mode");
          return;
        }

        createReactModal(this, "PublishModal").open();
      } else {
        new Notice("No markdown file is being viewed");
        return;
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
