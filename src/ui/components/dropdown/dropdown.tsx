import { DropdownComponent } from "obsidian";
import { useEffect, useRef } from "react";

interface DropdownProps {
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}

const Dropdown = ({ value: initValue, options, onChange }: DropdownProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      new DropdownComponent(ref.current)
        .addOptions(options)
        .onChange(onChange)
        .setValue(initValue);
    }
  }, []);

  return <div ref={ref} />;
};

export default Dropdown;
