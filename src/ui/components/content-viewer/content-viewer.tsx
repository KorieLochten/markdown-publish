import { Notice } from "obsidian";
import styles from "./content-viewer.module.css";
import { FaRegCopy } from "react-icons/fa6";
import { useState } from "react";

interface ContentViewerProps {
  html: string;
  markdown: string;
}

const ContentViewer = ({ html, markdown }: ContentViewerProps) => {
  const [content, setContent] = useState<string>(markdown);

  const onCopy = () => {
    navigator.clipboard.writeText(content);
    new Notice("Copied to clipboard");
  };

  return (
    <div className={styles["content-viewer-container"]}>
      <div className={styles["content-viewer-select"]}>
        <button
          onClick={() => setContent(markdown)}
          className={`${styles["content-button"]} ${
            content === markdown ? styles["active"] : ""
          }`}
        >
          Markdown
        </button>
        <button
          onClick={() => setContent(html)}
          className={`${styles["content-button"]} ${
            content === html ? styles["active"] : ""
          }`}
        >
          HTML
        </button>
      </div>
      <pre
        style={{
          position: "relative"
        }}
      >
        <code
          className={styles["content"]}
          dangerouslySetInnerHTML={{ __html: content }}
        />
        <div className={styles["copy"]} onClick={onCopy}>
          <FaRegCopy />
        </div>
      </pre>
    </div>
  );
};

export default ContentViewer;
