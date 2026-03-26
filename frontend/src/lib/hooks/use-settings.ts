"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";

export interface Settings {
  home_base_city: string;
  home_base_state: string;
  preferred_radius_miles: number;
  cost_per_mile: number;
  trailer_types: string[];
  max_weight: number | null;
  max_assigned_orders: number | null;
  hazmat_certified: boolean;
  twic_card: boolean;
  team_driver: boolean;
  home_base_lat: number | null;
  home_base_lng: number | null;
  diesel_price_per_gallon: number | null;
  maintenance_per_mile: number | null;
  tires_per_mile: number | null;
  truck_payment_per_day: number | null;
  insurance_per_day: number | null;
  per_diem_per_day: number | null;
  disabled_settings?: string[];
  last_login: string;
}

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: () => fetchApi<Settings>("settings"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Settings>) =>
      fetchApi<Settings>("settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });
}
