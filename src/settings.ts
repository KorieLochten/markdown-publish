import { type MeData } from "./api/response";

export type Settings = {
  token: string;
} & MeData;

export const DEFAULT_SETTINGS: Settings = {
  token: "",
  id: "",
  username: "",
  name: "",
  url: "",
  imageUrl: ""
};
