import { useState } from "react";

interface SettingNumberInputProps {
  value: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
}

const SettingNumberInput = ({
  value: initValue,
  max,
  min,
  onChange
}: SettingNumberInputProps) => {
  const [value, setValue] = useState(initValue);

  return (
    <input
      type="text"
      value={value}
      onChange={(event) => {
        if (event.target.value === "") {
          setValue("");
          return;
        }
        const value = parseInt(event.target.value);
        if (isNaN(value)) {
          return;
        }
        let newValue = value > max ? max : value < min ? min : value;
        setValue(newValue.toString());
        onChange(newValue);
      }}
      min={min}
      max={max}
    />
  );
};

export default SettingNumberInput;
