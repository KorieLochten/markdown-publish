import { App, MarkdownView } from "obsidian";
import {
  checkChar,
  convertLanguageToValid,
  createHiddenParagraph,
  createImage,
  createLinkElement,
  createMarkdownTable,
  dimensionFromString,
  ensureEveryElementHasStyle,
  isValidLanguage,
  saveHtmlAsPng,
  separateImages
} from "../utils";
import { Settings } from "src/settings";

type ImageToken = {
  type: "image";
  url: string;
  alt: string;
  caption: string;
  dimensions?: {
    width: number;
    height?: number;
  };
};

type UrlToken = {
  type: "url";
  url: string;
  text: string;
};

type BoldToken = {
  type: "bold";
};

type ItalicToken = {
  type: "italic";
};

type TextToken = {
  type: "text";
  text: string;
};

type CodeToken = {
  type: "code";
  content: string;
};

type FootnoteUrlToken = {
  type: "footnoteUrl";
  id: string;
};

type BlockBase = {
  lineStart: number;
  lineEnd: number;
  content: string;
  id?: string;
};

type Block = (
  | Code
  | Table
  | Content
  | Callout
  | Quote
  | Break
  | HorizontalRule
  | Heading
  | CodeBlock
  | Footnote
  | List
) &
  BlockBase;

type List = {
  type: "list";
  ordered: boolean;
};

type Heading = {
  type: "heading";
  level: number;
};

type HorizontalRule = {
  type: "horizontalRule";
};

type Break = {
  type: "break";
};

type CodeBlock = {
  type: "codeBlock";
  language: string;
  caption: string;
  toPng: boolean;
  useLightTheme: boolean;
};

type Code = {
  type: "code";
  content: string;
};

type Table = {
  type: "table";
  body: string[][];
};

type Content = {
  type: "content";
};

type Callout = {
  type: "callout";
  callout: string;
};

type Quote = {
  type: "quote";
  quoteType: "blockquote" | "pullquote";
};

type Footnote = {
  type: "footnote";
  id: string;
};

