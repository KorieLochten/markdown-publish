import styles from "./setting.module.css";

interface SettingProps {
  name: string;
  desc?: string;
  lastChild?: boolean;
  children: React.ReactNode | React.ReactNode[];
}

const SettingItem = ({ children, name, desc, lastChild }: SettingProps) => {
  return (
    <div
      className={`${styles["setting"]} ${
        lastChild ? "" : styles["setting-item-border"]
      }`}
    >
      <div className={styles["settings-info"]}>
        <div className={styles["setting-name"]}>{name}</div>
        <div className={styles["setting-desc"]}>{desc}</div>
      </div>
      {children}
    </div>
  );
};

export default SettingItem;
