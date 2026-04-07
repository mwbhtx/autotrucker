"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import { MarketingNav } from "@/platform/web/components/marketing-nav";
import { Menu, X } from "lucide-react";
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  DISCLAIMER,
  ACCEPTABLE_USE,
  LEGAL_LAST_UPDATED,
  brand,
} from "@mwbhtx/haulvisor-core";

/* ── Section definitions ── */
const SECTIONS = [
  { id: "terms", num: "01", label: "Terms of Service", content: TERMS_OF_SERVICE },
  { id: "privacy", num: "02", label: "Privacy Policy", content: PRIVACY_POLICY },
  { id: "disclaimer", num: "03", label: "Disclaimer of Liability", content: DISCLAIMER },
  { id: "acceptable-use", num: "04", label: "Acceptable Use", content: ACCEPTABLE_USE },
];

const QUICK_LINKS = [
  { id: "eligibility", label: "Eligibility" },
  { id: "accuracy-of-information", label: "Data Accuracy" },
  { id: "information-we-collect", label: "Data We Collect" },
  { id: "limitation-of-liability", label: "Liability Cap" },
  { id: "no-dispatch-or-brokerage-relationship", label: "No Dispatch Relationship" },
];

/* ── Detect all-caps paragraphs for special "caps" treatment ── */
function isCapsBlock(text: string) {
  const stripped = text.replace(/[^a-zA-Z]/g, "");
  return stripped.length > 40 && stripped === stripped.toUpperCase();
}

/* ── Custom react-markdown renderers ── */
const mdComponents: Components = {
  /* Section title — rendered by the page wrapper, so strip it from markdown */
  h1: () => null,

  h2: ({ children }) => {
    const text = String(children);
    const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return (
      <h3 id={slug} className="legal-subsection-heading scroll-mt-24">
        {children}
      </h3>
    );
  },

  h3: ({ children }) => (
    <h4 className="legal-sub-subheading">{children}</h4>
  ),

  p: ({ children }) => {
    const text = String(children);
    if (isCapsBlock(text)) {
      return <div className="legal-caps-block">{children}</div>;
    }
    return <p className="legal-paragraph">{children}</p>;
  },

  ul: ({ children }) => <ul className="legal-list">{children}</ul>,

  li: ({ children }) => <li className="legal-list-item">{children}</li>,

  blockquote: ({ children }) => {
    /* Detect "warning" style callouts by looking for Notice/Liability/Warning keywords */
    const text = String(children);
    const isWarning = /notice|liability cap|warning/i.test(text);
    return (
      <div className={`legal-callout ${isWarning ? "legal-callout-warning" : ""}`}>
        {children}
      </div>
    );
  },

  strong: ({ children }) => (
    <strong className="legal-strong">{children}</strong>
  ),
};