export const tokenizer = (markdown: string): Block[] => {
  const blocks: Block[] = [];

  let buffer = "";

  let index = 0;

  let lines = markdown.split("\n");

  const flushBuffer = () => {
    if (buffer.length > 0) {
      let validId = false;
      let idIndex = -1;
      let id: string | null = null;
      for (let i = buffer.length - 1; i >= 0; i--) {
        if (
          checkChar(
            { isLetter: true, isNumber: true, isUnique: "-" },
            buffer[i]
          )
        ) {
          validId = true;
          continue;
        } else if (buffer[i] === "^") {
          idIndex = i;
          break;
        }
        break;
      }

      if (validId && idIndex !== -1) {
        id = buffer.slice(idIndex);
        buffer = buffer.slice(0, idIndex);
      }

      blocks.push({
        type: "content",
        lineStart: index,
        lineEnd: index,
        content: buffer,
        id
      });
      buffer = "";
    }
  };

  while (index < lines.length) {
    let line = lines[index];

    if (line.trim().length === 0) {
      flushBuffer();
      blocks.push({
        type: "break",
        lineStart: index,
        lineEnd: index,
        content: ""
      });
      index++;
      continue;
    }

    let rows = 0;

    if (line.contains("|") && lines.length > index + 1) {
      let headers = line.split("|");
      let isIndirectTable = headers[0].trim().length !== 0;

      let isValidTable = true;

      let headerDivider = lines[index + 1].split("|");

      if (headerDivider.length == 0 || !lines[index + 1].contains("|")) {
        buffer += (buffer.length > 0 ? "\n" : "") + line;
        index++;
        continue;
      }

      for (let i = 0; i < headerDivider.length; i++) {
        let trimmed = headerDivider[i].trim();
        if (!isIndirectTable && (i === 0 || i === headerDivider.length - 1)) {
          if (trimmed.length !== 0) {
            isValidTable = false;
            break;
          }
        } else {
          if ("-".repeat(trimmed.length) !== trimmed) {
            isValidTable = false;
            break;
          }

          rows++;
        }
      }

      if (
        ((!isIndirectTable &&
          headers[headers.length - 1].trim().length === 0) ||
          isIndirectTable) &&
        isValidTable
      ) {
        let filteredHeaders = (
          isIndirectTable ? headers : headers.slice(1, -1)
        ).map((header) => header.trim());

        if (filteredHeaders.length < rows) {
          filteredHeaders.push(
            ...Array(rows - filteredHeaders.length).fill("")
          );
        }

        let table: string[][] = [filteredHeaders];

        for (let i = index + 2; i < lines.length; i++) {
          let isValidTable = true;

          let rows = lines[i].split("|");

          if (rows.length == 0 || !lines[i].contains("|")) {
            break;
          }

          for (let j = 0; j < rows.length; j++) {
            let trimmed = rows[j].trim();
            if (!isIndirectTable && (j === 0 || j === rows.length - 1)) {
              if (trimmed.length !== 0) {
                isValidTable = false;
                break;
              }
            }
          }

          if (isValidTable) {
            table.push(
              (isIndirectTable ? rows : rows.slice(1, -1))
                .map((row) => row.trim())
                .slice(0, filteredHeaders.length)
            );
          } else {
            break;
          }
        }

        flushBuffer();
        blocks.push({
          type: "table",
          lineStart: index,
          lineEnd: index,
          content: "",
          body: table
        });
        index += table.length + 1;
        continue;
      }
    }

    for (let i = 0; i < line.length; i++) {
      let char = line[i];
      let nextChar = i + 1 < line.length ? line[i + 1] : null;

      if ((char === " " && i === 4) || char === "\t") {
        flushBuffer();
        blocks.push({
          type: "code",
          lineEnd: index,
          lineStart: index,
          content: line.slice(i + 1)
        });
        break;
      }

      if (char !== " " && char !== "\t") {
        if (char === "`") {
          let count = 1;

          for (let j = i + 1; j < line.length; j++) {
            if (line[j] === "`") {
              count++;
            } else {
              break;
            }
          }

          if (count >= 3) {
            let language = line.slice(i + count);
            const match = language.match(/[^a-zA-Z0-9#+-]/);
            let caption;
            let toPng = false;
            let useLightTheme = false;

            if (match) {
              const index = match.index;
              const char = language.charAt(index);
              const nextChar = language.charAt(index + 1);
              if (char === "!" || char === "*") {
                toPng = char === "!" || nextChar === "!";
                useLightTheme = char === "*" || nextChar === "*";
              }

              let count = Number(toPng) + Number(useLightTheme);

              caption = language.slice(index + count);

              language = language.slice(0, index);
            }

            let content = "";
            let hasEnd = false;
            let lineStart = index;

            for (let i = index + 1; i < lines.length; i++) {
              let isLineEnd = false;
              let line = lines[i];
              for (let j = 0; j < line.length; j++) {
                if (line[j] == "`") {
                  let count = 1;
                  for (let k = j + 1; k < line.length; k++) {
                    if (line[k] == "`") {
                      count++;
                      j = k;
                    } else {
                      break;
                    }
                  }

                  if (count >= 3) {
                    isLineEnd = true;
                    for (let k = j + 1; k < line.length; k++) {
                      if (line[k] !== " " && line[k] !== "\t") {
                        isLineEnd = false;
                        break;
                      }
                    }

                    if (isLineEnd) {
                      break;
                    }
                  }
                }
              }

              if (isLineEnd) {
                index = i;
                hasEnd = true;
                break;
              }

              content += lines[i] + "\n";
            }

            if (!hasEnd) {
              index = lines.length;
            }

            blocks.push({
              type: "codeBlock",
              language: language,
              content,
              caption: caption,
              toPng,
              useLightTheme,
              lineStart,
              lineEnd: index
            });
            break;
          }
        }
        if (char === "#" && i === 0) {
          let level = 1;
          for (let j = 1; j < line.length; j++) {
            if (line[j] === "#") {
              level++;
            } else {
              break;
            }
          }

          if (level <= 6 && line[level] === " ") {
            let content = line.slice(level + 1);
            flushBuffer();
            blocks.push({
              type: "heading",
              level,
              lineStart: index,
              lineEnd: index,
              content
            });
            break;
          }
        }

        if (char === "-" || char === "*") {
          if (nextChar == " ") {
            let count = 2;

            for (let j = i + 1; j < line.length; j++) {
              if (
                (count % 2 === 0 && line[i] === char) ||
                (count % 2 !== 0 && line[i] === " " && count < 5)
              ) {
                count++;
              } else {
                break;
              }
            }

            if (count === 5 && i <= 3) {
              let hasCharacters = false;

              for (let j = i + count - 1; j < line.length; j++) {
                if (line[i] !== " " && line[i] !== "\t" && line[i] !== char) {
                  hasCharacters = true;
                  break;
                }
              }

              if (!hasCharacters) {
                flushBuffer();
                blocks.push({
                  type: "horizontalRule",
                  lineStart: index,
                  lineEnd: index,
                  content: ""
                });
                break;
              }
            }

            flushBuffer();
            blocks.push({
              type: "list",
              ordered: false,
              lineStart: index,
              lineEnd: index,
              content: line.slice(i + 2)
            });
            break;
          } else {
            let count = 1;

            for (let j = i; j < line.length; j++) {
              if (line[j] === char) {
                count++;
              } else {
                break;
              }
            }

            if (count >= 3 && count <= 4) {
              let hasCharacters = false;

              for (let j = i + count; j < line.length; j++) {
                if (line[j] !== " " && line[j] !== "\t") {
                  hasCharacters = true;
                  break;
                }
              }

              if (!hasCharacters) {
                flushBuffer();
                blocks.push({
                  type: "horizontalRule",
                  lineStart: index,
                  lineEnd: index,
                  content: ""
                });
                break;
              }
            }
          }
        }

        if (char === "+" && nextChar === " ") {
          flushBuffer();
          blocks.push({
            type: "list",
            ordered: true,
            lineStart: index,
            lineEnd: index,
            content: line.slice(i + 2)
          });
        }
        if (char >= "1" && char <= "9") {
          let count = 1;

          for (let j = i + 1; j < line.length; j++) {
            if (line[j] >= "0" && line[j] <= "9") {
              count++;
            } else {
              break;
            }
          }

          if (line[i + count] === "." && line[i + count + 1] === " ") {
            flushBuffer();
            blocks.push({
              type: "list",
              ordered: true,
              lineStart: index,
              lineEnd: index,
              content: line.slice(i + count + 2)
            });
            break;
          }
        }

        if (char === "[" && nextChar === "^") {
          let footnoteCursor = i + 2;
          let hasEnd = false;

          for (let i = footnoteCursor; i < line.length; i++) {
            if (line[i] === "]") {
              hasEnd = true;
              footnoteCursor = i;
              break;
            }
          }

          let footnoteUrl = line.slice(i + 2, footnoteCursor);

          if (hasEnd) {
            let nextChar = line[footnoteCursor + 1];

            let content = line.slice(footnoteCursor + 2);
            let footnoteIndex = index;
            for (let i = footnoteIndex + 1; i < lines.length; i++) {
              let hasCharacters = false;
              if (lines[i].startsWith("  ")) {
                hasCharacters = true;
                content += "\n";
                content += lines[i].trim();
                footnoteIndex = i;
              }

              if (!hasCharacters) {
                break;
              }
            }

            if (nextChar === ":") {
              blocks.push({
                type: "footnote",
                content,
                id: footnoteUrl,
                lineStart: index,
                lineEnd: footnoteIndex
              });
              break;
            }
          }
        }

        if (char === "^" && i === 0) {
          let isValidId = true;

          for (let j = 1; j < line.length; j++) {
            if (
              !checkChar(
                {
                  isLetter: true,
                  isNumber: true,
                  isUnique: "-"
                },
                line[j]
              )
            ) {
              isValidId = false;
              break;
            }
          }

          if (isValidId) {
            for (let j = blocks.length - 1; j >= 0; j--) {
              if (blocks[j].type !== "break") {
                blocks[j].id = line;
                break;
              }
            }

            break;
          }
        }

        if (char === "-") {
          if (nextChar === " ") {
            let count = 2;

            for (let j = i + 1; j < line.length; j++) {
              if (
                (count % 2 === 0 && line[i] === "-" && count < 5) ||
                (count % 2 !== 0 && line[i] === " " && count < 5)
              ) {
                count++;
              } else {
                break;
              }
            }

            if (count === 5) {
              flushBuffer();
              blocks.push({
                type: "horizontalRule",
                lineStart: index,
                lineEnd: index,
                content: ""
              });
            } else {
              flushBuffer();
              blocks.push({
                type: "list",
                ordered: false,
                lineStart: index,
                lineEnd: index,
                content: line.slice(i + 2)
              });
            }
            break;
          } else {
            let count = 1;

            for (let j = i + 1; j < line.length; j++) {
              if (line[i] === "-") {
                count++;
              } else {
                break;
              }
            }

            if (count == 3 || count == 4) {
              flushBuffer();
              blocks.push({
                type: "horizontalRule",
                lineStart: index,
                lineEnd: index,
                content: ""
              });
              break;
            }
          }
        }

        if (char === ">") {
          if (nextChar === ">") {
            let quoteIndex = index;
            let content = line.slice(i + 2);
            for (let i = index + 1; i < lines.length; i++) {
              let hasEnd = false;
              for (let j = 0; j < lines[i].length; j++) {
                if (
                  lines[i][j] !== ">" &&
                  lines[i][j] !== " " &&
                  lines[i][j] !== "\t"
                ) {
                  break;
                } else if (lines[i][j] === ">" && lines[i][j + 1] !== ">") {
                  content += "\n" + lines[i].slice(j + 1);
                  hasEnd = true;
                  break;
                }
              }

              if (!hasEnd) {
                break;
              }
            }

            flushBuffer();
            blocks.push({
              type: "quote",
              quoteType: "pullquote",
              lineStart: index,
              lineEnd: quoteIndex,
              content
            });

            index = quoteIndex;
            break;
          } else {
            let quoteIndex = index;
            let callout: string = "";
            let content = line.slice(i + 1);

            for (let j = i + 1; j < line.length; j++) {
              if (line[j] !== " " && line[j] !== "\t" && line[j] !== "[") {
                break;
              } else if (line[j] === "[" && line[j + 1] === "!") {
                let hasEnd = false;
                let calloutEnd = j;
                for (let k = j + 1; j < line.length; k++) {
                  if (line[k] === "]") {
                    hasEnd = true;
                    calloutEnd = k;
                    break;
                  }
                }

                if (hasEnd) {
                  callout = line.slice(j + 1, calloutEnd);
                  break;
                }

                i = hasEnd ? calloutEnd : line.length;
              }
            }

            for (let i = quoteIndex + 1; i < lines.length; i++) {
              let isQuote = false;
              for (let j = 0; j < lines[i].length; j++) {
                if (lines[i][j] !== " " && lines[i][j] !== "\t") {
                  if (lines[i][j] === ">") {
                    quoteIndex = i;
                    isQuote = true;
                    content += "\n" + lines[i].slice(j + 1);
                  }
                  break;
                }
              }

              if (!isQuote) {
                break;
              }
            }

            if (callout.length > 0) {
              flushBuffer();
              blocks.push({
                type: "callout",
                callout: callout.slice(1),
                lineStart: index,
                lineEnd: quoteIndex,
                content
              });

              index = quoteIndex;
              break;
            } else {
              flushBuffer();
              blocks.push({
                type: "quote",
                quoteType: "blockquote",
                lineStart: index,
                lineEnd: quoteIndex,
                content
              });

              index = quoteIndex;
              break;
            }
          }
        }

        buffer += (buffer.length > 0 ? "\n" : "") + line;

        break;
      }
    }
    index++;
  }

  flushBuffer();

  return blocks;
};

type Token =
  | ImageToken
  | UrlToken
  | BoldToken
  | ItalicToken
  | TextToken
  | FootnoteUrlToken
  | Break
  | CodeToken;

type TokenizerState =
  | "TEXT"
  | "HEADING"
  | "ASTERISK"
  | "UNDER_SCORE"
  | "HYPHENS"
  | "EXCLAMATION"
  | "BACKTICKS"
  | "DOUBLE_QUOTE_CAPTION"
  | "SINGLE_QUOTE_CAPTION"
  | "BACKTICK_CAPTION"
  | "BRACKET"
  | "PARENTHESIS";

export const tokenizeBlock = (
  markdown: string,
  isCode: boolean = false
): Token[] => {
  const tokens: Token[] = [];

  let lines = markdown.split("\n");

  let state: TokenizerState = "TEXT";
  let buffer = "";
  let isImage = false;
  let index = 0;
  let currentToken: Token | null = null;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      tokens.push({
        type: "text",
        text: buffer
      });
      buffer = "";
    }
  };

  let openTokens: Token[] = [];

  const pushAndAdd = (token: Token) => {
    tokens.push(token);
    openTokens.push(token);
  };

  const closeToken = (token: Token) => {
    let index = openTokens.findIndex(
      (openToken) => openToken.type === token.type
    );

    const tokensToReopen: Token[] = [];
    const newOpenTokens: Token[] = [];

    for (let i = openTokens.length - 1; i >= 0; i--) {
      if (i >= index) {
        tokens.push(openTokens[i]);

        if (i !== index) {
          tokensToReopen.push(openTokens[i]);
        }
      }

      if (i !== index) {
        newOpenTokens.push(openTokens[i]);
      }
    }

    tokens.push(...tokensToReopen);
    openTokens = newOpenTokens.reverse();
  };

  while (true) {
    if (index >= lines.length) {
      break;
    }

    let cursor = 0;

    let line = lines[index];

    while (cursor < line.length + 1) {
      let char = cursor > line.length ? null : line[cursor];
      let nextChar = cursor + 1 > line.length ? null : line[cursor + 1];
      switch (state) {
        case "TEXT":
          switch (char) {
            case "*":
              flushBuffer();
              state = "ASTERISK";
              break;
            case "_":
              flushBuffer();
              state = "UNDER_SCORE";
              break;
            case "\\":
              if (nextChar) {
                buffer += nextChar;
                cursor++;
              }
              break;
            case "`":
              if (!isCode) {
                flushBuffer();
                state = "BACKTICKS";
              } else {
                buffer += "`";
              }
              break;
            case "!":
              flushBuffer();
              state = "EXCLAMATION";
              break;
            case "[":
              flushBuffer();
              state = "BRACKET";
              break;

            default:
              if (char) {
                buffer += char;
              } else {
                flushBuffer();
              }
              break;
          }
          break;
        case "BACKTICKS": {
          let count = 1;
          for (let i = cursor; i < line.length; i++) {
            if (line[i] === "`") {
              count++;
            } else {
              break;
            }
          }

          let hasEnd = false;
          let backtickCursor = cursor + count - 1;
          for (let i = backtickCursor; i < line.length; i++) {
            let char = line[i];

            if (char === "`") {
              let backCount = 1;

              for (let j = i + 1; j < line.length; j++) {
                if (line[j] === "`") {
                  backCount++;
                } else {
                  break;
                }
              }

              if (backCount == count) {
                hasEnd = true;
                cursor = i;
                break;
              } else {
                i += backCount - 1;
              }
            }
          }

          if (!hasEnd) {
            cursor = line.length + 1;
          }

          tokens.push({
            type: "code",
            content: line.slice(
              backtickCursor,
              hasEnd ? cursor - (count - 1) : cursor - 1
            )
          });
          state = "TEXT";
          break;
        }
        case "BRACKET": {
          if (char === "[") {
            let wikiLinkCursor = cursor + 1;

            for (let i = wikiLinkCursor; i < line.length; i++) {
              if (line[i] === "]" && line[i + 1] === "]") {
                wikiLinkCursor = i + 1;
                break;
              }
            }

            if (wikiLinkCursor !== cursor + 1) {
              let alt = line.slice(cursor + 1, wikiLinkCursor - 1);
              let dimension;

              for (let i = alt.length - 1; i >= 0; i--) {
                if (alt[i] === "|") {
                  dimension = dimensionFromString(alt.slice(i + 1));
                  if (dimension) {
                    alt = alt.slice(0, i);
                  }
                  break;
                }
              }

              if (isImage) {
                tokens.push({
                  type: "image",
                  alt,
                  caption: null,
                  url: alt,
                  dimensions: dimension
                });
                isImage = false;
              } else {
                tokens.push({
                  type: "url",
                  text: alt,
                  url: alt
                });
              }

              cursor = wikiLinkCursor;
              state = "TEXT";
            } else {
              buffer += "[";
              state = "TEXT";
              cursor--;
            }

            break;
          }
          if (char === "^") {
            let footnoteCursor = cursor + 1;
            let hasEnd = false;

            for (let i = footnoteCursor; i < line.length; i++) {
              if (line[i] === "]") {
                hasEnd = true;
                footnoteCursor = i;
                break;
              }
            }

            let footnoteUrl = line.slice(cursor + 1, footnoteCursor);

            if (hasEnd) {
              let content = line.slice(footnoteCursor + 2);
              let footnoteIndex = index;
              for (let i = footnoteIndex + 1; i < lines.length; i++) {
                let hasCharacters = false;
                if (lines[i].startsWith("  ")) {
                  hasCharacters = true;
                  content += "\n";
                  content += lines[i].trim();
                  footnoteIndex = i;
                }

                if (!hasCharacters) {
                  break;
                }
              }

              tokens.push({
                type: "footnoteUrl",
                id: footnoteUrl
              });
              cursor = footnoteCursor;
            } else {
              buffer += "[^";
              cursor--;
            }

            state = "TEXT";
            break;
          }
          let urlCursor = cursor;

          for (let i = urlCursor; i < line.length; i++) {
            if (line[i] === "]") {
              urlCursor = i;
              break;
            }
          }

          if (
            urlCursor === cursor &&
            line[urlCursor] !== "]" &&
            line[urlCursor + 1] !== "("
          ) {
            buffer += "[";
            state = "TEXT";
            cursor--;
            break;
          }

          let alt = line.slice(cursor, urlCursor);
          let dimension;

          for (let i = alt.length - 1; i >= 0; i--) {
            if (alt[i] === "|") {
              dimension = dimensionFromString(alt.slice(i + 1));
              if (dimension) {
                alt = alt.slice(0, i);
              }
              break;
            }
          }

          if (isImage) {
            currentToken = {
              type: "image",
              caption: null,
              alt,
              url: "",
              dimensions: dimension
            };
          } else {
            currentToken = {
              type: "url",
              text: alt,
              url: ""
            };
          }
          state = "PARENTHESIS";
          cursor = urlCursor + 1;
          break;
        }
        case "EXCLAMATION":
          if (char === "[") {
            state = "BRACKET";
            isImage = true;
          } else {
            buffer += "!";
            state = "TEXT";
            cursor--;
          }
          break;
        case "PARENTHESIS": {
          let urlEndCursor = cursor;
          for (let i = urlEndCursor; i < line.length; i++) {
            if (line[i] === ")") {
              urlEndCursor = i;
              break;
            }
          }

          state = "TEXT";

          if (urlEndCursor === cursor && line[urlEndCursor] !== ")") {
            buffer += `[${
              (currentToken as ImageToken).alt ||
              (currentToken as UrlToken).text
            }](`;
            cursor--;
            break;
          }

          if (currentToken.type === "image") {
            for (let i = cursor; i < urlEndCursor; i++) {
              const quoteMatch = line[i].match(/["'`]/);
              if (quoteMatch) {
                switch (quoteMatch[0]) {
                  case '"':
                    state = "DOUBLE_QUOTE_CAPTION";
                    break;
                  case "'":
                    state = "SINGLE_QUOTE_CAPTION";
                    break;
                  case "`":
                    state = "BACKTICK_CAPTION";
                    break;
                }
                urlEndCursor = i;
                break;
              }
            }
          }

          let url = line.slice(cursor, urlEndCursor).split(" ");

          if (currentToken) {
            switch (currentToken.type) {
              case "image":
                (currentToken as ImageToken).url = url[0];
                break;
              case "url":
                (currentToken as UrlToken).url = url[0];
                break;
            }

            if (state === "TEXT") {
              tokens.push(currentToken);
              isImage = false;
              currentToken = null;
            }
          }
          cursor = urlEndCursor;
          break;
        }
        case "DOUBLE_QUOTE_CAPTION":
        case "SINGLE_QUOTE_CAPTION":
        case "BACKTICK_CAPTION": {
          let target;
          switch (state) {
            case "DOUBLE_QUOTE_CAPTION":
              target = '"';
              break;
            case "SINGLE_QUOTE_CAPTION":
              target = "'";
              break;
            case "BACKTICK_CAPTION":
              target = "`";
              break;
          }

          let captionEndCursor = cursor;

          for (let i = cursor; i < line.length; i++) {
            if (line[i] === target) {
              captionEndCursor = i;
              break;
            }
          }

          if (
            captionEndCursor === cursor &&
            line[captionEndCursor] !== target
          ) {
            state = "PARENTHESIS";
            cursor--;
            break;
          }

          let caption = line.slice(cursor, captionEndCursor);

          for (let i = captionEndCursor; i < line.length; i++) {
            if (line[i] === ")") {
              captionEndCursor = i;
              break;
            }
          }

          if (currentToken) {
            if (currentToken.type === "image") {
              currentToken.caption = caption;

              tokens.push(currentToken);
              currentToken = null;
            }
          }

          state = "TEXT";
          cursor = captionEndCursor;
          break;
        }
        case "ASTERISK":
        case "UNDER_SCORE": {
          let count = 1;
          let target = state === "ASTERISK" ? "*" : "_";

          for (let i = cursor; i < line.length; i++) {
            if (line[i] === target) {
              count++;
            } else {
              break;
            }
          }

          let foundItalic =
            openTokens.findIndex((token) => token.type === "italic") !== -1;
          let foundBold =
            openTokens.findIndex((token) => token.type === "bold") !== -1;

          let extraTarget = count > 3 ? (count % 3 == 0 ? 3 : count % 3) : 0;
          let extras = count > 3 ? 3 : count;
          let nextChar = line[cursor + count - 1];
          let prevChar = cursor > 0 ? line[cursor - 2] : null;

          let hasCharacters =
            (nextChar !== " " && nextChar !== "\t" && nextChar) || char === " ";

          switch (extras) {
            case 3:
              if (foundItalic) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "italic"
                  });
                } else {
                  buffer += target;
                }

                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "bold"
                    });
                  } else {
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "bold"
                  });
                } else {
                  buffer += target.repeat(2);
                }
              } else {
                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "bold"
                    });
                  } else {
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "bold"
                  });
                } else {
                  buffer += target.repeat(2);
                }
                if (hasCharacters) {
                  pushAndAdd({
                    type: "italic"
                  });
                } else {
                  buffer += target;
                }
              }

              break;
            case 2:
              if (foundBold) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "bold"
                  });
                } else {
                  buffer += target.repeat(2);
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "bold"
                });
              } else {
                buffer += target.repeat(2);
              }
              break;
            case 1:
              if (foundItalic) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "italic"
                  });
                } else {
                  buffer += target;
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "italic"
                });
              } else {
                buffer += target;
              }
              break;
          }

          switch (extraTarget) {
            case 3:
              if (foundBold && hasCharacters) {
                pushAndAdd({
                  type: "bold"
                });
              } else {
                buffer += target.repeat(2);
              }
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "italic"
                });
              } else {
                buffer += target;
              }
              break;
            case 2:
              if (foundBold && hasCharacters) {
                pushAndAdd({
                  type: "bold"
                });
              } else {
                buffer += target.repeat(2);
              }
              break;
            case 1:
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "italic"
                });
              } else {
                buffer += target;
              }
              break;
          }

          state = "TEXT";
          cursor += count - 2;
          break;
        }
      }

      cursor++;
    }

    for (let i = openTokens.length - 1; i >= 0; i--) {
      tokens.push(openTokens[i]);
    }

    openTokens = [];

    if (index < lines.length - 1) {
      tokens.push({
        type: "break"
      });
    }

    index++;
  }

  return tokens;
};

