// YukiYokaii
import { App, MarkdownView, Notice } from "obsidian";
import {
  checkChar,
  convertLanguageToValid,
  createHiddenParagraph,
  createImage,
  createLinkElement,
  createMarkdownTable,
  dimensionFromString,
  encodeUriComponentWithParentheses,
  ensureEveryElementHasStyle,
  isValidLanguage,
  saveHtmlAsPng,
  separateImages,
  toggleClass
} from "../utils";
import { Settings } from "src/settings";
import { HtmlMarkdownContent, Markdown } from "src/types";
import { PublishConfig } from "src/api/types";

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

type LinkToken = {
  type: "link";
  url: string;
  text: string;
};

type MarkToken = {
  type: "mark";
};

type MathToken = {
  type: "math";
  content: string;
};

type DelToken = {
  type: "del";
};

type BoldToken = {
  type: "strong";
};

type ItalicToken = {
  type: "em";
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

type Math = {
  type: "math";
};

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
  count: number;
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

type Block = (
  | Code
  | Math
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

export const tokenizer = (markdown: string): Block[] => {
  const blocks: Block[] = [];

  let buffer = "";

  let index = 0;
  let lastLine = 0;

  let lines = markdown.split("\n");

  const flushBuffer = () => {
    if (buffer.length > 0) {
      let { content, id } = getId(buffer);

      blocks.push({
        type: "content",
        lineStart: lastLine,
        lineEnd: index,
        content,
        id
      });
      buffer = "";
    }
    lastLine = index;
  };

  const getId = (
    content: string
  ): {
    content: string;
    id: string | null;
  } => {
    let validId = false;
    let idIndex = -1;
    let id: string | null = null;
    for (let i = content.length - 1; i >= 0; i--) {
      if (
        checkChar({ isLetter: true, isNumber: true, isUnique: "-" }, content[i])
      ) {
        validId = true;
        continue;
      } else if (content[i] === "^") {
        idIndex = i;
        break;
      }
      break;
    }

    if (validId && idIndex !== -1) {
      id = content.slice(idIndex);
      content = content.slice(0, idIndex);
    }

    return {
      content,
      id
    };
  };

  while (index < lines.length) {
    let line = lines[index];

    if (line.trim().length === 0) {
      flushBuffer();
      let count = 1;
      let breakIndex = index;

      for (let i = index + 1; i < lines.length; i++) {
        if (lines[i].trim().length === 0) {
          count++;
          breakIndex = i;
        } else {
          break;
        }
      }

      blocks.push({
        type: "break",
        lineStart: index,
        lineEnd: index,
        content: "",
        count
      });

      index = breakIndex + 1;

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

            let { content, id } = getId(line.slice(i + 2));

            let lastBlock = blocks[blocks.length - 1];

            if (lastBlock.type === "list" && !lastBlock.ordered) {
              lastBlock.content += "\n" + content;
              lastBlock.lineEnd = index;
            } else {
              blocks.push({
                type: "list",
                ordered: false,
                lineStart: index,
                lineEnd: index,
                content,
                id
              });
            }
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
          let { content, id } = getId(line.slice(i + 2));
          let lastBlock = blocks[blocks.length - 1];
          if (lastBlock.type === "list" && !lastBlock.ordered) {
            lastBlock.content += "\n" + content;
            lastBlock.lineEnd = index;
          } else {
            blocks.push({
              type: "list",
              ordered: false,
              lineStart: index,
              lineEnd: index,
              content,
              id
            });
          }
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
            let { content, id } = getId(line.slice(i + count + 2));
            let lastBlock = blocks[blocks.length - 1];

            if (lastBlock.type === "list" && lastBlock.ordered) {
              lastBlock.content += "\n" + content;
              lastBlock.lineEnd = index;
            } else {
              blocks.push({
                type: "list",
                ordered: true,
                lineStart: index,
                lineEnd: index,
                content,
                id
              });
            }
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
                blocks[j].id = line.slice(1);
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
              let { content, id } = getId(line.slice(i + 2));

              let lastBlock = blocks[blocks.length - 1];

              if (lastBlock.type === "list" && !lastBlock.ordered) {
                lastBlock.content += "\n" + content;
                lastBlock.lineEnd = index;
              } else {
                blocks.push({
                  type: "list",
                  ordered: false,
                  lineStart: index,
                  lineEnd: index,
                  content,
                  id
                });
              }
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

        let isMath = false;
        let isInlineMath = false;

        let mathIndex = index;

        let mathBuffer = line.slice(0, i);

        for (
          let j = i;
          j < (mathIndex < lines.length ? lines[mathIndex].length : 0);
          j++
        ) {
          let line = lines[mathIndex];
          if ((line[j] === "$" && line[j + 1] === "$") || line[j] === "$") {
            isMath = true;
            isInlineMath = line[j + 1] !== "$";
            let hasEnd = false;
            let mathCursor = isInlineMath ? j : j + 1;
            let content = "";

            buffer += (buffer.length > 0 ? "\n" : "") + mathBuffer;
            flushBuffer();
            mathBuffer = "";

            for (let k = mathIndex; k < lines.length; k++) {
              let line = lines[k];
              let origin = k == mathIndex ? mathCursor + 1 : 0;
              for (
                let l = mathIndex == k ? mathCursor + 1 : 0;
                l < line.length;
                l++
              ) {
                if (
                  !isInlineMath
                    ? line[l] === "$" && line[l + 1] === "$"
                    : line[l] === "$"
                ) {
                  mathCursor = l;
                  hasEnd = true;
                  break;
                }
              }

              content +=
                (content.length > 0 ? "\n" : "") +
                line.slice(origin, hasEnd ? mathCursor : line.length);

              if (hasEnd) {
                mathIndex = k;
                break;
              }
            }

            blocks.push({
              type: "math",
              content,
              lineStart: index,
              lineEnd: mathIndex
            });

            if (!hasEnd) {
              mathIndex = lines.length;
              mathCursor = line.length;
            }

            j = mathCursor + (isInlineMath ? 0 : 1);
          } else {
            mathBuffer += line[j];
          }
        }

        if (mathBuffer.length > 0) {
          buffer += (buffer.length > 0 ? "\n" : "") + mathBuffer;
        }

        if (isMath) {
          index = mathIndex;
          break;
        }

        break;
      }
    }
    index++;
  }

  flushBuffer();

  return blocks;
};

type Token =
  | MarkToken
  | MathToken
  | DelToken
  | ImageToken
  | LinkToken
  | BoldToken
  | ItalicToken
  | TextToken
  | FootnoteUrlToken
  | Break
  | CodeToken;

type TokenizerState =
  | "TEXT"
  | "DOLLAR_SIGN"
  | "STRIKE"
  | "EQUALS"
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
            case "$":
              flushBuffer();
              state = "DOLLAR_SIGN";
              break;
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
            case "~":
              flushBuffer();
              state = "STRIKE";
              break;
            case "=":
              flushBuffer();
              state = "EQUALS";
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
        case "DOLLAR_SIGN":
          {
            let hasEnd = false;
            let mathCursor = cursor;
            for (let i = cursor; i < line.length; i++) {
              if (line[i] === "$") {
                mathCursor = i;
                hasEnd = true;
                break;
              }
            }

            if (hasEnd) {
              let content = line.slice(cursor, mathCursor);
              tokens.push({
                type: "math",
                content
              });
              cursor = mathCursor;
              state = "TEXT";
            } else {
              cursor -= 1;
              buffer += "$";
            }
          }

          break;
        case "STRIKE":
        case "EQUALS":
          {
            let count = 1;
            for (let i = cursor; i < line.length; i++) {
              if (line[i] === (state == "EQUALS" ? "=" : "~")) {
                count++;
              } else {
                break;
              }
            }

            let foundMark =
              openTokens.findIndex(
                (token) => token.type === (state == "EQUALS" ? "mark" : "del")
              ) !== -1;

            let nextChar = line[cursor + count - 1];

            let hasCharacters =
              (nextChar !== " " && nextChar !== "\t" && nextChar) ||
              char === " ";

            if (count > 1 && (hasCharacters || foundMark)) {
              if (foundMark) {
                closeToken({
                  type: state == "EQUALS" ? "mark" : "del"
                });
              } else {
                pushAndAdd({
                  type: state == "EQUALS" ? "mark" : "del"
                });
              }
            } else {
              buffer += (state == "EQUALS" ? "=" : "~").repeat(count - 1);
            }
            cursor += count - 2;
            state = "TEXT";
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
                alt = alt.replace(/\^/g, "");
                tokens.push({
                  type: "link",
                  text: alt.replace(/\^/g, ""),
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
              type: "link",
              text: alt.replace(/\^/g, ""),
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
              (currentToken as LinkToken).text
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
              case "link":
                (currentToken as LinkToken).url = url[0];
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
            openTokens.findIndex((token) => token.type === "em") !== -1;
          let foundBold =
            openTokens.findIndex((token) => token.type === "strong") !== -1;

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
                    type: "em"
                  });
                } else {
                  buffer += target;
                }

                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "strong"
                    });
                  } else {
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "strong"
                  });
                } else {
                  buffer += target.repeat(2);
                }
              } else {
                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "strong"
                    });
                  } else {
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "strong"
                  });
                } else {
                  buffer += target.repeat(2);
                }
                if (hasCharacters) {
                  pushAndAdd({
                    type: "em"
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
                    type: "strong"
                  });
                } else {
                  buffer += target.repeat(2);
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "strong"
                });
              } else {
                buffer += target.repeat(2);
              }
              break;
            case 1:
              if (foundItalic) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "em"
                  });
                } else {
                  buffer += target;
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "em"
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
                  type: "strong"
                });
              } else {
                buffer += target.repeat(2);
              }
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "em"
                });
              } else {
                buffer += target;
              }
              break;
            case 2:
              if (foundBold && hasCharacters) {
                pushAndAdd({
                  type: "strong"
                });
              } else {
                buffer += target.repeat(2);
              }
              break;
            case 1:
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "em"
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
        type: "break",
        count: 1
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
  config: PublishConfig,
  appSettings: Settings
): Promise<HtmlMarkdownContent> => {
  let markdown: Markdown = {
    content: ""
  };

  let tocMarkdown = "# Table of Contents\n";
  let rawMarkdown = "";

  const container = createDiv();

  const currentDocument = document.querySelector(
    ".workspace-leaf.mod-active .workspace-leaf-content .view-content .markdown-source-view .cm-content"
  ) as HTMLElement;

  const markdownView = app.workspace.getActiveViewOfType(MarkdownView);
  const currentValue = markdownView.editor.getValue();

  let footnoteMap: Record<string, string> = {};
  let footnotes: Record<string, Footnote & BlockBase> = {};

  const setId = (block: Block) => {
    const { lastChild: child } = container;

    if (block.id) {
      if (
        child instanceof HTMLElement &&
        child.className === "obsidian-break"
      ) {
        child.className = "link-block";
        child.setAttribute("name", block.id);
      } else {
        const paragraph = createHiddenParagraph(block.id);
        paragraph.className = "link-block";
        container.appendChild(paragraph);
        markdown.content += `<a id="${block.id}"></a>\n`;
      }
    }
  };

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    switch (block.type) {
      case "content": {
        setId(block);

        const paragraph = document.createElement("p");

        rawMarkdown +=
          parseBlock(
            tokenizeBlock(block.content),
            app,
            appSettings,
            paragraph,
            footnoteMap,
            markdown
          ) + "\n";

        const elements = separateImages(paragraph);

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
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
          let id = encodeUriComponentWithParentheses(
            block.content.slice(idIndex + 1)
          );
          heading.setAttribute("name", id);
          heading.setAttribute("id", id);
          block.content = block.content.slice(0, idIndex);
        } else {
          const id = encodeURIComponent(block.content);
          heading.setAttribute("name", id);
          heading.setAttribute("id", id);
        }

        rawMarkdown +=
          "#".repeat(block.level) +
          " " +
          parseBlock(
            tokenizeBlock(block.content),
            app,
            appSettings,
            heading,
            footnoteMap
          ) +
          "\n";

        container.appendChild(heading);

        if (
          config.medium &&
          markdown.content.length === 0 &&
          block.level === 1 &&
          !markdown.title &&
          !markdown.subtitle
        ) {
          markdown.title = heading.outerHTML + "\n";
        } else if (
          config.medium &&
          markdown.content.length === 0 &&
          !markdown.subtitle
        ) {
          markdown.subtitle = heading.outerHTML + "\n";
        } else {
          markdown.content += heading.outerHTML + "\n";
        }

        tocMarkdown += `${"  ".repeat(block.level - 1)}- [${
          heading.textContent
        }](#${encodeUriComponentWithParentheses(heading.innerText.trim())})\n`;

        break;
      }
      case "list": {
        setId(block);
        const p = document.createElement("p");
        const list = document.createElement(block.ordered ? "ol" : "ul");

        let items = block.content.split("\n");
        for (let i = 0; i < items.length; i++) {
          const item = document.createElement("li");
          let markdown_list = block.ordered ? `${i + 1}. ` : "- ";
          rawMarkdown += markdown_list;
          markdown.content += markdown_list;

          rawMarkdown +=
            parseBlock(
              tokenizeBlock(items[i]),
              app,
              appSettings,
              item,
              footnoteMap,
              markdown
            ) + "\n";

          list.appendChild(item);
        }

        markdown.content += "\n";
        rawMarkdown += "\n";
        p.appendChild(list);

        container.appendChild(p);
        break;
      }
      case "horizontalRule": {
        container.appendChild(document.createElement("hr"));
        let markdown_rule = "---\n";
        markdown.content += markdown_rule;
        rawMarkdown += markdown_rule;
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

        const filePath = `/${appSettings.assetDirectory}/${block.callout}-widget-${block.lineStart}-${block.lineEnd}.png`;

        if (cmCallout) {
          try {
            const { width, height } = await saveHtmlAsPng(
              app,
              cmCallout,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              async (doc, element) => {
                toggleClass(doc.body, "theme-dark", appSettings.useDarkTheme);
                toggleClass(doc.body, "theme-light", !appSettings.useDarkTheme);
                if (element instanceof HTMLElement) {
                  element.style.overflow = "visible";
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: appSettings.generalFontFamily
                  });
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");

            const image = imageBlock.querySelector("img") as HTMLImageElement;

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            markdown.content += image.outerHTML + "\n";
            rawMarkdown += `![${image.getAttribute("alt")}](${filePath})\n`;
            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
        }
        break;
      }
      case "quote": {
        setId(block);
        const blockquote = document.createElement("blockquote");
        blockquote.className = `graf--${block.quoteType}`;

        rawMarkdown +=
          `${block.quoteType === "blockquote" ? ">" : ">>"}` +
          parseBlock(
            tokenizeBlock(block.content),
            app,
            appSettings,
            blockquote,
            footnoteMap
          ) +
          "\n";

        markdown.content += blockquote.outerHTML + "\n";

        container.appendChild(blockquote);
        break;
      }
      case "code": {
        setId(block);
        const codeBlock = document.createElement("pre");
        const code = document.createElement("code");
        codeBlock.appendChild(code);
        markdown.content += "\t";
        rawMarkdown += "\t";

        rawMarkdown +=
          parseBlock(
            tokenizeBlock(block.content, true),
            app,
            appSettings,
            code,
            footnoteMap,
            markdown
          ) + "\n";

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

          const filePath = `/${appSettings.assetDirectory}/${block.language}-widget-${block.lineStart}-${block.lineEnd}.png`;

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
              app,
              cmEmbed,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              async (doc, element) => {
                doc.body.style.height = "fit-content";

                toggleClass(
                  doc.body,
                  "theme-dark",
                  (block.useLightTheme && !appSettings.useDarkTheme) ||
                    (!block.useLightTheme && appSettings.useDarkTheme)
                );

                toggleClass(
                  doc.body,
                  "theme-light",
                  (!block.useLightTheme && !appSettings.useDarkTheme) ||
                    (block.useLightTheme && appSettings.useDarkTheme)
                );

                if (element instanceof HTMLElement) {
                  element.style.width = "fit-content";
                  element.style.height = "fit-content";
                  element.style.overflow = "visible";
                  element.style.backgroundColor = "var(--background-primary)";
                  element.style.color = "var(--text-normal)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: appSettings.generalFontFamily
                  });

                  const hmds = element.querySelectorAll(".cm-hmd-codeblock");
                  const flair = element.querySelector(".code-block-flair");
                  for (const hmd of hmds) {
                    if (hmd instanceof HTMLElement) {
                      hmd.style.fontFamily = appSettings.codeFontFamily;
                      hmd.style.fontWeight = "600";
                    }
                  }

                  if (flair instanceof HTMLElement) {
                    flair.style.display = "none";
                  }
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");
            const image = imageBlock.querySelector("img") as HTMLImageElement;

            let markdown_caption: string;
            if (
              block.caption ||
              (appSettings.useCodeBlockLanguageForCaption &&
                language.length > 0)
            ) {
              const caption = imageBlock.querySelector(
                "figcaption"
              ) as HTMLElement;

              markdown_caption = parseBlock(
                tokenizeBlock(block.caption || language),
                app,
                appSettings,
                caption,
                footnoteMap
              );
            }

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            markdown.content += image.outerHTML + "\n";
            rawMarkdown += `![${image.getAttribute("alt")}](${filePath} ${
              markdown_caption ? `"${markdown_caption}"` : ""
            })\n`;
            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
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

          let markdown_codeblock = `\`\`\`${language}\n${block.content}\`\`\`\n`;
          markdown.content += markdown_codeblock;
          rawMarkdown += markdown_codeblock;
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

        footnotes[display] = block;
        break;
      }
      case "math": {
        setId(block);
        markdownView.editor.setValue(`$$\n${block.content}\n$$`);
        markdownView.editor.refresh();
        await new Promise((resolve) =>
          setTimeout(resolve, appSettings.loadTime)
        );

        let cmEmbed = currentDocument.querySelector(
          ".cm-embed-block"
        ) as HTMLElement;

        const filePath = `/${appSettings.assetDirectory}/math-widget-${block.lineStart}-${block.lineEnd}.png`;

        if (cmEmbed) {
          try {
            const { width, height } = await saveHtmlAsPng(
              app,
              cmEmbed,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              async (doc, element) => {
                if (!doc.body || !doc.body.toggleClass || !element) {
                  new Notice(`ERROR: uploading ${filePath}`);
                }
                doc.body.style.width = "fit-content";
                doc.body.style.height = "fit-content";
                toggleClass(doc.body, "theme-dark", appSettings.useDarkTheme);
                toggleClass(doc.body, "theme-light", !appSettings.useDarkTheme);

                if (element instanceof HTMLElement) {
                  element.style.width = "fit-content";
                  element.style.height = "fit-content";
                  element.style.overflow = "visible";
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    color: "var(--text-normal)"
                  });
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");
            const image = imageBlock.querySelector("img") as HTMLImageElement;

            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            markdown.content += image.outerHTML + "\n";
            rawMarkdown += `![${image.getAttribute("alt")}](${filePath})\n`;

            container.appendChild(imageBlock);
          } catch (e) {
            console.error(e);
          }
        }
        break;
      }
      case "table": {
        setId(block);
        const markdown_table = createMarkdownTable(block.body);
        markdownView.editor.setValue(markdown_table);
        markdownView.editor.refresh();
        await new Promise((resolve) =>
          setTimeout(resolve, appSettings.loadTime)
        );

        const cmEmbed = currentDocument.querySelector(
          ".cm-embed-block"
        ) as HTMLElement;

        if (cmEmbed) {
          const filePath = `/${appSettings.assetDirectory}/table-widget-${block.lineStart}-${block.lineEnd}.png`;
          const table = cmEmbed.querySelector("table") as HTMLTableElement;
          table.style.backgroundColor = "var(--background-primary)";
          try {
            const { width, height } = await saveHtmlAsPng(
              app,
              cmEmbed,
              filePath,
              appSettings.customWidth ? appSettings.targetWidth : null,
              appSettings.imageScale,
              appSettings.smoothing,
              (doc, element) => {
                toggleClass(doc.body, "theme-dark", appSettings.useDarkTheme);
                toggleClass(doc.body, "theme-light", !appSettings.useDarkTheme);
                if (element instanceof HTMLElement) {
                  element.style.backgroundColor = "var(--background-primary)";
                  ensureEveryElementHasStyle(element, {
                    fontFamily: appSettings.generalFontFamily
                  });
                }
              }
            );

            const imageBlock = createImage(filePath, "Code Block Widget");

            const image = imageBlock.querySelector("img") as HTMLImageElement;
            image.setAttribute("data-width", width.toString());
            image.setAttribute("data-height", height.toString());
            image.setAttribute("is-code-block", "true");
            imageBlock.style.maxWidth = `${width}px`;
            imageBlock.style.maxHeight = `${height}px`;

            container.appendChild(imageBlock);
            if (appSettings.convertTableToPng) {
              markdown.content += image.outerHTML + "\n";
              rawMarkdown += `![${image.getAttribute("alt")}](${filePath})\n`;
            } else {
              markdown.content += markdown_table + "\n";
              rawMarkdown += markdown_table + "\n";
            }
          } catch (e) {
            console.error(e);
          }
        }
        break;
      }

      case "break": {
        for (let i = 1; i <= block.count; i++) {
          if (i % 2 === 0) {
            const p = createHiddenParagraph();
            p.className = "obsidian-break";
            container.appendChild(p);
          }
          markdown.content += "\n";
          rawMarkdown += "\n";
        }
        break;
      }
    }
    if (markdownView.editor.getValue() !== currentValue) {
      markdownView.editor.setValue(currentValue);
      markdownView.editor.refresh();
    }
  }

  if (Object.keys(footnotes).length > 0) {
    container.appendChild(document.createElement("hr"));
    markdown.content += "---\n";
    rawMarkdown += "---\n";
    for (const key in footnotes) {
      const block = footnotes[key];
      const footnote = document.createElement("p");
      const footnoteId = document.createElement("strong");
      const footnoteContent = document.createElement("code");
      footnote.appendChild(footnoteId);
      footnote.appendChild(footnoteContent);

      footnote.id = block.id;
      footnote.setAttribute("name", block.id);

      footnoteId.textContent = `${key}. `;

      markdown.content += `[^${key}]:`;
      rawMarkdown += `[^${key}]:`;

      rawMarkdown += parseBlock(
        tokenizeBlock(block.content),
        app,
        appSettings,
        footnoteContent,
        footnoteMap,
        markdown
      );

      footnote.id = block.id;
      footnote.setAttribute("name", block.id);

      container.appendChild(footnote);
    }
  }

  return {
    html: container,
    markdown: markdown,
    rawMarkdown: tocMarkdown + "\n" + rawMarkdown
  };
};

const parseBlock = (
  tokens: Token[],
  app: App,
  appSettings: Settings,
  container: HTMLElement,
  footnoteMap: Record<string, string>,
  markdown: Markdown = { content: "" }
): string => {
  let elementQueue: HTMLElement[] = [];
  let rawMarkdown = "";

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
        markdown.content += "\n";
        rawMarkdown += "\n";
        break;
      }

      case "text": {
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendText(token.text);
        } else {
          container.appendText(token.text);
        }
        markdown.content += token.text;
        rawMarkdown += token.text;
        break;
      }
      case "strong":
      case "em":
      case "del":
      case "mark": {
        const element = document.createElement(token.type);
        let found = popElement(token.type.toUpperCase());
        markdown.content += found ? `</${token.type}>` : `<${token.type}>`;
        rawMarkdown +=
          token.type === "del"
            ? "~~"
            : token.type === "mark"
            ? "=="
            : token.type === "em"
            ? "*"
            : "**";

        if (found) break;
        if (elementQueue.length > 0) {
          if (elementQueue[elementQueue.length - 1].tagName === token.type) {
            elementQueue.pop();
            break;
          } else {
            elementQueue[elementQueue.length - 1].appendChild(element);
          }
        } else {
          container.appendChild(element);
        }
        elementQueue.push(element);
        break;
      }
      case "link":
        const link = createLinkElement(token.url, token.text);

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(link);
        } else {
          container.appendChild(link);
        }
        let markdown_link = `[${token.text}](${token.url})`;
        markdown.content += markdown_link;
        rawMarkdown += markdown_link;
        break;
      case "image": {
        const imageBlock = createImage(token.url, token.alt);
        const image = imageBlock.querySelector("img") as HTMLImageElement;
        let src = token.url;
        if (token.dimensions) {
          const { width, height } = token.dimensions;
          image.setAttribute("data-width", width.toString());
          image.style.maxWidth = `${width}px`;
          src += width;
          if (height) {
            image.setAttribute("data-height", height.toString());
            image.style.maxHeight = `${height}px`;
            src += height;
          }
        }

        let markdown_caption = "";
        if (token.caption) {
          const caption = imageBlock.querySelector("figcaption") as HTMLElement;

          markdown_caption += parseBlock(
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

        if (markdown.content.length == 0) {
          const image = {
            url: src,
            caption: token.caption,
            alt: token.alt
          };

          markdown.mainImage = image;
        } else {
          let cloned = image.cloneNode(true) as HTMLImageElement;
          cloned.setAttribute("_src", src);
          markdown.content += cloned.outerHTML;
        }

        rawMarkdown += `![${token.alt}](${src}${
          token.caption ? ` " ${markdown_caption}"` : ""
        })`;

        break;
      }
      case "code": {
        const code = document.createElement("code");
        code.setAttribute("data-testid", "editorParagraphText");
        markdown.content += "`";

        rawMarkdown +=
          "`" +
          parseBlock(
            tokenizeBlock(token.content, true),
            app,
            appSettings,
            code,
            footnoteMap,
            markdown
          ) +
          "`";

        markdown.content += "`";

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

        let markdown_footnote = `[^${id}]`;
        markdown.content += markdown_footnote;
        rawMarkdown += markdown_footnote;

        break;
      }
    }
  }

  return rawMarkdown;
};
