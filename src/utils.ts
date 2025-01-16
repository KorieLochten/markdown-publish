export const getMediumIcon = () => {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1770 1000" fill="white">
        <circle cx="500" cy="500" r="500"/>
        <ellipse ry="475" rx="250" cy="501" cx="1296"/>
        <ellipse cx="1682" cy="502" rx="88" ry="424"/>
    </svg>`;
};

import html2canvas from "html2canvas";
import { App } from "obsidian";
import { CSSProperties } from "react";

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
  const a = document.createElement("a");
  let isAnchor = href[0] === "#";
  a.href = isAnchor ? href.replace(/%20| /g, "-") : href;
  a.innerText = text;
  a.target = text.includes("http") ? "_blank" : "_self";

  return a;
};

export const saveHtmlAsPng = async (
  directory: string,
  app: App,
  element: HTMLElement,
  fileName: string,
  targetWidth: number | null,
  scale: number,
  smoothing: boolean,
  onclone?: (doc: Document, element: Element) => void
): Promise<{ width: number; height: number } | null> => {
  try {
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone
    });

    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    if (targetWidth === null) targetWidth = originalWidth;
    const ratio = targetWidth / originalWidth;
    const targetHeight = originalHeight * ratio;

    const resizedCanvas = document.createElement("canvas");
    resizedCanvas.width = targetWidth;
    resizedCanvas.height = targetHeight;

    const context = resizedCanvas.getContext("2d");

    if (context) {
      if (smoothing) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
      }
      context.drawImage(canvas, 0, 0, targetWidth, targetHeight);
    }

    const dataUrl = resizedCanvas.toDataURL("image/png", 1.0);
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

    return { width: targetWidth, height: targetHeight };
  } catch (error) {
    console.error("Error capturing element:", error);
    return null;
  }
};

export const createImage = (src: string, alt: string): HTMLElement => {
  const figure = document.createElement("figure");
  figure.className = "paragraph-image";
  const div = createDiv();
  div.className = "aspectRatioPlaceholder is-locked";
  const picture = createEl("picture");
  div.appendChild(picture);
  figure.appendChild(div);
  const img = new Image();
  const caption = document.createElement("figcaption");
  caption.className = "imageCaption";
  img.src = src;
  img.alt = alt;
  picture.appendChild(img);
  figure.appendChild(caption);
  return figure;
};

export const separateImages = (element: HTMLElement): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  let buffer: HTMLElement = createEl("p");
  while (element.firstChild) {
    const child = element.removeChild(element.firstChild);
    if (child instanceof HTMLElement && child.tagName === "FIGURE") {
      if (buffer.innerHTML.length > 0) {
        elements.push(buffer);
        buffer = createEl("p");
      }
      elements.push(child);
    } else {
      buffer.appendChild(child);
    }
  }

  if (buffer.innerHTML.length > 0) {
    elements.push(buffer);
  }

  return elements;
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

export const ensureEveryElementHasStyle = (
  element: HTMLElement,
  style: CSSProperties
) => {
  for (const child of element.children) {
    if (child instanceof HTMLElement) {
      Object.assign(child.style, style);
      ensureEveryElementHasStyle(child, style);
      if (child.tagName === "STRONG") {
        child.style.fontWeight = "bold";
      }
    }
  }
};

type TOCItem = {
  level: number;
  element: HTMLElement;
  children: TOCItem[];
};

export const createHiddenSpan = (): HTMLElement => {
  const span = document.createElement("span");
  span.innerHTML = "&#8203;";
  return span;
};

export const createHiddenParagraph = (id?: string): HTMLElement => {
  const paragraph = document.createElement("p");
  const span = createHiddenSpan();
  if (id) {
    paragraph.setAttribute("name", id);
  }
  paragraph.appendChild(span);
  return paragraph;
};

export const createTOC = (
  element: HTMLElement,
  excluded?: HTMLElement
): HTMLElement | null => {
  const tocContainer = createEl("pre");
  const toc = createEl("code");
  toc.innerHTML = `<strong>Table of Contents</strong>\n`;
  tocContainer.setAttribute("data-code-block-mode", "0");

  tocContainer.appendChild(toc);

  const firstHeader = element.querySelector("h1");
  if (!firstHeader) return toc;

  const index = Array.from(element.children).indexOf(firstHeader);

  let stack: TOCItem[] = [];
  let headings: TOCItem[] = [];
  let currentLevel = 0;

  const getId = (level: number) => {
    let id = `${headings.length + 1}`;
    let currentHeading = stack[0];
    for (let i = 1; i < level; i++) {
      if (!currentHeading) {
        break;
      }
      let currentChild =
        currentHeading.children[currentHeading.children.length - 1];
      id += currentHeading.children.length;
      currentHeading = currentChild;
    }

    return id;
  };

  for (let i = index; i < element.children.length; i++) {
    const child = element.children[i];
    if (child instanceof HTMLHeadingElement) {
      if (excluded && child === excluded) {
        continue;
      }
      const headingContent = child.textContent.trim();
      const headingId = headingContent.replaceAll(" ", "-");
      const level = parseInt(child.tagName[1]);

      if (level === 1 && stack.length > 0) {
        headings.push(stack[0]);
        stack = [];
      }

      const tocItem: TOCItem = {
        level,
        element: child,
        children: []
      };

      if (level > currentLevel) {
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(tocItem);
        }
        stack.push(tocItem);
      } else {
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(tocItem);
        }
        stack.push(tocItem);
      }

      const id = `${getId(level)}-${headingId}`;
      child.setAttribute("original-id", headingId);
      child.setAttribute("toc-id", id);

      currentLevel = level;
    }
  }

  if (stack.length > 0) {
    headings.push(stack[0]);
  }

  if (headings.length === 0) {
    return null;
  }

  const renderTOC = (items: TOCItem[], container: HTMLElement) => {
    items.forEach((item, index) => {
      const span = createEl("span");
      span.appendText("\t".repeat(item.level - 1) + `${index + 1}.`);

      const originalId = item.element.getAttribute("original-id");
      const id = item.element.getAttribute("toc-id");
      const url = "#" + id;
      item.element.setAttribute("name", id);

      const anchorsWithHash = element.querySelectorAll(`a[href*="#"]`);
      const anchors = Array.from(anchorsWithHash).filter((a) => {
        return (
          a.getAttribute("href").toLowerCase() ===
          `#${originalId.toLowerCase()}`
        );
      });
      anchors.forEach((a) => {
        a.setAttribute("href", url);
      });

      span.appendChild(createLinkElement(url, item.element.textContent.trim()));
      span.appendText("\n");
      container.appendChild(span);

      if (item.children.length > 0) {
        renderTOC(item.children, container);
      }
    });
  };

  renderTOC(headings, toc);

  return tocContainer;
};

