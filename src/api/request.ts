import { PublishConfig } from "./types";

export type PublishRequest = {
  title: string;
  heading?: string;
  subheading?: string;
  description?: string;
  series?: string;
  license: string;
  canonicalURL?: string;
  publicationId?: string;
  config: PublishConfig;
  tags: string[];
  publishStatus: "draft" | "public" | "unlisted";
  notifyFollowers: boolean;
};