export default function LegalPage() {
  const [activeId, setActiveId] = useState("terms");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* Track which section is in view */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-7 h-14 bg-black/90 backdrop-blur-xl border-b border-white/[0.06]">
        <Link href="/" className="font-display text-[22px] tracking-wide leading-none text-white">
          {brand.name}
        </Link>
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to app
        </Link>
      </header>

      <div className="flex pt-14 min-h-screen">
        {/* ── Sidebar nav (desktop) ── */}
        <nav
          className={`fixed top-14 bottom-0 w-[260px] overflow-y-auto border-r border-white/[0.06] bg-[#141414] z-40 transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
        >
          <div className="py-8">
            {/* Documents */}
            <p className="px-6 mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
              Documents
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setSidebarOpen(false)}
                className={`block px-6 py-[7px] text-[13.5px] border-l-2 transition-colors ${
                  activeId === s.id
                    ? "text-primary border-primary bg-primary/[0.08]"
                    : "text-muted-foreground/60 border-transparent hover:text-foreground hover:bg-white/[0.02]"
                }`}
              >
                {s.label}
              </a>
            ))}

            {/* Quick links */}
            <p className="px-6 mt-8 mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
              Quick Links
            </p>
            {QUICK_LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={() => setSidebarOpen(false)}
                className="block px-6 py-[7px] text-[13.5px] text-muted-foreground/60 border-l-2 border-transparent hover:text-foreground hover:bg-white/[0.02] transition-colors"
              >
                {l.label}
              </a>
            ))}

            {/* Last updated */}
            <div className="px-6 mt-10 text-xs text-muted-foreground/40 leading-relaxed">
              <strong className="block text-muted-foreground/60 mb-0.5">Last Updated</strong>
              {LEGAL_LAST_UPDATED}
            </div>
          </div>
        </nav>

        {/* ── Main content ── */}
        <main className="flex-1 lg:ml-[260px] max-w-[780px] px-6 sm:px-14 pt-16 pb-32">
          {/* Hero */}
          <div className="mb-16 pb-10 border-b border-white/[0.06]">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary mb-3">
              Legal
            </p>
            <h1 className="font-display text-[clamp(36px,5vw,52px)] font-bold leading-[1.05] tracking-wide text-foreground mb-4">
              Terms &amp; Policies
            </h1>
            <p className="text-[15px] text-muted-foreground/60 max-w-[520px] leading-[1.7]">
              Please read these documents carefully before using {brand.name}. By
              creating an account or using our service, you agree to be bound by
              these terms.
            </p>
            <div className="flex flex-wrap gap-6 mt-5">
              <span className="text-[12.5px] text-muted-foreground/40">
                <strong className="text-muted-foreground/60 mr-1">Effective:</strong>
                {LEGAL_LAST_UPDATED}
              </span>
              <span className="text-[12.5px] text-muted-foreground/40">
                <strong className="text-muted-foreground/60 mr-1">Jurisdiction:</strong>
                Texas, United States
              </span>
              <span className="text-[12.5px] text-muted-foreground/40">
                <strong className="text-muted-foreground/60 mr-1">Version:</strong>
                1.0
              </span>
            </div>
          </div>

          {/* Document sections */}
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="mb-[72px] scroll-mt-24">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary mb-2">
                Document {s.num}
              </p>
              <h2 className="font-display text-[26px] font-bold tracking-[0.01em] text-foreground mb-6 pb-4 border-b border-white/[0.06]">
                {s.label}
              </h2>
              <ReactMarkdown components={mdComponents}>{s.content}</ReactMarkdown>
            </section>
          ))}

          {/* Contact */}
          <section id="contact" className="mb-[72px] scroll-mt-24">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary mb-2">
              Document 05
            </p>
            <h2 className="font-display text-[26px] font-bold tracking-[0.01em] text-foreground mb-6 pb-4 border-b border-white/[0.06]">
              Contact Information
            </h2>
            <p className="text-[15px] text-muted-foreground/60 mb-5">
              For questions, concerns, or requests related to any of these legal
              documents, please reach out:
            </p>
            <div className="rounded-lg border border-white/[0.06] bg-[#141414] p-7">
              <h3 className="font-display text-lg font-bold text-foreground mb-3">
                {brand.legalEntity} Legal
              </h3>
              <p className="text-sm text-muted-foreground/60 mb-2">
                Email:{" "}
                <a href={`mailto:${brand.legalEmail}`} className="text-primary hover:underline">
                  {brand.legalEmail}
                </a>
              </p>
              <p className="text-sm text-muted-foreground/60">
                Website:{" "}
                <a href={`https://${brand.website}`} className="text-primary hover:underline">
                  {brand.website}
                </a>
              </p>
            </div>
          </section>

          {/* Disclaimer footer */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-[12.5px] text-muted-foreground/40 leading-[1.7]">
            <strong className="text-muted-foreground/60">Attorney Review Recommended.</strong>{" "}
            These documents are provided as a general template and do not
            constitute legal advice. You should consult a licensed attorney in your
            jurisdiction to ensure these documents adequately protect your specific
            business and comply with all applicable laws before publishing.
          </div>
        </main>
      </div>

      {/* ── Mobile nav toggle ── */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 right-6 z-50 lg:hidden w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_4px_20px_rgba(170,255,0,0.3)]"
        aria-label="Toggle navigation"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
