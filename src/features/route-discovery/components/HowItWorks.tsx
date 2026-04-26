"use client";

import { useState } from "react";
import { Card, CardContent } from "@/platform/web/components/ui/card";
import { ChevronDown, ChevronRight, Route } from "lucide-react";

export function HowItWorks() {
  const [open, setOpen] = useState(true);

  return (
    <Card>
      <CardContent className="py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 w-full text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Route className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Find round-trip routes that bring you home
          </h2>
        </button>

        {open && (
          <div className="mt-3 pl-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Route Discovery looks across your historical orders and surfaces
              high-frequency lane chains — sequences of 2–4 loads where each
              leg picks up near where the previous one dropped off, and the
              whole loop returns to your home base.
            </p>
            <p>
              Enter your home city and a search radius. We&rsquo;ll rank up to
              5 candidate routes by all-in gross rate per mile, accounting for
              empty miles between legs and the deadhead back home.
            </p>
            <p>
              The <span className="font-medium text-foreground">Engine
              Inspectors</span> below show <em>why</em> you&rsquo;re seeing
              what you&rsquo;re seeing — the regions we matched, how dense
              each lane is, and the typical deadhead between legs — so you can
              tell whether your radius is too tight, too loose, or the area
              just needs more order history.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
