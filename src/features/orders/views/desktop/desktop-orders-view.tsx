"use client";

import { useState } from "react";
import { SearchIcon, ZapIcon } from "lucide-react";
import { Input } from "@/platform/web/components/ui/input";
import { Button } from "@/platform/web/components/ui/button";
import { OrdersFilters } from "@/features/orders/components/orders-filters";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { SimulatePanel } from "@/features/orders/components/simulate-panel";
import { useOrders, useOrderSearch, useAllActiveOrders } from "@/core/hooks/use-orders";
import { useAuth } from "@/core/services/auth-provider";
import { useSettings } from "@/core/hooks/use-settings";
import { Skeleton } from "@/platform/web/components/ui/skeleton";
import type { Order, OrderFilters } from "@/core/types";

export function DesktopOrdersView() {
  const { activeCompanyId, loading } = useAuth();
  const { data: settings } = useSettings();
  const [filters, setFilters] = useState<Omit<OrderFilters, "offset" | "limit">>({});
  const [search, setSearch] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Order[]>([]);
  const [simulateOpen, setSimulateOpen] = useState(false);

  function handleToggleSelected(order: Order) {
    setSelectedOrders((prev) => {
      const exists = prev.some((o) => o.order_id === order.order_id);
      if (exists) return prev.filter((o) => o.order_id !== order.order_id);
      if (prev.length >= 2) return prev;
      return [...prev, order];
    });
  }

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

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!activeCompanyId) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No company assigned. Contact an administrator to get access.
        </div>
      </div>
    );
  }

  const simulateButton = (
    <Button
      variant="outline"
      disabled={selectedOrders.length !== 2}
      onClick={() => setSimulateOpen(true)}
    >
      <ZapIcon />
      Simulate
      {selectedOrders.length > 0 && (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          ({selectedOrders.length}/2)
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-6 pb-4">
        <OrdersFilters onSearch={setFilters} simulateButton={simulateButton}>
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
          selectedOrders={selectedOrders}
          onToggleSelected={handleToggleSelected}
        />
      </div>

      {simulateOpen && (
        <SimulatePanel
          selectedOrders={selectedOrders}
          onClose={() => setSimulateOpen(false)}
        />
      )}
    </div>
  );
}
