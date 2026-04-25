"use client";

import { useEffect, useRef } from "react";
import type { DiscoveredRoute } from "@/core/types";
import { useRouteDiscoveryStore } from "../store";
import { RouteRow } from "./RouteRow";

interface Props {
  routes: DiscoveredRoute[];
}

export function RoutesList({ routes }: Props) {
  const selectedRowIndex = useRouteDiscoveryStore((s) => s.selectedRowIndex);
  const setSelectedRow = useRouteDiscoveryStore((s) => s.setSelectedRow);
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-select first row when results load.
  useEffect(() => {
    if (routes.length > 0 && selectedRowIndex === null) {
      setSelectedRow(0);
    }
  }, [routes.length, selectedRowIndex, setSelectedRow]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (routes.length === 0) return;
    const cur = selectedRowIndex ?? 0;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedRow(Math.min(routes.length - 1, cur + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedRow(Math.max(0, cur - 1));
    }
  };

  return (
    <ul
      role="list"
      ref={listRef}
      onKeyDown={handleKeyDown}
      tabIndex={routes.length > 0 ? 0 : -1}
      className="space-y-2 outline-none"
    >
      {routes.map((route, i) => (
        <li key={route.route_id}>
          <RouteRow
            route={route}
            index={i}
            selected={selectedRowIndex === i}
            onClick={() => setSelectedRow(i)}
          />
        </li>
      ))}
    </ul>
  );
}
