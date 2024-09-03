import styles from "./publish.module.css";
import { usePluginContext } from "../../context";
import { useEffect, useState } from "react";
import { MarkdownView, Modal, Notice } from "obsidian";
import { FaRegBell, FaRegBellSlash } from "react-icons/fa";
import { Button } from "src/ui/components";

type PublishStatus = "public" | "draft" | "unlisted";
type Content = "html" | "markdown";

interface TagProps {
  onDelete: () => void;
  tag: string;
}

const Tag = ({ tag, onDelete }: TagProps) => {
  return (
    <div className={styles["tag"]}>
      <span>{tag.length > 7 ? `${tag.slice(0, 7)}...` : tag}</span>
      <div className={styles["delete-button"]} onClick={onDelete}>
        x
      </div>
    </div>
  );
};

export const PublishModal = ({ modal }: { modal: Modal }) => {
  const { plugin } = usePluginContext();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<PublishStatus>("public");
  const [contentType, setContentType] = useState<Content>("markdown");
  const [tags, setTags] = useState<Record<string, string>>({});
  const [notify, setNotify] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [currentFile, setCurrentFile] = useState<null | string>(null);

  useEffect(() => {
    const load = async () => {
      const currentFile =
        plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (currentFile) {
        setTitle(currentFile.file.basename);
        setCurrentFile(currentFile.file.path);
      } else {
        new Notice("No markdown file is being viewed");
      }
    };
    load();
  }, []);

  const onPublish = async () => {
    setError("");
    setUrl("");

    const body = {
      title,
      contentFormat: contentType,
      tags: Object.values(tags),
      publishStatus: status,
      notifyFollowers: notify
    };

    setLoading(true);

    await plugin.services.api.publish(body, currentFile).then((response) => {
      if (response) {
        new Notice("Published successfully");
        setUrl(response.data.url);
      } else {
        new Notice("Error while publishing");
        setError("Error while publishing");
      }
      setLoading(false);
    });
  };

  return (
    <div className={styles["publish-container"]}>
      <div>
        <h2>Publish to Medium</h2>
        <label className={styles["publish-label"]}>Content Type</label>
        <div className={styles["publish-content-type-container"]}>
          {["html", "markdown"].map((c: Content) => (
            <div
              key={c}
              className={`${styles["publish-content-type-button"]} ${
                c === contentType ? styles["active"] : ""
              }`}
              onClick={() => setContentType(c)}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
      <div className={styles["publish-input"]}>
        <label className={styles["publish-label"]}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className={styles["container"]}>
        <div className={styles["publish-input"]}>
          <label className={styles["publish-label"]}>Tags</label>
          <input
            placeholder={
              Object.keys(tags).length >= 3 ? "Max 3 tags" : "Add tags"
            }
            disabled={Object.keys(tags).length >= 3}
            maxLength={25}
            type="text"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const newTags = { ...tags };
                let value = e.currentTarget.value;
                if (newTags[value]) {
                  new Notice("Tag already exists");
                } else {
                  newTags[value] = e.currentTarget.value;
                  setTags(newTags);
                  e.currentTarget.value = "";
                }
              }
            }}
          />
        </div>
        <div className={styles["tags-container"]}>
          {Object.entries(tags).map(([key, value]) => (
            <Tag
              key={key}
              tag={value}
              onDelete={() => {
                const newTags = { ...tags };
                delete newTags[key];
                setTags(newTags);
              }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className={styles["publish-label"]}>Publish Status</label>
        <div className={styles["publish-status-container"]}>
          {["public", "draft", "unlisted"].map((s: PublishStatus) => (
            <div
              key={s}
              className={`${styles["publish-status-button"]} ${
                s === status ? styles["active"] : ""
              }`}
              onClick={() => setStatus(s)}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
      <div className={styles["publish-end-container"]}>
        <div>
          {url ? (
            <input defaultValue={url} readOnly />
          ) : error ? (
            error
          ) : loading ? (
            "Publishing..."
          ) : (
            ""
          )}
        </div>
        <div className={styles["publish-button-container"]}>
          <Button style="primary" name="Publish" onClick={onPublish} />
          <div
            onClick={() => setNotify(!notify)}
            className={styles["notify-container"]}
          >
            {notify ? (
              <FaRegBell color="hsl(254, 80%, 72%)" />
            ) : (
              <FaRegBellSlash color="hsl(254, 80%, 72%)" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
