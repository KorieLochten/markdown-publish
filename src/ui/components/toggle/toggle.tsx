import { ToggleComponent } from "obsidian";
import { useEffect, useRef } from "react";

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

const Toggle = ({ value: initValue, onChange }: ToggleProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      new ToggleComponent(ref.current).onChange(onChange).setValue(initValue);
    }
  }, []);

  return <div ref={ref} />;
};

export default Toggle;
