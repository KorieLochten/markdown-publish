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

// Imgur Image
export type ImageBody = {
  id: string;
  deletehash: string;
  account_id: null | number;
  account_url: null | string;
  ad_type: null | number;
  ad_url: null | string;
  title: string;
  description: string;
  name: string;
  type: string;
  width: number;
  height: number;
  size: number;
  views: number;
  section: null | string;
  vote: null | string;
  bandwidth: number;
  animated: boolean;
  favorite: boolean;
  in_gallery: boolean;
  in_most_viral: boolean;
  has_sound: boolean;
  is_ad: boolean;
  nsfw: null | boolean;
  link: string;
  tags: string[];
  datetime: number;
  mp4: string;
  hls: string;
};

export type ImageResponse = {
  status: number;
  success: boolean;
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
