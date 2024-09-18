import MediumPublishPlugin from "src/main";
import { obsidianFetch, RequestParams } from "./fetch";
import { Notice, TFile } from "obsidian";
import {
  createHeader,
  createTOC,
  getImageDimensions,
  parseResponse,
  removeComments
} from "./utils";
import {
  ImageResponse,
  MeResponse,
  PublicationResponse,
  PublishResponse
} from "./response";
import { parser, tokenizer } from "./parser";

const url = "https://api.medium.com/v1";

type PublishBody = {
  title: string;
  publicationId?: string;
  contentFormat: "html" | "markdown";
  tags: string[];
  publishStatus: "draft" | "public" | "unlisted";
  notifyFollowers: boolean;
};

export class MediumPublishAPI {
  private plugin: MediumPublishPlugin;
  constructor(plugin: MediumPublishPlugin) {
    this.plugin = plugin;
  }

  async validateToken(token?: string): Promise<boolean> {
    try {
      const request: RequestParams = {
        url: `${url}/me`,
        method: "GET",
        headers: this.getHeaders(token ?? this.plugin.settings.token)
      };

      const response = await obsidianFetch(request);

      const { data } = parseResponse<MeResponse>(response.body);

      if (response.status === 200) {
        this.plugin.settings.id = data.id;
        this.plugin.settings.username = data.username;
        this.plugin.settings.name = data.name;
        this.plugin.settings.url = data.url;
        this.plugin.settings.imageUrl = data.imageUrl;

        await this.plugin.saveSettings();
      }

      return response.status === 200;
    } catch (error) {
      new Notice("Error: " + error);
      return false;
    }
  }

  async getPublications(): Promise<PublicationResponse | null> {
    const request: RequestParams = {
      url: `${url}/users/${this.plugin.settings.id}/publications`,
      method: "GET",
      headers: this.getHeaders(this.plugin.settings.token)
    };

    const response = await obsidianFetch(request);

    if (response.status === 200) {
      return parseResponse<PublicationResponse>(response.body);
    } else {
      new Notice("Error: " + response.body);
      return null;
    }
  }

  async publish(
    body: PublishBody,
    path: string
  ): Promise<PublishResponse | null> {
    let fileName = this.plugin.app.vault.getFileByPath(path).basename;
    let fileContent = await this.plugin.app.vault.adapter.read(path);

    const html =
      body.contentFormat === "markdown"
        ? await parser(
            tokenizer(removeComments(fileContent)),
            this.plugin.app,
            this.plugin.settings
          )
        : createDiv(fileContent);

    const toc: HTMLElement | null = html.querySelector("h1")
      ? createTOC(html)
      : null;

    let firstChild = html.firstChild;
    let heading: HTMLElement;

    if (firstChild instanceof HTMLHeadingElement) {
      let level = parseInt(firstChild.tagName[1]);
      if (level === 1) {
        heading = firstChild;
      } else {
        heading = html.insertBefore(createHeader(fileName), firstChild);
      }
    } else {
      heading = html.insertAfter(createHeader(fileName), firstChild);
    }

    if (this.plugin.settings.createTOC && toc) {
      html.querySelectorAll("a").forEach((link) => {
        const href = link.getAttribute("href");
      });

      let index = html.indexOf(heading) + 1;
      let breakCount = 0;

      while (true) {
        let sibling = html.children[index];

        if (sibling instanceof HTMLHeadingElement) {
          let level = parseInt(sibling.tagName[1]);
          if (level === 1) {
            html.insertBefore(toc, sibling);
            break;
          } else {
            html.insertAfter(toc, sibling);
          }
          break;
        }

        if (
          sibling instanceof HTMLElement &&
          sibling.tagName === "BR" &&
          breakCount < 2
        ) {
          breakCount++;
          index++;
          continue;
        }

        html.insertBefore(toc, sibling);
        break;
      }
    }

    let { html: content, imageMap } = await this.altHtml(html);

    if (Object.keys(imageMap).length > 0) {
      for (const [link, url] of Object.entries(imageMap)) {
        fileContent = fileContent.replaceAll(link, url);
      }

      await this.plugin.app.vault.adapter.write(path, fileContent);
    }

    const request: RequestParams = {
      url: body.publicationId
        ? `${url}/publications/${body.publicationId}/posts`
        : `${url}/users/${this.plugin.settings.id}/posts`,
      method: "POST",
      headers: this.getHeaders(this.plugin.settings.token),
      body: JSON.stringify({
        ...body,
        content,
        contentFormat: "html"
      })
    };

    const response = await obsidianFetch(request);

    if (response.status === 201) {
      new Notice("Post published successfully");
      const body = parseResponse<PublishResponse>(response.body);
      return body;
    } else {
      new Notice("Error: " + response.body);
    }
  }

  async uploadImage(file: TFile) {
    const binaryData = await this.plugin.app.vault.readBinary(file);
    const buffer = Buffer.from(binaryData);

    const boundary = "----FormBoundaryXYZ";
    const bodyParts: ArrayBuffer[] = [];

    const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
    bodyParts.push(new TextEncoder().encode(preamble).buffer);

    bodyParts.push(buffer);

    const epilogue = `\r\n--${boundary}--\r\n`;
    bodyParts.push(new TextEncoder().encode(epilogue).buffer);

    const body = concatenateArrayBuffers(bodyParts);

    try {
      const response = await obsidianFetch({
        url: "https://api.medium.com/v1/images",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.plugin.settings.token}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`
        },
        body: body
      });

      if (response.status === 201) {
        return parseResponse<ImageResponse>(response.body);
      } else {
        new Notice("Error: " + response.body);
      }
    } catch (error) {
      new Notice("Error: " + error);
    }
  }

  private async altHtml(html: HTMLElement | string): Promise<{
    html: string;
    imageMap: Record<string, string>;
  }> {
    if (typeof html === "string") {
      const div = document.createElement("div");
      div.innerHTML = html;
      html = div;
    }
    let imageMap: Record<string, string> = {};

    const checkLink = async (link: string): Promise<string> => {
      if (link in imageMap) {
        return imageMap[link];
      }

      let file = this.plugin.app.metadataCache.getFirstLinkpathDest(
        link,
        "assets"
      );

      if (file) {
        let extension = file.extension;
        if (["png", "jpg", "jpeg", "gif"].includes(extension)) {
          const response = await this.uploadImage(file);
          if (response) {
            imageMap[link] = response.data.url;
            return response.data.url;
          }
        }
      }
      return link;
    };

    let images = Array.from(html.querySelectorAll("img"));

    for (const image of images) {
      let src = image.getAttribute("src");
      if (src) {
        const link = await checkLink(src);
        if (!image.getAttribute("data-width")) {
          const { width, height } = await getImageDimensions(link);

          image.setAttribute("data-width", width.toString());
          image.setAttribute("data-height", height.toString());
          const block = image.parentElement;

          block.style.maxWidth = `${width}px`;
          block.style.maxHeight = `${height}px`;
        }

        image.setAttribute("src", link);
      }
    }

    return {
      html: html.innerHTML,
      imageMap
    };
  }

  private getHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }
}

const concatenateArrayBuffers = (buffers: ArrayBuffer[]): ArrayBuffer => {
  const totalLength = buffers.reduce(
    (sum, current) => sum + current.byteLength,
    0
  );
  const result = new Uint8Array(totalLength);
  let offset = 0;

  buffers.forEach((buffer) => {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });

  return result.buffer;
};
