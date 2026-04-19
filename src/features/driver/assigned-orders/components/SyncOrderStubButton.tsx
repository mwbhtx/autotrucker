"use client";

import { Button } from "@/platform/web/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/web/components/ui/tooltip";

/**
 * Stub button for unlinked rows (has_order_details: false).
 *
 * The actual Sync Order flow is implemented in the companion feature
 * (see `2026-04-18-sync-order-design.md`). This stub renders disabled
 * with an explanatory tooltip; the companion plan replaces the onClick
 * handler and removes the disabled state.
 *
 * We wrap the (disabled) Button in a span so the tooltip trigger still
 * receives pointer events — Radix tooltips won't fire on disabled buttons
 * because the browser strips events from them.
 */
export function SyncOrderStubButton({ orderId }: { orderId: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Sync Order — coming soon."
              data-order-id={orderId}
              aria-label="Sync order"
            >
              Sync
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Sync Order — coming soon.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
