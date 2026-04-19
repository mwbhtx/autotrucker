export interface AssignedOrder {
  order_id: string;
  status: "dispatched" | "settled";
  ingested_at: string;
  has_order_details: boolean;
  // Merged fields from orders table (present when has_order_details = true):
  pickup_date?: string;
  dispatch_date?: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  loaded_miles?: number;
  rate_per_mile?: number;
  pay?: number;
  unit_number?: string;
  trailer?: string;
}