const superscriptMap: { [key: string]: string } = {
  "0": "\u2070",
  "1": "\u00B9",
  "2": "\u00B2",
  "3": "\u00B3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079"
};

export const parser = async (
  blocks: Block[],
  app: App,
  appSettings: Settings
): Promise<HTMLElement> => {
  const container = document.createElement("div");

  const currentDocument = document.querySelector(
    ".workspace-leaf.mod-active .workspace-leaf-content .view-content .markdown-source-view .cm-content"
  ) as HTMLElement;

  const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
  const currentValue = markdownView.editor.getValue();

  let footnoteMap: Record<string, string> = {};
  let footnotes: Record<string, HTMLElement> = {};

  const setId = (block: Block) => {
    if (block.id) {
      container.appendChild(createHiddenParagraph(block.id));
    }
  };

  for (let block of blocks) {
    switch (block.type) {
      case "content": {
        const paragraph = document.createElement("p");

        parseBlock(
          tokenizeBlock(block.content),
          app,
          appSettings,
          paragraph,
          footnoteMap
        );

        const elements = separateImages(paragraph);

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (i == 0 && block.id) {
            element.prepend(createHiddenParagraph(block.id));
          }
          container.appendChild(element);
        }
        break;
      }
      case "heading": {
        const heading = document.createElement(`h${block.level}`);

        let validId = false;
        let idIndex = -1;
        for (let i = block.content.length - 1; i >= 0; i--) {
          if (
            checkChar(
              { isLetter: true, isNumber: true, isUnique: "-" },
              block.content[i]
            )
          ) {
            validId = true;
          } else if (block.content[i] === "^") {
            idIndex = i;
            break;
          }
        }

        if (validId && idIndex !== -1) {
          let id = block.content.slice(idIndex + 1);
          heading.setAttribute("name", id);
          heading.setAttribute("id", id);
          block.content = block.content.slice(0, idIndex);
        } else {
          heading.setAttribute("name", block.content);
          heading.setAttribute("id", block.content);
        }

        parseBlock(
          tokenizeBlock(block.content),
          app,
          appSettings,
          heading,
          footnoteMap
        );
        container.appendChild(heading);
        break;
      }
      case "list": {
        setId(block);
        const p = document.createElement("p");
        const list = document.createElement(block.ordered ? "ol" : "ul");
        const item = document.createElement("li");
        list.appendChild(item);
        p.appendChild(list);

        parseBlock(
          tokenizeBlock(block.content),
          app,
          appSettings,
          item,
          footnoteMap
        );

        container.appendChild(p);
        break;
      }
      case "horizontalRule": {
        container.appendChild(document.createElement("hr"));
        break;
      }
      case "break": {
        container.appendChild(document.createElement("br"));
        break;
      }
      case "callout": {
        setId(block);
        let range = markdownView.editor.getRange(
          {
            line: block.lineStart,
            ch: 0
          },
          {
            line: block.lineEnd + 1,
            ch: 0
          }
        );

        markdownView.editor.setValue(range);
        markdownView.editor.refresh();
        await new Promise((resolve) =>
          setTimeout(resolve, appSettings.loadTime)
        );

        const cmCallout = currentDocument.querySelector(
          ".cm-callout"
        ) as HTMLElement;

        const imageSrc = `${block.callout}-widget-${block.lineStart}-${block.lineEnd}.png`;

        if (cmCallout) {
          try {
            const { width, height } = await saveHtmlAsPng(
              appSettings.assetDirectory,
              app,
              cmCallout,
              imageSrc,
              async (doc, element) => {
                doc.body.toggleClass("theme-dark", appSettings.useDarkTheme);
                doc.body.toggleClass("theme-light", !appSettings.useDarkTheme);
                if (element instanceof HTMLElement) {
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: "Arial, sans-serif"
                  });
                }
              }
            );

            const imageBlock = createImage(imageSrc, "Code Block Widget");

            const image = imageBlock.querySelector("img") as HTMLImageElement;

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
        }

        markdownView.editor.setValue(currentValue);
        break;
      }
      case "quote": {
        setId(block);
        const blockquote = document.createElement("blockquote");
        blockquote.className = `graf--${block.quoteType}`;

        parseBlock(
          tokenizeBlock(block.content),
          app,
          appSettings,
          blockquote,
          footnoteMap
        );

        container.appendChild(blockquote);
        break;
      }
      case "code": {
        setId(block);
        const codeBlock = document.createElement("pre");
        const code = document.createElement("code");
        codeBlock.appendChild(code);
        parseBlock(
          tokenizeBlock(block.content, true),
          app,
          appSettings,
          code,
          footnoteMap
        );
        container.appendChild(codeBlock);
        break;
      }
      case "codeBlock": {
        setId(block);
        let language = convertLanguageToValid(block.language);
        let isValidLang = isValidLanguage(language);
        const shouldConvertToPng = appSettings.convertCodeToPng;
        const blockRequiresPng = block.toPng;

        if (
          (!isValidLang ||
            (!shouldConvertToPng && blockRequiresPng) ||
            (shouldConvertToPng && !blockRequiresPng)) &&
          language.length > 0
        ) {
          markdownView.editor.setValue(
            `\`\`\`${language}\n${block.content}\`\`\``
          );
          markdownView.editor.refresh();
          await new Promise((resolve) =>
            setTimeout(resolve, appSettings.loadTime)
          );

          let cmEmbed = currentDocument.querySelector(
            ".cm-embed-block"
          ) as HTMLElement;

          const imageSrc = `${language}-widget-${block.lineStart}-${block.lineEnd}.png`;

          try {
            if (!cmEmbed) {
              cmEmbed = createDiv();

              while (currentDocument.firstChild) {
                if (
                  currentDocument.firstChild instanceof HTMLElement &&
                  currentDocument.firstChild.className.contains(
                    "HyperMD-codeblock"
                  )
                ) {
                  cmEmbed.appendChild(currentDocument.firstChild);
                } else {
                  currentDocument.removeChild(currentDocument.firstChild);
                }
              }

              currentDocument.appendChild(cmEmbed);
            }

            const { width, height } = await saveHtmlAsPng(
              appSettings.assetDirectory,
              app,
              cmEmbed,
              imageSrc,
              async (doc, element) => {
                doc.body.toggleClass(
                  "theme-dark",
                  (block.useLightTheme && !appSettings.useDarkTheme) ||
                    (!block.useLightTheme && appSettings.useDarkTheme)
                );
                doc.body.toggleClass(
                  "theme-light",
                  (!block.useLightTheme && !appSettings.useDarkTheme) ||
                    (block.useLightTheme && appSettings.useDarkTheme)
                );
                if (element instanceof HTMLElement) {
                  element.style.backgroundColor = "var(--background-primary)";
                  element.style.color = "var(--text-normal)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: "Arial, sans-serif"
                  });

                  const hmds = element.querySelectorAll(".cm-hmd-codeblock");
                  const flair = element.querySelector(".code-block-flair");
                  for (const hmd of hmds) {
                    if (hmd instanceof HTMLElement) {
                      hmd.style.fontFamily = "Roboto Mono, monospace";
                      hmd.style.fontWeight = "600";
                    }
                  }

                  if (flair instanceof HTMLElement) {
                    flair.style.display = "none";
                  }
                }
              }
            );

            const imageBlock = createImage(imageSrc, "Code Block Widget");
            const image = imageBlock.querySelector("img") as HTMLImageElement;

            if (
              block.caption ||
              (appSettings.useCodeBlockLanguageForCaption &&
                language.length > 0)
            ) {
              const caption = imageBlock.querySelector(
                "figcaption"
              ) as HTMLElement;

              parseBlock(
                tokenizeBlock(block.caption || language),
                app,
                appSettings,
                caption,
                footnoteMap
              );
            }

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }

          markdownView.editor.setValue(currentValue);
        } else {
          const codeBlock = document.createElement("pre");
          const code = document.createElement("span");
          codeBlock.setAttribute(
            "data-code-block-mode",
            isValidLang ? "2" : language.length > 0 ? "1" : "0"
          );
          if (language.length > 0)
            codeBlock.setAttribute("data-code-block-lang", language);

          if (language.length > 0) {
            code.className = block.language;
            code.textContent = block.content;
            codeBlock.appendChild(code);
          } else {
            codeBlock.innerHTML = `<span style="visibility: hidden;">&#8203;</span>`;
            const tokens = tokenizeBlock(block.content);

            parseBlock(tokens, app, appSettings, codeBlock, footnoteMap);
          }

          container.appendChild(codeBlock);
        }
        break;
      }
      case "footnote": {
        let display: string;
        if (footnoteMap[block.id]) {
          display = footnoteMap[block.id];
        } else {
          display = Object.keys(footnoteMap).length + 1 + "";
          footnoteMap[block.id] = display;
        }
        const footnote = document.createElement("p");
        const footnoteId = document.createElement("bold");
        footnote.appendChild(footnoteId);

        footnote.id = block.id;
        footnote.setAttribute("name", block.id);

        footnoteId.textContent = `${display}. `;
        parseBlock(
          tokenizeBlock(block.content),
          app,
          appSettings,
          footnote,
          footnoteMap
        );

        footnote.id = block.id;
        footnote.setAttribute("name", block.id);

        footnotes[display] = footnote;
        break;
      }
      case "table": {
        setId(block);
        markdownView.editor.setValue(createMarkdownTable(block.body));
        markdownView.editor.refresh();
        await new Promise((resolve) =>
          setTimeout(resolve, appSettings.loadTime)
        );

        const cmEmbed = currentDocument.querySelector(
          ".cm-embed-block"
        ) as HTMLElement;

        if (cmEmbed) {
          const imageSrc = `obsidian-table-widget-${block.lineStart}-${block.lineEnd}.png`;
          const table = cmEmbed.querySelector("table") as HTMLTableElement;
          table.style.backgroundColor = "var(--background-primary)";
          try {
            const { width, height } = await saveHtmlAsPng(
              appSettings.assetDirectory,
              app,
              cmEmbed,
              imageSrc,
              (doc, element) => {
                doc.body.toggleClass("theme-dark", appSettings.useDarkTheme);
                doc.body.toggleClass("theme-light", !appSettings.useDarkTheme);
                if (element instanceof HTMLElement) {
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: "Arial, sans-serif"
                  });
                }
              }
            );

            const imageBlock = createImage(imageSrc, "Code Block Widget");

            const image = imageBlock.querySelector("img") as HTMLImageElement;
            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
        }

        markdownView.editor.setValue(currentValue);
        break;
      }
      case "footnote": {
        let display: string;
        if (footnoteMap[block.id]) {
          display = footnoteMap[block.id];
        } else {
          display = Object.keys(footnoteMap).length + 1 + "";
          footnoteMap[block.id] = display;
        }
        const footnote = document.createElement("p");
        const footnoteId = document.createElement("bold");
        const footnoteContent = document.createElement("code");
        footnote.appendChild(footnoteId);
        footnote.appendChild(footnoteContent);

        footnote.id = block.id;
        footnote.setAttribute("name", block.id);

        footnoteId.textContent = `${display}. `;
        parseBlock(
          tokenizeBlock(block.content),
          app,
          appSettings,
          footnoteContent,
          footnoteMap
        );
        footnote.id = block.id;
        footnote.setAttribute("name", block.id);

        footnotes[display] = footnote;
        break;
      }
    }
  }

  if (Object.keys(footnotes).length > 0) {
    container.appendChild(document.createElement("hr"));
    for (const key in footnotes) {
      container.appendChild(footnotes[key]);
    }
  }

  return container;
};

