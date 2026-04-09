import Link from "next/link";
import { brand } from "@mwbhtx/haulvisor-core";

export function MarketingNav({ variant = "dark", hideAuth = false }: { variant?: "dark" | "light"; hideAuth?: boolean }) {
  const isDark = variant === "dark";

  return (
    <header className="relative z-10">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
        <Link href="/">
          <img src="/haulvisor-logo-white.svg" alt={brand.name} className="h-7" />
        </Link>
        {!hideAuth && (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="h-9 px-5 rounded-full border-2 border-white/30 text-sm font-medium text-white hover:bg-white/10 transition-colors inline-flex items-center"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className={`h-9 px-5 rounded-full text-sm font-medium transition-colors inline-flex items-center ${isDark ? "bg-white text-black hover:bg-white/85" : "bg-white text-black hover:bg-white/85"}`}
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
