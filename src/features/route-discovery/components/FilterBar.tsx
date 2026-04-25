"use client";

import { useState } from "react";
import { Button } from "@/platform/web/components/ui/button";
import { Input } from "@/platform/web/components/ui/input";
import { US_STATES } from "../utils/state-list";

export interface FilterBarValues {
  city: string;
  state: string;
  radius_miles: number;
  order_count: 2 | 3 | 4;
}

interface Props {
  onSearch: (values: FilterBarValues) => void;
}

export function FilterBar({ onSearch }: Props) {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [radius, setRadius] = useState(100);
  const [orders, setOrders] = useState<2 | 3 | 4>(3);

  const isValid =
    city.trim().length >= 2 && state !== "" && radius >= 50 && radius <= 500;

  const handleSubmit = () => {
    if (!isValid) return;
    onSearch({ city: city.trim(), state, radius_miles: radius, order_count: orders });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label
          htmlFor="rd-city"
          className="block text-sm font-medium mb-1.5"
        >
          City
        </label>
        <Input
          id="rd-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Houston"
        />
      </div>

      <div>
        <label
          htmlFor="rd-state"
          className="block text-sm font-medium mb-1.5"
        >
          State
        </label>
        <select
          id="rd-state"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Select...</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="rd-radius"
          className="block text-sm font-medium mb-1.5"
        >
          Radius (mi)
        </label>
        <Input
          id="rd-radius"
          type="number"
          min={50}
          max={500}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </div>

      <div>
        <span className="block text-sm font-medium mb-1.5">Orders</span>
        <div role="group" className="flex gap-1">
          {([2, 3, 4] as const).map((n) => (
            <Button
              key={n}
              type="button"
              variant={orders === n ? "default" : "outline"}
              size="sm"
              onClick={() => setOrders(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <Button type="button" onClick={handleSubmit} disabled={!isValid}>
        Search
      </Button>
    </div>
  );
}
