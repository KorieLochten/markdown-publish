import { App, EditorScrollInfo, MarkdownView } from "obsidian";
import {
  convertLanguageToValid,
  createImage,
  htmlEntities,
  isValidLanguage,
  saveHtmlAsPng
} from "./utils";
import { Settings } from "src/settings";

type ImageToken = {
  type: "image";
  url: string;
  alt: string;
  caption: Token[] | null;
  dimensions?: {
    width: number;
    height: number | null;
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

type StrikeThroughToken = {
  type: "strikeThrough";
};

type BlockQuoteToken = {
  type: "blockquote";
};

type PullQuoteToken = {
  type: "pullquote";
};

type UListToken = {
  type: "unorderedList";
};

type OListToken = {
  type: "orderedList";
  level: number;
};

type TextToken = {
  type: "text";
  text: string;
};

type HeadingToken = {
  type: "heading";
  level: number;
};

type HorizontalRuleToken = {
  type: "horinzontalRule";
};

type CodeBlockToken = {
  type: "codeBlock";
  language: string;
  content: string;
  lineStart: number;
  lineEnd: number;
};

type CodeToken = {
  type: "code";
  content: string;
};

type FootnoteToken = {
  type: "footnote";
  text: string;
  id: string;
};

type FootnoteUrlToken = {
  type: "footnoteUrl";
  id: string;
};

type TableToken = {
  type: "table";
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
};

type BreakToken = {
  type: "break";
};

type Token =
  | ImageToken
  | UrlToken
  | HorizontalRuleToken
  | BoldToken
  | ItalicToken
  | StrikeThroughToken
  | BlockQuoteToken
  | PullQuoteToken
  | UListToken
  | OListToken
  | TextToken
  | CodeBlockToken
  | BreakToken
  | FootnoteToken
  | FootnoteUrlToken
  | TableToken
  | CodeToken
  | HeadingToken;

type TokenizerState =
  | "TEXT"
  | "HEADING"
  | "ASTERISK"
  | "UNDER_SCORE"
  | "DIMENSIONS"
  | "HYPHENS"
  | "EXCLAMATION"
  | "DOUBLE_QUOTE_CAPTION"
  | "SINGLE_QUOTE_CAPTION"
  | "BACKTICK_CAPTION"
  | "BACKTICKS"
  | "BRACKET"
  | "PARENTHESIS"
  | "VERTICAL_BAR"
  | "QUOTE";

type TokenizerRules = {
  handleAsterisk?: {
    handleBulletList: boolean;
    handleBold: boolean;
    handleItalic: boolean;
    handleHorizontalRule: boolean;
  };
  handleUnderscore?: {
    handleItalic: boolean;
    handleBold: boolean;
    handleHorizontalRule: boolean;
  };
  handleBacktick?: {
    handleCodeBlock: boolean;
    handleCode: boolean;
  };
  handleHyphens?: boolean;
  handleExclamation?: boolean;
  handleBracket?: boolean;
  handleQuote?: boolean;
  handleList?: boolean;
  handleCode?: boolean;
  handleHeading?: boolean;
  handleVerticalBar?: boolean;
};

export const DEFAULT_TOKENIZER_RULES: TokenizerRules = {
  handleAsterisk: {
    handleBulletList: true,
    handleBold: true,
    handleItalic: true,
    handleHorizontalRule: true
  },
  handleUnderscore: {
    handleItalic: true,
    handleBold: true,
    handleHorizontalRule: true
  },
  handleBacktick: {
    handleCodeBlock: true,
    handleCode: true
  },
  handleHyphens: true,
  handleExclamation: true,
  handleBracket: true,
  handleQuote: true,
  handleList: true,
  handleHeading: true,
  handleCode: true,
  handleVerticalBar: true
};

export const tokenizer = (
  markdown: string,
  rules: TokenizerRules = DEFAULT_TOKENIZER_RULES
): Token[] => {
  const tokens: Token[] = [];
  let lines = markdown.split("\n");

  let state: TokenizerState = "TEXT";
  let buffer = "";
  let isImage = false;
  let currentLevel = 0;
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

    let hasWritten = false;

    while (cursor < line.length + 1) {
      let char = cursor > line.length ? null : line[cursor];
      let nextChar = cursor + 1 > line.length ? null : line[cursor + 1];
      switch (state) {
        case "TEXT":
          switch (char) {
            case "|":
              if (!hasWritten && rules.handleVerticalBar) {
                state = "VERTICAL_BAR";
              } else {
                buffer += char;
              }
              break;
            case " ":
              if (cursor === 0) {
                let count = 1;
                for (let i = cursor + 1; i < line.length; i++) {
                  if (line[i] === " ") {
                    count++;
                  } else {
                    break;
                  }
                }

                if (count >= 4 && rules.handleCode) {
                  let content = line.slice(cursor);
                  tokens.push({
                    type: "code",
                    content
                  });

                  cursor = line.length + 1;
                } else {
                  buffer += " ";
                }
              } else {
                buffer += " ";
              }
              break;
            case "\t":
              if (!hasWritten && rules.handleCode) {
                let content = line.slice(cursor);
                tokens.push({
                  type: "code",
                  content
                });
                cursor = line.length + 1;
              } else {
                buffer += "\t";
              }
              break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
              if (
                !hasWritten &&
                nextChar === "." &&
                line[cursor + 2] === " " &&
                rules.handleList
              ) {
                flushBuffer();
                tokens.push({
                  type: "orderedList",
                  level: Number.parseInt(char)
                });
                openTokens.push({
                  type: "orderedList",
                  level: Number.parseInt(char)
                });

                cursor += 2;
              } else {
                buffer += char;
              }
              break;
            case "#":
              if (cursor === 0 && rules.handleHeading) {
                flushBuffer();
                state = "HEADING";
                currentLevel = 1;
              } else {
                buffer += char ?? "";
              }
              hasWritten = true;
              break;
            case "*":
              if (rules.handleAsterisk) {
                state = "ASTERISK";
                flushBuffer();
              } else {
                buffer += char;
              }
              break;
            case "_":
              if (rules.handleUnderscore) {
                state = "UNDER_SCORE";
                flushBuffer();
              } else {
                buffer += char;
              }
              break;
            case "+":
              if (nextChar === " " && !hasWritten && rules.handleList) {
                tokens.push({
                  type: "unorderedList"
                });
                openTokens.push({
                  type: "unorderedList"
                });
              } else {
                buffer += char;
              }
              hasWritten = true;
              break;
            case "\\":
              // escape character
              buffer += nextChar;
              cursor++;
              hasWritten = true;
              break;
            case "!":
              if (rules.handleExclamation) {
                state = "EXCLAMATION";
              } else {
                buffer += char;
              }
              break;
            case ">":
              if (!hasWritten) {
                if (nextChar === ">") {
                  cursor++;
                  tokens.push({
                    type: "pullquote"
                  });
                  openTokens.push({
                    type: "pullquote"
                  });
                } else {
                  tokens.push({
                    type: "blockquote"
                  });
                  openTokens.push({
                    type: "blockquote"
                  });
                }
              } else {
                buffer += char;
              }
              hasWritten = true;
              break;
            case "[":
              hasWritten = true;
              flushBuffer();
              state = "BRACKET";
              break;
            case "-":
              if (!hasWritten) {
                state = "HYPHENS";
              } else {
                buffer += char;
              }
              break;
            case "`":
              if (rules.handleBacktick) {
                flushBuffer();
                state = "BACKTICKS";
              } else {
                buffer += char;
              }
              break;
            default:
              if (char) {
                if (char !== " " && char !== "\t") hasWritten = true;
                buffer += char;
              } else {
                flushBuffer();
              }
              break;
          }
          break;
        case "VERTICAL_BAR":
          let isValidTable = false;

          for (let i = cursor - 1; i < line.length; i++) {
            if (line[i] !== "|") {
              let hasEnd = false;
              for (let j = i; j < line.length; j++) {
                if (line[j] === "|" && line[j + 1] !== "|") {
                  isValidTable = true;
                  hasEnd = true;
                  i = j;
                  break;
                }
              }

              if (!hasEnd) {
                break;
              }
            }
          }

          if (isValidTable) {
            let columnState: "BEFORE_HYPHEN" | "HYPHEN" | "AFTER_HYPHEN" =
              "BEFORE_HYPHEN";

            let isNextLineValid = true;
            let nextLine = lines[index + 1];

            if (nextLine && nextLine[0] === "|") {
              for (let i = 1; i < nextLine.length; i++) {
                if (!isNextLineValid) break;

                switch (columnState) {
                  case "BEFORE_HYPHEN": {
                    if (nextLine[i] === "-") {
                      columnState = "HYPHEN";
                    } else if (nextLine[i] !== " ") {
                      isNextLineValid = false;
                      break;
                    }
                    break;
                  }
                  case "HYPHEN": {
                    if (nextLine[i] !== "-") {
                      switch (nextLine[i]) {
                        case " ":
                          columnState = "AFTER_HYPHEN";
                          break;
                        case "|":
                          columnState = "BEFORE_HYPHEN";
                          break;
                        default:
                          isNextLineValid = false;
                          break;
                      }
                    }
                    break;
                  }
                  case "AFTER_HYPHEN": {
                    if (nextLine[i] !== " ") {
                      if (nextLine[i] === "|") {
                        isNextLineValid = true;
                        columnState = "BEFORE_HYPHEN";
                      } else {
                        isNextLineValid = false;
                      }
                    }
                    break;
                  }
                }
              }
            }

            if (isNextLineValid) {
              let charCount = 0;

              for (let i = 0; i < index; i++) {
                charCount += lines[i].length + 1;
              }

              let tableIndex = index + 1;

              let barCharCount =
                charCount + line.length + 1 + nextLine.length + 1;
              for (let i = tableIndex + 1; i < lines.length; i++) {
                if (lines[i][0] === "|") {
                  tableIndex = i;
                  barCharCount += lines[i].length + 1;
                } else {
                  break;
                }
              }

              tokens.push({
                type: "table",
                start: charCount,
                end: barCharCount - 1,
                lineStart: index,
                lineEnd: tableIndex
              });

              cursor = line.length + 1;
              index = tableIndex;
              state = "TEXT";

              break;
            }
          }

          buffer += "|";
          cursor--;
          state = "TEXT";
          hasWritten = true;
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

          if (count >= 3 && rules.handleBacktick.handleCodeBlock) {
            let language = line.slice(cursor + count - 1).split(" ")[0];
            let content = "";
            let hasEnd = false;
            let lineStart = index;
            for (let i = index + 1; i < lines.length; i++) {
              if (lines[i].startsWith("`".repeat(count - 1))) {
                index = i;
                hasEnd = true;
                break;
              }
              content += lines[i] + "\n";
            }
            if (!hasEnd) {
              index = lines.length;
            }

            cursor = line.length;

            tokens.push({
              type: "codeBlock",
              language,
              content,
              lineStart,
              lineEnd: index
            });

            state = "TEXT";
          } else if (rules.handleBacktick.handleCode) {
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
                  cursor = i + 1;
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
                hasEnd ? cursor - count : cursor - 1
              )
            });
            state = "TEXT";
          } else {
            buffer += "`" + char;
            state = "TEXT";
          }
          break;
        }
        case "HYPHENS":
          switch (char) {
            case " ":
              {
                let count = 2;

                for (let i = cursor + 1; i < line.length; i++) {
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
                  tokens.push({
                    type: "horinzontalRule"
                  });
                  cursor += 3;
                  state = "TEXT";
                } else {
                  tokens.push({
                    type: "unorderedList"
                  });
                  state = "TEXT";
                }
              }
              break;
            default: {
              let count = 1;

              for (let i = cursor; i < line.length; i++) {
                if (line[i] === "-") {
                  count++;
                } else {
                  break;
                }
              }

              if (count == 3 || count == 4) {
                tokens.push({
                  type: "horinzontalRule"
                });
                cursor += count - 1;
                state = "TEXT";
              } else {
                buffer += "-".repeat(count);
                state = "TEXT";
              }
            }
          }
          break;
        case "BRACKET": {
          if (char === "^") {
            let footnoteCursor = cursor + 1;
            let hasEnd = false;

            for (let i = cursor + 1; i < line.length; i++) {
              if (line[i] === "]") {
                hasEnd = true;
                footnoteCursor = i;
                break;
              }
            }

            let footnoteUrl = line.slice(cursor + 1, footnoteCursor);

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
                tokens.push({
                  type: "footnote",
                  text: content,
                  id: footnoteUrl
                });
                cursor = line.length + 1;
                index = footnoteIndex;
              } else {
                tokens.push({
                  type: "footnoteUrl",
                  id: footnoteUrl
                });
                cursor = footnoteCursor + 1;
              }
            } else {
              buffer += "[^";
              cursor--;
            }

            state = "TEXT";
            break;
          }
          let urlCursor = cursor;
          let toState: "PARENTHESIS" | "DIMENSIONS" = "PARENTHESIS";

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

          for (let i = cursor - 1; i < line.length; i++) {
            if (isImage && line[i] === "|") {
              toState = "DIMENSIONS";
              urlCursor = i;
              break;
            }
          }

          let alt = line.slice(cursor, urlCursor);

          if (isImage) {
            currentToken = {
              type: "image",
              caption: null,
              alt,
              url: ""
            };
          } else {
            currentToken = {
              type: "url",
              text: alt,
              url: ""
            };
          }
          state = toState;
          cursor = toState === "DIMENSIONS" ? urlCursor : urlCursor + 1;
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
        case "DIMENSIONS":
          let widthBuffer = "";
          let heightBuffer = "";
          let dimensionsCursor = cursor;

          let dimensionState: "WIDTH" | "HEIGHT" = "WIDTH";

          for (let i = cursor; i < line.length; i++) {
            if (dimensionState === "WIDTH") {
              if (line[i] === "]") {
                dimensionsCursor = i;
                break;
              }

              if (line[i] === "x") {
                dimensionState = "HEIGHT";
                dimensionsCursor = i;
              } else {
                widthBuffer += line[i];
              }
            } else {
              if (line[i] === "]") {
                dimensionsCursor = i;
                break;
              }
              heightBuffer += line[i];
            }
          }

          if (currentToken) {
            let width = Number.parseInt(widthBuffer);
            let height = Number.parseInt(heightBuffer);
            let dimensions =
              (dimensionState === "HEIGHT" &&
                !isNaN(height) &&
                !isNaN(width)) ||
              (dimensionState === "WIDTH" && !isNaN(width))
                ? { width, height: isNaN(height) ? null : height }
                : null;
            (currentToken as ImageToken).dimensions = dimensions;
          }
          state = "PARENTHESIS";
          cursor = dimensionsCursor + 1;
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

          let url = line.slice(cursor, urlEndCursor).split(" ");

          if (currentToken) {
            switch (currentToken.type) {
              case "image":
                (currentToken as ImageToken).url = url[0];
                isImage = false;
                break;
              case "url":
                (currentToken as UrlToken).url = url[0];
                break;
            }

            if (state === "TEXT") {
              tokens.push(currentToken);
              currentToken = null;
            }
          }
          cursor = urlEndCursor;
          break;
        }
        case "DOUBLE_QUOTE_CAPTION":
        case "SINGLE_QUOTE_CAPTION":
        case "BACKTICK_CAPTION":
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
              currentToken.caption = tokenizer(caption);

              tokens.push(currentToken);
              currentToken = null;
            }
          }

          state = "TEXT";
          cursor = captionEndCursor;
          break;
        case "HEADING":
          if (cursor > line.length || char === "#") {
            if (currentLevel < 6) {
              currentLevel++;
            } else {
              buffer += "#".repeat(currentLevel);
              state = "TEXT";
              cursor--;
            }
          } else if (char !== " ") {
            buffer += "#".repeat(currentLevel);
            state = "TEXT";
            cursor--;
          } else {
            let headingToken: HeadingToken = {
              type: "heading",
              level: currentLevel
            };
            tokens.push(headingToken);
            openTokens.push(headingToken);
            state = "TEXT";
          }
          break;
        case "ASTERISK":
        case "UNDER_SCORE": {
          let target: string = state === "ASTERISK" ? "*" : "_";

          let prevChar = cursor > 1 ? line[cursor - 2] : null;
          if (char == " ") {
            let count = 2;

            for (let i = cursor + 1; i < line.length; i++) {
              if (
                (count % 2 === 0 && line[i] === target) ||
                (count % 2 !== 0 && line[i] === " " && count < 5)
              ) {
                count++;
              } else {
                break;
              }
            }

            if (count === 5 && cursor <= 3 && !hasWritten) {
              let hasCharacters = false;

              for (let i = cursor + count - 1; i < line.length; i++) {
                if (line[i] !== " " && line[i] !== "\t" && line[i] !== target) {
                  hasCharacters = true;
                  break;
                }
              }

              if (
                !hasCharacters && state == "ASTERISK"
                  ? rules.handleAsterisk.handleHorizontalRule
                  : rules.handleUnderscore.handleHorizontalRule
              ) {
                tokens.push({
                  type: "horinzontalRule"
                });

                cursor = line.length + 1;
                state = "TEXT";
                break;
              }
            }

            if (
              !hasWritten &&
              state === "ASTERISK" &&
              rules.handleAsterisk.handleBulletList
            ) {
              hasWritten = true;
              pushAndAdd({
                type: "unorderedList"
              });
              break;
            }
          }

          let count = 1;

          for (let i = cursor; i < line.length; i++) {
            if (line[i] === target) {
              count++;
            } else {
              break;
            }
          }

          if (!hasWritten && count >= 3) {
            let hasCharacters = false;
            for (let i = cursor + count - 1; i < line.length; i++) {
              if (line[i] !== " " && line[i] !== "\t" && line[i] !== target) {
                hasCharacters = true;
                break;
              }
            }

            if (
              !hasCharacters && state == "ASTERISK"
                ? rules.handleAsterisk.handleHorizontalRule
                : rules.handleUnderscore.handleHorizontalRule
            ) {
              tokens.push({
                type: "horinzontalRule"
              });
              cursor = line.length + 1;
              state = "TEXT";
              break;
            }
          }

          let foundItalic =
            openTokens.findIndex((token) => token.type === "italic") !== -1;
          let foundBold =
            openTokens.findIndex((token) => token.type === "bold") !== -1;

          let extraAsterisks = count > 3 ? (count % 3 == 0 ? 3 : count % 3) : 0;
          let asterisks = count > 3 ? 3 : count;
          let nextChar = line[cursor + count - 1];

          let hasCharacters =
            (nextChar !== " " && nextChar !== "\t" && nextChar) || char === " ";

          switch (asterisks) {
            case 3:
              if (foundItalic) {
                if (prevChar !== " ") {
                  closeToken({
                    type: "italic"
                  });
                } else {
                  hasWritten = true;
                  buffer += target;
                }

                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "bold"
                    });
                  } else {
                    hasWritten = true;
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "bold"
                  });
                } else {
                  hasWritten = true;
                  buffer += target.repeat(2);
                }
              } else {
                if (foundBold) {
                  if (prevChar !== " ") {
                    closeToken({
                      type: "bold"
                    });
                  } else {
                    hasWritten = true;
                    buffer += target.repeat(2);
                  }
                } else if (hasCharacters) {
                  pushAndAdd({
                    type: "bold"
                  });
                } else {
                  hasWritten = true;
                  buffer += target.repeat(2);
                }
                if (hasCharacters) {
                  pushAndAdd({
                    type: "italic"
                  });
                } else {
                  hasWritten = true;
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
                  hasWritten = true;
                  buffer += target.repeat(2);
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "bold"
                });
              } else {
                hasWritten = true;
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
                  hasWritten = true;
                  buffer += target;
                }
              } else if (hasCharacters) {
                pushAndAdd({
                  type: "italic"
                });
              } else {
                hasWritten = true;
                buffer += target;
              }
              break;
          }

          switch (extraAsterisks) {
            case 3:
              if (foundBold && hasCharacters) {
                pushAndAdd({
                  type: "bold"
                });
              } else {
                hasWritten = true;
                buffer += target.repeat(2);
              }
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "italic"
                });
              } else {
                hasWritten = true;
                buffer += target;
              }
              break;
            case 2:
              if (foundBold && hasCharacters) {
                pushAndAdd({
                  type: "bold"
                });
              } else {
                hasWritten = true;
                buffer += target.repeat(2);
              }
              break;
            case 1:
              if (foundItalic && hasCharacters) {
                pushAndAdd({
                  type: "italic"
                });
              } else {
                hasWritten = true;
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

    tokens.push({
      type: "break"
    });

    index += 1;
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

type ScrollInfo = {
  top: number;
  left: number;
  clientHeight: number;
  clientWidth: number;
};

export const parser = async (
  tokens: Token[],
  app: App,
  appSettings: Settings,
  element?: HTMLElement
): Promise<HTMLElement> => {
  const container = element || document.createElement("div");

  const currentDocument = document.querySelector(
    ".workspace-leaf.mod-active .workspace-leaf-content .view-content .markdown-source-view .cm-content"
  ) as HTMLElement;

  const currentScroller = document.querySelector(
    ".workspace-leaf.mod-active .workspace-leaf-content .view-content .markdown-source-view .cm-sizer"
  ) as HTMLElement;

  const markdownView = app.workspace.getActiveViewOfType(MarkdownView);

  let elementQueue: HTMLElement[] = [];

  const currentValue = markdownView.editor.getValue();

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

  const footnoteMap: Record<string, string> = {};
  const footnotes: Record<string, HTMLElement> = {};

  for (const token of tokens) {
    switch (token.type) {
      case "text":
        const text = document.createTextNode(token.text);
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(text);
        } else {
          container.appendChild(text);
        }
        break;
      case "heading": {
        const heading = document.createElement(`h${token.level}`);
        let found = popElement(`H${token.level}`);
        if (found) break;

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(heading);
        } else {
          container.appendChild(heading);
        }
        elementQueue.push(heading);
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
      case "unorderedList": {
        const item = document.createElement("li");
        let found = popElement("LI");
        const list = document.createElement("ul");
        list.appendChild(item);

        if (found) break;
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(list);
        } else {
          container.appendChild(list);
        }
        elementQueue.push(item);
        break;
      }
      case "orderedList": {
        let found = popElement("LI");
        if (found) break;

        const item = document.createElement("li");
        item.setAttribute("value", token.level.toString());
        const list = document.createElement("ol");

        list.appendChild(item);

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(list);
        } else {
          container.appendChild(list);
        }
        elementQueue.push(item);
        break;
      }
      case "break":
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(
            document.createElement("br")
          );
        } else {
          container.appendChild(document.createElement("br"));
        }
        break;
      case "url":
        const url = document.createElement("a");
        url.href = token.url;
        url.textContent = token.text;
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(url);
        } else {
          container.appendChild(url);
        }
        break;
      case "image": {
        const imageBlock = createImage(token.url, token.alt);
        const image = imageBlock.querySelector("img") as HTMLImageElement;

        if (token.dimensions) {
          const { width, height } = token.dimensions;
          image.setAttribute("data-width", width.toString());
          imageBlock.style.maxWidth = `${width}px`;
          if (height) {
            image.setAttribute("data-height", height.toString());
            imageBlock.style.maxHeight = `${height}px`;
          }
        }

        if (token.caption) {
          const caption = imageBlock.querySelector("figcaption") as HTMLElement;

          await parser(token.caption, app, appSettings, caption);
        }

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(imageBlock);
        } else {
          container.appendChild(imageBlock);
        }

        break;
      }
      case "horinzontalRule":
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(
            document.createElement("hr")
          );
        } else {
          container.appendChild(document.createElement("hr"));
        }
        break;
      case "pullquote":
      case "blockquote": {
        const blockquote = document.createElement("blockquote");
        blockquote.className = `graf--${token.type}`;
        let found = popElement("BLOCKQUOTE");
        if (found) break;

        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(blockquote);
        } else {
          container.appendChild(blockquote);
        }
        elementQueue.push(blockquote);
        break;
      }
      case "codeBlock": {
        const codeBlock = document.createElement("pre");
        const code = document.createElement("span");
        let language = convertLanguageToValid(token.language);
        let isValidLang = isValidLanguage(language);

        let found = false;

        if (
          (!isValidLang || appSettings.convertCodeToPng) &&
          language.length > 0
        ) {
          const range = markdownView.editor.getRange(
            {
              line: token.lineStart,
              ch: 0
            },
            {
              line: token.lineEnd + 1,
              ch: 0
            }
          );

          markdownView.editor.setValue(range);
          markdownView.editor.refresh();
          await new Promise((resolve) => setTimeout(resolve, 100));

          const cmEmbed = currentDocument.querySelector(
            ".cm-embed-block"
          ) as HTMLElement;

          const hyperMDCodeBlocks =
            currentDocument.querySelectorAll(".HyperMD-codeblock");

          if (cmEmbed || hyperMDCodeBlocks) {
            const imageSrc = `${language}-widget-${token.lineStart}-${token.lineEnd}.png`;
            const gaps = currentDocument.querySelectorAll(".cm-gap");
            let count = gaps.length;

            try {
              const { width, height } = await saveHtmlAsPng(
                appSettings.assetDirectory,
                app,
                cmEmbed ? cmEmbed : currentDocument,
                imageSrc,
                async (_, element) => {
                  if (element instanceof HTMLElement) {
                    element.style.backgroundColor = "var(--background-primary)";
                    element.style.color = "var(--text-normal)";
                    element.style.fontFamily = "Arial, sans-serif";

                    const hmds = element.querySelectorAll(".cm-hmd-codeblock");
                    const flair = element.querySelector(".code-block-flair");
                    for (const hmd of hmds) {
                      if (hmd instanceof HTMLElement) {
                        hmd.style.fontFamily = "Roboto Mono, monospace";
                        hmd.style.fontWeight = "600";
                      }
                    }

                    if (flair instanceof HTMLElement) {
                      flair.className = "";
                      flair.style.fontFamily = "Arial, sans-serif";
                      flair.style.position = "absolute";
                      flair.style.top = "0";
                      flair.style.right = "0";
                      flair.style.padding = "0.5em";
                      flair.style.zIndex = "1";
                    }
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

              found = true;
            } catch (e) {
              console.error(e);
            }
          }

          markdownView.editor.setValue(currentValue);

          if (found) break;
        }
        codeBlock.setAttribute(
          "data-code-block-mode",
          isValidLang ? "2" : language.length > 0 ? "1" : "0"
        );
        codeBlock.setAttribute("data-testid", "editorCodeBlockParagraph");
        codeBlock.setAttribute("data-code-block-lang", language);
        code.setAttribute("data-testid", "editorParagraphText");

        if (language.length > 0) {
          code.className = token.language;
          code.textContent =
            language === "html" || language === "xml"
              ? htmlEntities(token.content)
              : token.content;
        } else {
          await parser(
            tokenizer(token.content, {
              handleAsterisk: {
                handleBold: true,
                handleBulletList: false,
                handleHorizontalRule: false,
                handleItalic: true
              },
              handleUnderscore: {
                handleBold: true,
                handleHorizontalRule: false,
                handleItalic: true
              },
              handleList: false,
              handleCode: false
            }),
            app,
            appSettings,
            code
          );
        }

        codeBlock.appendChild(code);
        container.appendChild(codeBlock);

        break;
      }
      case "code": {
        const code = document.createElement("code");
        code.setAttribute("data-testid", "editorParagraphText");
        code.textContent = token.content;
        if (elementQueue.length > 0) {
          elementQueue[elementQueue.length - 1].appendChild(code);
        } else {
          container.appendChild(code);
        }
        break;
      }
      case "footnoteUrl": {
        const link = document.createElement("a");
        let url = `#${token.id}`;

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
      case "footnote": {
        let display: string;
        if (footnoteMap[token.id]) {
          display = footnoteMap[token.id];
        } else {
          display = Object.keys(footnoteMap).length + 1 + "";
          footnoteMap[token.id] = display;
        }
        const footnote = document.createElement("p");
        footnote.id = token.id;
        footnote.setAttribute("name", token.id);

        const footnoteId = document.createElement("bold");
        footnoteId.textContent = `${display}. `;
        await parser(tokenizer(token.text), app, appSettings, footnote);
        footnote.prepend(footnoteId);
        footnote.id = token.id;
        footnote.setAttribute("name", token.id);

        footnotes[display] = footnote;
        break;
      }
      case "table": {
        const range = markdownView.editor.getRange(
          {
            line: token.lineStart,
            ch: 0
          },
          {
            line: token.lineEnd + 1,
            ch: 0
          }
        );

        markdownView.editor.setValue(range);
        markdownView.editor.refresh();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const cmEmbed = currentDocument.querySelector(
          ".cm-embed-block"
        ) as HTMLElement;

        if (cmEmbed) {
          const imageSrc = `obsidian-table-widget-${token.lineStart}-${token.lineEnd}.png`;
          const table = cmEmbed.querySelector("table") as HTMLTableElement;
          table.style.backgroundColor = "var(--background-primary)";
          try {
            const { width, height } = await saveHtmlAsPng(
              appSettings.assetDirectory,
              app,
              table,
              imageSrc,
              (_, element) => {
                if (element instanceof HTMLElement) {
                  element.style.fontFamily = "Arial, sans-serif";
                }

                element.className = "";
                const thead = element.querySelector("thead");
                const tbody = element.querySelector("tbody");

                for (const tr of thead.querySelectorAll("tr")) {
                  for (const th of tr.querySelectorAll("th")) {
                    th.className = "";

                    for (const child of Array.from(th.children)) {
                      if (child.className.contains("drag-handle")) {
                        th.removeChild(child);
                      } else {
                        th.style.textAlign = "left";
                        th.style.fontWeight = "bold";
                      }
                    }
                  }
                }

                for (const tr of tbody.querySelectorAll("tr")) {
                  for (const td of tr.querySelectorAll("td")) {
                    td.className = "";

                    for (const child of Array.from(td.children)) {
                      if (child.className.contains("drag-handle")) {
                        td.removeChild(child);
                      } else {
                        td.style.textAlign = "left";
                      }
                    }
                  }
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
      }
    }
  }

  const headings = Array.from(
    container.querySelectorAll("h1, h2, h3, h4, h5, h6")
  );

  for (const heading of headings) {
    heading.setAttribute("id", heading.textContent);
    heading.setAttribute("name", heading.textContent);
  }

  if (Object.keys(footnotes).length > 0) {
    container.appendChild(document.createElement("hr"));
    for (const key in footnotes) {
      container.appendChild(footnotes[key]);
    }
  }

  return container;
};
