import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NUMBER_WORDS } from "@/data/numbers";
import { speakAr } from "./audio";

export function CountingScene({ value, answered }: { value: number; answered: boolean }) {
  const [counted, setCounted] = useState<number[]>([]);
  return (
    <div className="k-count-scene">
      <h2 className="text-2xl font-extrabold">How many balloons?</h2>
      <div className="k-count-objects">
        {Array.from({ length: value }, (_, index) => {
          const rank = counted.indexOf(index);
          return (
            <Button key={index} variant="ghost" className={`k-count-object${rank >= 0 ? " is-counted" : ""}`}
              aria-label={`Balloon ${index + 1}`} aria-pressed={rank >= 0} disabled={answered}
              onClick={() => {
                if (rank >= 0) return;
                const word = NUMBER_WORDS.find((w) => w.numberValue === counted.length + 1);
                setCounted((previous) => [...previous, index]);
                if (word) void speakAr(word.a);
              }}>
              <span aria-hidden="true">🎈</span>
              {rank >= 0 && <span className="k-count-marker" aria-hidden="true">{rank + 1}</span>}
            </Button>
          );
        })}
        {value === 0 && <p className="text-lg font-bold">No balloons here!</p>}
      </div>
      <div role="status" className="text-sm font-bold">{counted.length} counted</div>
    </div>
  );
}