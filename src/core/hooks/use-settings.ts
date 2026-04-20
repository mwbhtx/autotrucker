"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/core/services/api";
import { toast } from "sonner";

export interface CustomCostComponent {
  label: string;
  per_mile: number;
}

export interface Settings {
  home_base_city: string;
  home_base_state: string;
  preferred_radius_miles: number;
  cost_per_mile: number;
  cost_mode: "simple" | "auto" | "detailed" | null;
  diesel_price_per_gallon: number | null;
  maintenance_per_mile: number | null;
  tires_per_mile: number | null;
  def_per_mile: number | null;
  custom_cost_components: CustomCostComponent[] | null;
  trailer_types: string[];
  max_weight: number | null;
  hazmat_certified: boolean;
  twic_card: boolean;
  team_driver: boolean;
  no_tarps: boolean;
  late_tolerance_hours: number | null;
  early_tolerance_hours: number | null;
  ignore_radius: boolean;
  home_base_lat: number | null;
  home_base_lng: number | null;
  avg_mpg: number | null;
  max_driving_hours_per_day: number | null;
  max_on_duty_hours_per_day: number | null;
  earliest_on_duty_hour: number | null;
  latest_on_duty_hour: number | null;
  loading_hours: number | null;
  unloading_hours: number | null;
  tarping_hours: number | null;
  end_of_day_flex_hours: number | null;
  onboarding_completed: boolean;
  disabled_settings?: string[];
  last_login: string;
  order_url_template?: string;
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
    // Optimistically apply the patch so the UI doesn't flash back to
    // the server value between mutate-fires and the post-success refetch.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<Settings>(["settings"]);
      if (previous) {
        queryClient.setQueryData<Settings>(["settings"], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      // Rollback on failure
      if (ctx?.previous) {
        queryClient.setQueryData(["settings"], ctx.previous);
      }
      toast.error("Failed to save settings");
    },
    onSuccess: () => {
      toast.success("Settings saved");
    },
    // Invalidate AFTER settled so the server response becomes source of
    // truth without racing in-flight optimistic updates.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
