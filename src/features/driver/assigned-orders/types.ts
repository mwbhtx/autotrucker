export interface AssignedOrder {
  carrier_order_id: string;
  unit_number?: string;
  trailer?: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  dispatch_date?: string;
  pickup_date?: string;
  loaded_miles?: number;
  rate_per_mile?: number;
  truck_pay?: number;
  source: string;
}
