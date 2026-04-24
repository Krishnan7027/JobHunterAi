"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Analytics } from "@/lib/api";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const funnelSteps = [
  { key: "applications", label: "Applied", color: "bg-blue-400" },
  { key: "interviews", label: "Interviews", color: "bg-violet-400" },
  { key: "offers", label: "Offers", color: "bg-emerald-400" },
] as const;

const pipelineSegments = [
  { key: "saved", color: "bg-amber-400", label: "Saved" },
  { key: "applied", color: "bg-blue-400", label: "Applied" },
  { key: "interview", color: "bg-violet-400", label: "Interview" },
  { key: "offered", color: "bg-emerald-400", label: "Offer" },
  { key: "rejected", color: "bg-red-400/60", label: "Rejected" },
];

export function AnalyticsPanel({ analytics }: { analytics: Analytics | null }) {
  const router = useRouter();

  if (!analytics || analytics.total_jobs === 0) {
    return (
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0 h-full">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
            <BarChart3 className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Analytics appear after you start applying
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const maxFunnel = Math.max(analytics.applications, 1);

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0 h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              <CardTitle>Analytics</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => router.push("/analytics")}
            >
              Details <ArrowRight className="size-3" />
            </Button>
          </div>
          <CardDescription>Conversion funnel performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center rounded-lg bg-white/[0.03] py-2">
              <p className="text-xl font-bold text-emerald-400">
                {analytics.conversion_rate}%
              </p>
              <p className="text-[10px] text-muted-foreground">Conversion</p>
            </div>
            <div className="text-center rounded-lg bg-white/[0.03] py-2">
              <p className="text-xl font-bold text-amber-400">
                {analytics.offer_rate}%
              </p>
              <p className="text-[10px] text-muted-foreground">Offer Rate</p>
            </div>
          </div>

          {/* Funnel Bars */}
          <div className="space-y-2">
            {funnelSteps.map((step, i) => {
              const value = analytics[step.key] as number;
              const pct = (value / maxFunnel) * 100;
              return (
                <div key={step.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${step.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.15, duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pipeline Bar */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Pipeline</p>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5">
              {pipelineSegments.map((seg) => {
                const count = analytics.pipeline?.[seg.key] || 0;
                const pct = (count / (analytics.total_jobs || 1)) * 100;
                return pct > 0 ? (
                  <motion.div
                    key={seg.key}
                    className={`${seg.color} h-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    title={`${seg.label}: ${count}`}
                  />
                ) : null;
              })}
            </div>
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {pipelineSegments.map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <div className={`size-1.5 rounded-full ${item.color}`} />
                  <span className="text-[9px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
