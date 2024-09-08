import html2canvas from "html2canvas";
import { App } from "obsidian";

export const parseResponse = <T>(response: string): T => {
  return JSON.parse(response);
};

export const convertLanguageToValid = (language: string): string => {
  language = language.toLowerCase();
  switch (language) {
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "sh":
    case "shell":
      return "bash";
    case "py":
      return "python";
    case "c++":
      return "cpp";
    case "cs":
      return "csharp";
    case "rb":
      return "ruby";
    case "kt":
      return "kotlin";
    case "tomi":
      return "ini";
    case "html":
      return "xml";
    case "md":
      return "markdown";
    case "objc":
      return "objectivec";
    case "pl":
      return "perl";
    case "txt":
      return "plaintext";
    case "vb":
      return "vbnet";
    case "yml":
      return "yaml";
    case "rs":
    case "rust":
      return "rust";
    default:
      return language;
  }
};

export const isValidLanguage = (language: string): boolean => {
  switch (language) {
    case "javascript":
    case "typescript":
    case "bash":
    case "python":
    case "java":
    case "c":
    case "cpp":
    case "csharp":
    case "go":
    case "ruby":
    case "swift":
    case "kotlin":
    case "dart":
    case "diff":
    case "graphql":
    case "ini":
    case "java":
    case "json":
    case "less":
    case "lua":
    case "makefile":
    case "xml":
    case "markdown":
    case "objectivec":
    case "perl":
    case "php":
    case "php-template":
    case "plaintext":
    case "python-repl":
    case "r":
    case "scss":
    case "shell":
    case "sql":
    case "vbnet":
    case "wasm":
    case "yaml":
    case "rust":
      return true;
    default:
      return false;
  }
};

export const createLinkElement = (href: string, text: string) => {
  return `<a href="${href}" target=${
    text.includes("http") ? "_blank" : "_self"
  }>${text}</a>`;
};

export const saveHtmlAsPng = async (
  directory: string,
  app: App,
  element: HTMLElement,
  fileName: string,
  onclone?: (doc: Document, element: Element) => void,
  scaleFactor: number = 2
): Promise<{ width: number; height: number } | null> => {
  try {
    const canvas = await html2canvas(element, {
      scale: scaleFactor,
      logging: false,
      onclone
    });

    const { width, height } = canvas;

    const dataUrl = canvas.toDataURL("image/png", 1.0);
    const base64Data = dataUrl.split(",")[1];
    const arrayBuffer = Uint8Array.from(
      Buffer.from(base64Data, "base64")
    ).buffer;

    if (app.vault.getFolderByPath(directory) === null) {
      await app.vault.createFolder(directory);
    }

    const filePath = directory + "/" + fileName;

    const file = app.vault.getFileByPath(filePath);

    if (file) {
      await app.vault.modifyBinary(file, arrayBuffer);
    } else {
      await app.vault.createBinary(filePath, arrayBuffer);
    }

    return { width, height };
  } catch (error) {
    console.error("Error capturing element:", error);
    return null;
  }
};

export const createImage = (src: string, alt: string): HTMLElement => {
  const div = document.createElement("div");
  div.className = "aspectRatioPlaceholder is-locked";
  const img = new Image();
  const caption = document.createElement("figcaption");
  caption.className = "imageCaption";
  img.src = src;
  img.alt = alt;
  div.appendChild(img);
  div.appendChild(caption);
  return div;
};

export const getImageDimensions = (
  imageSrc: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = (error) => {
      reject(error);
    };
    img.src = imageSrc;
  });
};

export const createHeader = (text: string): HTMLElement => {
  const header = document.createElement("h1");
  header.innerText = text;
  return header;
};

export const htmlEntities = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
