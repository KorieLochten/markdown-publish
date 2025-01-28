import { PublishAPI } from "./api";
import MediumPublishPlugin from "./main";

export type Services = {
  api: PublishAPI;
};

export const createServices = (plugin: MediumPublishPlugin): Services => {
  return {
    api: new PublishAPI(plugin)
  };
};
