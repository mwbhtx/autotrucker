"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OrdersFilters } from "@/components/orders/orders-filters";
import { OrdersTable } from "@/components/orders/orders-table";
import { useOrders, useOrderSearch, useAllActiveOrders } from "@/lib/hooks/use-orders";
import { useAuth } from "@/components/auth-provider";
import type { OrderFilters } from "@/lib/types";

export default function OrdersPage() {
  const { activeCompanyId } = useAuth();
  const [filters, setFilters] = useState<Omit<OrderFilters, "last_key" | "limit">>({});
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
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No company assigned. Contact an administrator to get access.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-6 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="mt-1 text-muted-foreground">
            {isSearching
              ? `${orders.length} result${orders.length !== 1 ? "s" : ""} found`
              : totalCount > 0
                ? `${totalCount.toLocaleString()} orders available`
                : "Browse and filter available orders."}
          </p>
        </div>

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
      />
      </div>
    </div>
  );
}
