"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/platform/web/components/ui/input";
import { OrdersFilters } from "@/features/orders/components/orders-filters";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { useOrders, useOrderSearch, useAllActiveOrders } from "@/core/hooks/use-orders";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import type { OrderFilters } from "@/core/types";

export function DesktopOrdersView() {
  const { activeCompanyId } = useAuth();
  const { data: settings } = useSettings();
  const [filters, setFilters] = useState<Omit<OrderFilters, "offset" | "limit">>({});
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useOrders(activeCompanyId ?? "", { ...filters, limit: 50 });

  const { data: searchResults, isLoading: searchLoading } = useOrderSearch(
    activeCompanyId ?? "",
    search,
  );

  const { data: allActive } = useAllActiveOrders(activeCompanyId ?? "");
  const totalCount = allActive?.length ?? 0;

  const isSearching = search.trim().length > 0;
  const orders = isSearching
    ? (searchResults ?? [])
    : (data?.pages.flatMap((page) => page.items) ?? []);

  if (!activeCompanyId) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No company assigned. Contact an administrator to get access.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-6 pb-4">
        <OrdersFilters onSearch={setFilters}>
          <div className="relative flex-1 sm:max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID, city, or state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </OrdersFilters>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      <OrdersTable
        companyId={activeCompanyId}
        orders={orders}
        isLoading={isSearching ? searchLoading : isLoading}
        isFetchingNextPage={isSearching ? false : isFetchingNextPage}
        hasNextPage={isSearching ? false : (hasNextPage ?? false)}
        onLoadMore={() => fetchNextPage()}
        onClearFilters={(isSearching || Object.keys(filters).length > 0) ? () => {
          setSearch("");
          setFilters({});
        } : undefined}
        error={error}
        orderUrlTemplate={settings?.order_url_template as string | undefined}
      />
      </div>
    </div>
  );
}
