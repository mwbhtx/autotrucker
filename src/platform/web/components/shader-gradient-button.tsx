"use client";

import { ArrowRight } from "lucide-react";
import { Magnetic } from "@/components/ui/magnetic";

export default function ShaderGradientButton({ onClick }: { onClick: () => void }) {
  return (
    <Magnetic intensity={0.6} range={150}>
      <button
        type="button"
        onClick={onClick}
        className="mt-10 h-14 px-10 rounded-full bg-white/[0.12] backdrop-blur-sm hover:bg-white/[0.2] transition-all inline-flex items-center gap-2.5 text-lg font-semibold text-white"
      >
        Try Demo
        <ArrowRight className="h-5 w-5" />
      </button>
    </Magnetic>
  );
}
