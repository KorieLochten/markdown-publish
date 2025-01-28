import { useState } from "react";
import styles from "./visual-dropdown.module.css";
import { FaCaretDown } from "react-icons/fa6";

interface VisualDropdownProps {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}

const VisualDropdown = ({ children, title, open }: VisualDropdownProps) => {
  const [isOpen, setIsOpen] = useState(open || false);

  return (
    <div className={styles["dropdown"]}>
      <div
        className={styles["dropdown-title"]}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
      >
        <div>{title}</div>
        <div>
          <FaCaretDown
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.3s"
            }}
          />
        </div>
      </div>
      <div
        className={`${styles["dropdown-content"]} ${
          isOpen ? styles["active"] : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default VisualDropdown;
