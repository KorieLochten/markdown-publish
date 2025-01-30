export type Image = {
  url: string;
  caption?: string;
  alt: string;
};

export type Markdown = {
  title?: string;
  subtitle?: string;
  mainImage?: Image;
  content: string;
};

export type HtmlMarkdownContent = {
  html: HTMLElement;
  markdown: Markdown;
  rawMarkdown: string;
};

export type TOCItem = {
  level: number;
  element?: HTMLElement;
  children: TOCItem[];
};