const parseBlock = (
  tokens: Token[],
  app: App,
  appSettings: Settings,
  container: HTMLElement,
  footnoteMap: Record<string, string>
): HTMLElement => {
  let elementQueue: HTMLElement[] = [];

  const popElement = (tagName: string): boolean => {
    if (
      elementQueue.length > 0 &&
      elementQueue[elementQueue.length - 1].tagName === tagName
    ) {
      elementQueue.pop();
      return true;
    }
    return false;
  };

  for (const token of tokens) {
    switch (token.type) {
      case "break": {
        container.appendChild(document.createElement("br"));
        break;
      }
      case "text": {
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendText(token.text);
        } else {
          container.appendText(token.text);
        }
        break;
      }
      case "bold": {
        const bold = document.createElement("strong");
        let found = popElement("STRONG");
        if (found) break;
        if (elementQueue.length > 0) {
          if (elementQueue[elementQueue.length - 1].tagName === "STRONG") {
            elementQueue.pop();
            break;
          } else {
            elementQueue[elementQueue.length - 1].appendChild(bold);
          }
        } else {
          container.appendChild(bold);
        }
        elementQueue.push(bold);
        break;
      }
      case "italic": {
        const italic = document.createElement("em");
        let found = popElement("EM");
        if (found) break;
        if (elementQueue.length > 0) {
          if (elementQueue[elementQueue.length - 1].tagName === "EM") {
            elementQueue.pop();
            break;
          } else {
            elementQueue[elementQueue.length - 1].appendChild(italic);
          }
        } else {
          container.appendChild(italic);
        }
        elementQueue.push(italic);
        break;
      }
      case "url":
        const link = createLinkElement(token.url, token.text);

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(link);
        } else {
          container.appendChild(link);
        }
        break;
      case "image": {
        const imageBlock = createImage(token.url, token.alt);
        const image = imageBlock.querySelector("img") as HTMLImageElement;

        if (token.dimensions) {
          const { width, height } = token.dimensions;
          image.setAttribute("data-width", width.toString());
          image.style.maxWidth = `${width}px`;
          if (height) {
            image.setAttribute("data-height", height.toString());
            image.style.maxHeight = `${height}px`;
          }
        }

        if (token.caption) {
          const caption = imageBlock.querySelector("figcaption") as HTMLElement;

          parseBlock(
            tokenizeBlock(token.caption),
            app,
            appSettings,
            caption,
            footnoteMap
          );
        }

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(imageBlock);
        } else {
          container.appendChild(imageBlock);
        }

        break;
      }
      case "code": {
        const code = document.createElement("code");
        code.setAttribute("data-testid", "editorParagraphText");
        parseBlock(
          tokenizeBlock(token.content, true),
          app,
          appSettings,
          code,
          footnoteMap
        );
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(code);
        } else {
          container.appendChild(code);
        }
        break;
      }
      case "footnoteUrl": {
        const link = document.createElement("a");
        let url = `#${
          token.id.charAt(0) === "^" ? token.id.slice(1) : token.id
        }`;

        let id: string;
        if (footnoteMap[token.id]) {
          id = footnoteMap[token.id];
        } else {
          id = Object.keys(footnoteMap).length + 1 + "";
          footnoteMap[token.id] = id;
        }

        let display: string = "";
        for (let i = 0; i < id.length; i++) {
          display += superscriptMap[id[i]];
        }

        link.textContent = display;
        link.href = url;

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(link);
        } else {
          container.appendChild(link);
        }

        break;
      }
    }
  }

  return container;
};
