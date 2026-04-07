"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/core/services/auth-provider";
import { brand } from "@mwbhtx/haulvisor-core";
import { MarketingNav } from "@/platform/web/components/marketing-nav";
import { ArrowRight, CalendarCheck, Bookmark, DollarSign, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import ShaderGradientButton from "@/platform/web/components/shader-gradient-button";
import Link from "next/link";

const FEATURES = [
  {
    title: "Home By Friday",
    hook: "Set your return date.\nWe handle the rest.",
    desc: "Pick when you need to be home and we'll build the most profitable multi-stop route that lands you in your driveway on schedule.",
    icon: CalendarCheck,
  },
  {
    title: "Lane Watchlists",
    hook: "Your lanes. Your rules.",
    desc: "Save your favorite lanes and set your minimum rate. When a new order matches your preferences, we'll notify you instantly — so you never miss a high-paying load on the routes you already know.",
    icon: Bookmark,
  },
  {
    title: "No Middlemen, No BS",
    hook: "Your Truck. Your 20%.",
    desc: "Why pay a dispatcher? Book the same loads yourself and keep the full rate. No gatekeepers, no commissions, no one between you and your money.",
    icon: DollarSign,
  },
  {
    title: "Track Your Performance",
    hook: "Know exactly where your money goes.",
    desc: "See your earnings, costs, and profit per lane — broken down by route, by week, by mile. We crunch the numbers and surface smarter routes so you don't have to.",
    icon: BarChart3,
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loginDemo } = useAuth();

  useEffect(() => {
    if (user) router.replace("/routes");
  }, [user, router]);

  if (user) return null;

  const handleDemo = async () => {
    try {
      await loginDemo();
      router.push("/routes");
    } catch {
      // stay on page
    }
  };

  return (
    <>
      <div className="relative overflow-hidden min-h-[50vh] flex flex-col">
        {/* Hero background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/u3883561265_Semi_truck_pulling_cargo_with_the_word_Haulvisor__f724a03a-3629-4734-9178-e7990a837766_3.png')" }}
        />
        <div className="absolute inset-0 bg-black/50" />

        <MarketingNav />

        {/* ── Hero ── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
          <h1 className="font-display tracking-wide leading-[0.85] text-white text-[56px] sm:text-[95px]">
            {brand.name}
          </h1>
          <p className="text-white font-normal whitespace-nowrap" style={{ fontSize: '25px', marginTop: '15px' }}>
            {brand.tagline}
          </p>

          <ShaderGradientButton onClick={handleDemo} />
          <p className="mt-3 text-sm text-white">No sign up required</p>
        </div>
      </div>

      {/* ── Value prop + Feature sections (joined for beam effect) ── */}
      <div className="relative z-10 border-t border-white/[0.06] bg-background flex flex-col items-center">
        <div className="relative max-w-4xl mx-auto px-6 py-16 sm:py-20 text-center w-full">
          <p className="text-xl sm:text-2xl md:text-[1.7rem] leading-relaxed text-muted-foreground">
            Built for owner-operators who'd rather drive than stare at a load board. We analyze every route, calculate your real profit, and find the
            fastest way home — so you don&apos;t have to.
          </p>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pb-20 sm:pb-28 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="rounded-2xl bg-card p-8 sm:p-10 flex flex-col"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              >
                <feature.icon className="h-7 w-7 text-primary mb-6" />
                <h3 className="text-xl sm:text-2xl font-bold text-foreground leading-snug whitespace-pre-line">
                  {feature.hook}
                </h3>
                <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{ backgroundImage: "url('/huh.png')", backgroundPosition: "center 58%" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-24 sm:py-32 text-center">
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-normal tracking-wide leading-[0.9]">
            Built for truckers.<br />Available today.
          </h2>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              className="h-14 px-10 rounded-full bg-primary hover:brightness-110 transition-all disabled:pointer-events-none disabled:opacity-50 inline-flex items-center gap-2.5 text-lg font-semibold text-primary-foreground"
              onClick={handleDemo}
            >
              Try Demo
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-10">
          <div className="flex flex-col sm:flex-row gap-12 sm:gap-8">
            <div className="sm:w-40 shrink-0">
              <span className="font-display text-3xl tracking-wide leading-none">
                {brand.name}
              </span>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-8">
              <div>
                <p className="text-sm font-semibold text-foreground mb-4">Product</p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li><button type="button" className="hover:text-foreground transition-colors">Route Search</button></li>
                  <li><button type="button" className="hover:text-foreground transition-colors">Round Trips</button></li>
                  <li><button type="button" className="hover:text-foreground transition-colors">Analytics</button></li>
                  <li><button type="button" className="hover:text-foreground transition-colors">Alerts</button></li>
                  <li><button type="button" className="hover:text-foreground transition-colors">Pricing</button></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-4">Features</p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li><button type="button" className="hover:text-foreground transition-colors">Lane Watchlists</button></li>
                  <li><button type="button" className="hover:text-foreground transition-colors">Cost Modeling</button></li>
                  <li><button type="button" className="hover:text-foreground transition-colors">Order Board</button></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-4">Company</p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li><button type="button" className="hover:text-foreground transition-colors">About</button></li>
                  <li><button type="button" className="hover:text-foreground transition-colors">Contact</button></li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-4">Connect</p>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  <li><button type="button" className="hover:text-foreground transition-colors">GitHub</button></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-white/[0.06] flex items-center gap-6 text-xs text-muted-foreground/40">
            <Link href="/legal#privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/legal#terms" className="hover:text-foreground transition-colors">Terms</Link>
            <span>&copy; {new Date().getFullYear()} {brand.name}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
