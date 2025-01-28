import styles from "./button.module.css";

export type ButtonStyle = "primary" | "default";
export type ButtonIcon = "sync" | "check" | "error" | "cog";

interface ButtonProps {
  name: string;
  style?: ButtonStyle;
  disabled?: boolean;
  onClick: () => void;
}

const Button = ({
  name,
  style = "default",
  onClick,
  disabled
}: ButtonProps) => {
  return (
    <button
      className={`${styles["button"]} ${
        disabled ? styles["disabled"] : styles[style]
      }`}
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
    >
      <div className={styles["button-group"]}>{name}</div>
    </button>
  );
};

export default Button;
