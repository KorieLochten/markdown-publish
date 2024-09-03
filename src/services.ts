import { MediumPublishAPI } from "./api";
import MediumPublishPlugin from "./main";

export type Services = {
  api: MediumPublishAPI;
};

export const createServices = (plugin: MediumPublishPlugin): Services => {
  return {
    api: new MediumPublishAPI(plugin)
  };
};
