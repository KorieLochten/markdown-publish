import type { Markdown } from "src/types";
import type { MediumLicense } from "./types";

export type MediumMeData = {
  id: string;
  username: string;
  name: string;
  url: string;
  imageUrl: string;
};

export type MediumMeResponse = {
  data: MediumMeData;
};

export type DevtoMeData = {
  id: number;
  username: string;
  name: string;
  summary: string;
  twitterUsername: string;
  githubUsername: string;
  websiteUrl: string;
  location: string;
  joinedAt: string;
  profileImageUrl: string;
};

export type DevtoMeResponse = {
  data: DevtoMeData;
};

export type MediumPublishBody = {
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

export type DevtoPublishBody = {
  id: number;
  title: string;
  description: string;
  url: string;
  tags: string[];
  body_html: string;
  body_markdown: string;
};

export type PublishBody = {
  markdown: string;
  html: string;
  medium?: MediumPublishBody;
  devto?: DevtoPublishBody;
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

export type PublicationObject = {
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string;
};

export type PublicationResponse = {
  data: PublicationObject[];
};

export type ContentResponse = {
  html: string;
  markdown: Markdown;
};
