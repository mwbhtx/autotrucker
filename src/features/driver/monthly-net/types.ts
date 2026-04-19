export interface MonthlyNetOrder {
  order_id: string;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  pay: number | null;
  /** YYYY-MM-DD. Backend prefers assigned_orders.pickup_date, falls back to
   *  the date portion of orders.pickup_date_early_utc. */
  pickup_date: string | null;
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
