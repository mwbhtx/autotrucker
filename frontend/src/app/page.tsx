"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { RoutePathsBackground } from "@/components/route-paths-background";
import { MarketingNav } from "@/components/marketing-nav";
import { ArrowRight, CalendarCheck, Bookmark, DollarSign, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

import ShaderGradientButton from "@/components/shader-gradient-button";
const ShaderGradientCanvas = dynamic(() => import("@shadergradient/react").then(m => ({ default: m.ShaderGradientCanvas })), { ssr: false });
const ShaderGradient = dynamic(() => import("@shadergradient/react").then(m => ({ default: m.ShaderGradient })), { ssr: false });

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
    <div className="min-h-screen bg-[#ff5601] text-foreground">
      <ShaderGradientCanvas
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0, animation: "fade-in 1s ease-in 0.5s forwards" }}
        pixelDensity={1}
        fov={45}
      >
        <ShaderGradient
          animate="on"
          brightness={1.2}
          cAzimuthAngle={180}
          cDistance={3.61}
          cPolarAngle={90}
          cameraZoom={1}
          color1="#ff5005"
          color2="#dbba95"
          color3="#e1a194"
          envPreset="lobby"
          grain="on"
          lightType="env"
          positionX={-1.4}
          positionY={0}
          positionZ={0}
          reflection={0.1}
          rotationX={0}
          rotationY={10}
          rotationZ={50}
          shader="defaults"
          type="waterPlane"
          uAmplitude={1}
          uDensity={3.6}
          uFrequency={5.5}
          uSpeed={0.04}
          uStrength={4}
          uTime={0}
          wireframe={false}
        />
      </ShaderGradientCanvas>

      <div className="relative overflow-hidden min-h-[50vh]">
        <MarketingNav />

        {/* ── Hero ── */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-24 sm:pt-16 pb-20 sm:pb-16">
          <h1 className="font-normal tracking-wide leading-[0.85] text-white" style={{ fontFamily: 'var(--font-bebas-neue)', fontSize: '95px' }}>
            HAULVISOR
          </h1>
          <p className="text-white font-normal whitespace-nowrap" style={{ fontSize: '25px', marginTop: '15px' }}>
            The load board that doesn&apos;t suck.
          </p>

          <ShaderGradientButton onClick={handleDemo} />
          <p className="mt-3 text-sm text-white">No sign up required</p>
        </div>
      </div>

      {/* ── Value prop ── */}
      <div className="relative z-10 border-t border-white/[0.06] bg-[#0b090c]">
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-20 text-center">
          <p className="text-xl sm:text-2xl md:text-[1.7rem] leading-relaxed text-[#d6d6d6]">
            Built for owner-operators who'd rather drive than stare at a load board. We analyze every route, calculate your real profit, and find the
            fastest way home — so you don't have to.
          </p>
        </div>
      </div>

      {/* ── Feature sections ── */}
      <section className="relative z-10 border-t border-white/[0.06] bg-[#0b090c]">
        <div className="max-w-6xl mx-auto px-6 py-20 sm:py-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="rounded-2xl bg-[#0f0d0f] p-8 sm:p-10 flex flex-col"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              >
                <feature.icon className="h-7 w-7 text-[#ff5601] mb-6" />
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
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-24 sm:py-32 text-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-normal tracking-wide leading-[0.9]" style={{ fontFamily: 'var(--font-bebas-neue)' }}>
            Built for truckers.<br />Available today.
          </h2>
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              className="h-14 px-10 rounded-full border border-white/20 backdrop-blur-sm hover:brightness-110 transition-all disabled:pointer-events-none disabled:opacity-50 inline-flex items-center gap-2.5 text-lg font-semibold"
              onClick={handleDemo}
            >
              Try Demo
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/login"
              className="h-12 px-8 rounded-lg border border-white/[0.15] text-base font-medium hover:bg-white/[0.06] transition-colors inline-flex items-center"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#0b090c]">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-10">
          <div className="flex flex-col sm:flex-row gap-12 sm:gap-8">
            <div className="sm:w-40 shrink-0">
              <span className="text-3xl tracking-wide leading-none" style={{ fontFamily: 'var(--font-bebas-neue)' }}>
                HAULVISOR
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
                  <li><button type="button" className="hover:text-foreground transition-colors">AI Profitability</button></li>
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
            <span>Privacy</span>
            <span>Terms</span>
            <span>&copy; {new Date().getFullYear()} Haulvisor</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
