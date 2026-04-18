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
}
