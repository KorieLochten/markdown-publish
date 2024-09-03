import type { MediumLicense } from "./types";

export type MeData = {
  id: string;
  username: string;
  name: string;
  url: string;
  imageUrl: string;
};

export type MeResponse = {
  data: MeData;
};

export type PublishBody = {
  id: string;
  title: string;
  tags: string[];
  url: string;
  canonicalUrl: string;
  publishStatus: "draft" | "public" | "unlisted";
  publishAt: string;
  license: MediumLicense;
  licenseUrl: string;
};

export type PublishResponse = {
  data: PublishBody;
};

export type ImageBody = {
  url: string;
  md5: string;
};

export type ImageResponse = {
  data: ImageBody;
};
