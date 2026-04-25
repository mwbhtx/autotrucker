import { create } from "zustand";

interface RouteDiscoveryState {
  /** Index of the selected route row in the most recent result; null = no selection. */
  selectedRowIndex: number | null;
  /** Index of the active order within the selected row's drilldown panel. Defaults to 0. */
  activeOrderIndex: number;
  setSelectedRow: (i: number | null) => void;
  setActiveOrder: (i: number) => void;
  /** Reset both indices on new search. */
  resetSelection: () => void;
}

export const useRouteDiscoveryStore = create<RouteDiscoveryState>((set) => ({
  selectedRowIndex: null,
  activeOrderIndex: 0,
  setSelectedRow: (i) => set({ selectedRowIndex: i, activeOrderIndex: 0 }),
  setActiveOrder: (i) => set({ activeOrderIndex: i }),
  resetSelection: () => set({ selectedRowIndex: null, activeOrderIndex: 0 }),
}));
