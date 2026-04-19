export interface MonthlyNetOrder {
  order_id: string;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  pay: number | null;
  pickup_date_early_utc: string | null;
}

export interface MonthlyNet {
  month: string;
  earned: number;
  loads_count: number;
  fees_total: number;
  fees_breakdown: { id: string; name: string; monthly_amount: number }[];
  net: number;
  paid_off: boolean;
  paid_off_amount: number;
  remaining_to_cover: number;
  orders: MonthlyNetOrder[];
}
