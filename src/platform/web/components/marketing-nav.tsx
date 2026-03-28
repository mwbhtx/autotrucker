import Link from "next/link";

export function MarketingNav({ variant = "dark", hideAuth = false }: { variant?: "dark" | "light"; hideAuth?: boolean }) {
  const isDark = variant === "dark";

  return (
    <header className="relative z-10 border-b border-black/20 bg-black/55 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
        <Link href="/" className={`text-3xl tracking-wide leading-none ${isDark ? "text-white" : "text-white"}`} style={{ fontFamily: 'var(--font-bebas-neue)' }}>
          HAULVISOR
        </Link>
        {!hideAuth && (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="h-9 px-5 rounded-full bg-black border border-white/[0.08] text-sm font-medium text-white hover:bg-black/80 transition-colors inline-flex items-center"
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
