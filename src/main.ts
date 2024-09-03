import { addIcon, App, Plugin, PluginManifest } from "obsidian";
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
      createReactModal(this, "PublishModal").open();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
