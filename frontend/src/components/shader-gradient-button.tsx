"use client";

import { ArrowRight } from "lucide-react";

export default function ShaderGradientButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-10 h-14 px-10 rounded-full border border-black/20 backdrop-blur-sm hover:brightness-110 transition-all inline-flex items-center gap-2.5 text-lg font-semibold text-white"
    >
      Try Demo
      <ArrowRight className="h-5 w-5" />
    </button>
  );
}