type CharCheckRules = {
  isNumber?: boolean;
  isLetter?: boolean;
  isSpace?: boolean;
  isSpecial?: boolean;
  isUnique?: string;
};

const isNumber = (char: string): boolean => {
  return /\d/.test(char);
};

const isLetter = (char: string): boolean => {
  return /[a-zA-Z]/.test(char);
};

const isSpace = (char: string): boolean => {
  return /\s/.test(char);
};

const isSpecial = (char: string): boolean => {
  return /[!@#$%^&*(),.?":{}|<>]/.test(char);
};

const isUnique = (char: string, unique: string): boolean => {
  return char === unique;
};

export const checkChar = (rules: CharCheckRules, char: string): boolean => {
  if (rules.isNumber && isNumber(char)) return true;
  if (rules.isLetter && isLetter(char)) return true;
  if (rules.isSpace && isSpace(char)) return true;
  if (rules.isSpecial && isSpecial(char)) return true;
  if (rules.isUnique && isUnique(char, rules.isUnique)) return true;
  return false;
};

export const removeComments = (text: string): string => {
  let result = "";

  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    let nextChar = text[i + 1];

    if (char === "%" && nextChar === "%") {
      let commentCursor = i + 2;
      let hasEnd = false;
      for (let j = commentCursor; j < text.length - 1; j++) {
        let char = text[j];
        let nextChar = text[j + 1];
        if (char === "%" && nextChar === "%") {
          commentCursor = j + 1;
          hasEnd = true;
          break;
        }
      }

      if (!hasEnd) {
        commentCursor = text.length;
      }

      i = commentCursor;
    } else {
      result += char;
    }
  }

  return result;
};

export const createMarkdownTable = (rows: string[][]): string => {
  let table = "";

  table += "|" + rows[0].map((cell) => ` ${cell} `).join("|") + "|\n";
  table += "|" + rows[0].map(() => " --- ").join("|") + "|\n";

  for (let i = 1; i < rows.length; i++) {
    table += "|" + rows[i].map((cell) => ` ${cell} `).join("|") + "|\n";
  }

  return table;
};

type Dimension = {
  width: number;
  height?: number;
};

export const dimensionFromString = (dimension: string): Dimension | null => {
  let [width, height] = dimension.split("x").map((d) => parseInt(d));

  if (isNaN(width)) {
    return null;
  }

  if (isNaN(height)) {
    return { width };
  }

  return { width, height };
};
