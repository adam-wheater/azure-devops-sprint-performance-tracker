import * as React from "react";
import { MIN_LOOKBACK, MAX_LOOKBACK } from "../utils/constants";

const LOOKBACK_OPTIONS: number[] = [];
for (let i = MIN_LOOKBACK; i <= MAX_LOOKBACK; i++) {
  LOOKBACK_OPTIONS.push(i);
}

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export const SprintLookbackControl: React.FC<Props> = ({ value, onChange }) => {
  const id = React.useId();
  return (
    <div className="ax-toolbar__group">
      <label className="ax-label" htmlFor={id}>
        Lookback period
      </label>
      <select
        id={id}
        className="ax-select"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {LOOKBACK_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n} sprint{n > 1 ? "s" : ""}
          </option>
        ))}
      </select>
    </div>
  );
};
