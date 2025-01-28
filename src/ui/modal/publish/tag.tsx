import styles from "./publish.module.css";

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

export default Tag;
