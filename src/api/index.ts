import MediumPublishPlugin from "src/main";
import { obsidianFetch, RequestParams } from "./fetch";
import { Notice, TFile } from "obsidian";
import {
  createHeader,
  createHiddenParagraph,
  createTOC,
  getImageDimensions,
  parseResponse,
  removeComments
} from "../utils";
import {
  ImageResponse,
  MeResponse,
  PublicationResponse,
  PublishResponse
} from "./response";
import { parser, tokenizer } from "../parser";

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

    let firstChild = html.firstChild;
    let heading: HTMLElement;
    let firstChildIsBreak = false;
    if (
      firstChild instanceof HTMLElement &&
      firstChild.className === "link-block"
    ) {
      firstChildIsBreak = true;
      firstChild = html.children[1];
    }

    if (firstChild instanceof HTMLHeadingElement) {
      let level = parseInt(firstChild.tagName[1]);
      if (level === 1) {
        heading = firstChild;
      } else if (level < 5) {
        if (firstChildIsBreak && html.firstChild instanceof HTMLElement) {
          html
            .querySelectorAll(
              `a[href="#${html.firstChild.getAttribute("name")}"]`
            )
            .forEach((element: HTMLAnchorElement) => {
              element.href = `#top`;
            });
          html.removeChild(html.firstChild);
        }
        heading = html.insertBefore(createHeader(fileName), firstChild);
      }
    } else if (
      firstChild instanceof HTMLElement &&
      firstChild.tagName == "FIGURE"
    ) {
      if (firstChildIsBreak && html.firstChild instanceof HTMLElement) {
        html
          .querySelectorAll(
            `a[href="#${html.firstChild.getAttribute("name")}"]`
          )
          .forEach((element: HTMLAnchorElement) => {
            element.href = `#top`;
          });
        html.removeChild(html.firstChild);
      }

      heading = html.insertAfter(createHeader(fileName), firstChild);
    } else {
      heading = html.insertBefore(createHeader(fileName), firstChild);
    }

    heading.setAttribute("name", "top");

    const toc: HTMLElement | null = html.querySelector("h1")
      ? createTOC(html, heading)
      : null;

    if (this.plugin.settings.createTOC && toc) {
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

    const content = await this.altHtml(html);

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

  async uploadImage(file: TFile | string, id: number = 0) {
    let binaryData: ArrayBuffer;
    let extension: string;
    if (file instanceof TFile) {
      extension = file.extension;
      binaryData = await this.plugin.app.vault.readBinary(file);
    } else {
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const url = new URL(response.url);
      const pathname = url.pathname;
      const match = pathname.match(/\.(png|jpg|jpeg|gif)$/i);
      if (match) {
        extension = match[1];
      } else {
        throw new Error(
          "Invalid image URL: Unable to determine file extension"
        );
      }

      binaryData = await response.arrayBuffer();
    }
    const buffer = Buffer.from(binaryData);

    const idBuffer = Buffer.from(`ID:${id}`);
    const combinedBuffer = Buffer.concat([buffer, idBuffer]);

    const boundary = "----FormBoundaryXYZ";
    const bodyParts: ArrayBuffer[] = [];

    const mimeTypeMap: { [key: string]: string } = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif"
    };
    const mimeType = mimeTypeMap[extension.toLowerCase()];

    const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image_${id}.${extension}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    bodyParts.push(new TextEncoder().encode(preamble).buffer);
    bodyParts.push(combinedBuffer.buffer);

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

  private async altHtml(html: HTMLElement | string): Promise<string> {
    if (typeof html === "string") {
      const div = document.createElement("div");
      div.innerHTML = html;
      html = div;
    }
    let imageMap: Record<string, number> = {};
    let fileMap = new Map<string, TFile>();
    let dimensionMap: Record<string, string> = {};

    const checkLink = async (
      link: string,
      width: string = "",
      height: string = ""
    ): Promise<string> => {
      if (dimensionMap[link + width + height]) {
        return dimensionMap[link + width + height];
      }

      let file: TFile;
      if (fileMap.has(link)) {
        file = fileMap.get(link);
      } else {
        file = this.plugin.app.metadataCache.getFirstLinkpathDest(link, "");
        fileMap.set(link, file);
      }

      if (
        (file && ["png", "jpg", "jpeg", "gif"].includes(file.extension)) ||
        !file
      ) {
        try {
          const response = await this.uploadImage(
            file || link,
            imageMap[link] || 0
          );
          if (response) {
            imageMap[link] = imageMap[link] ? imageMap[link] + 1 : 1;
            dimensionMap[link + width + height] = response.data.url;
            return response.data.url;
          }
        } catch (error) {
          console.error(error);
        }
      }

      return link;
    };

    let images = Array.from(html.querySelectorAll("img"));

    for (const image of images) {
      let src = image.getAttribute("src");
      if (src) {
        const width = image.getAttribute("data-width");
        const height = image.getAttribute("data-height");
        const link = await checkLink(src, width || "", height || "");

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

    return html.innerHTML;
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
