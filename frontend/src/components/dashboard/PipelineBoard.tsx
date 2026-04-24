"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  Send,
  CalendarCheck,
  Trophy,
  XCircle,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { DashboardStats } from "@/lib/api";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const columns = [
  { key: "saved_count", label: "Saved", icon: BookmarkCheck, color: "text-amber-400", bg: "bg-amber-400/10", ring: "ring-amber-400/20" },
  { key: "applied_count", label: "Applied", icon: Send, color: "text-blue-400", bg: "bg-blue-400/10", ring: "ring-blue-400/20" },
  { key: "interview_count", label: "Interview", icon: CalendarCheck, color: "text-violet-400", bg: "bg-violet-400/10", ring: "ring-violet-400/20" },
  { key: "offer_count", label: "Offers", icon: Trophy, color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "ring-emerald-400/20" },
  { key: "rejected_count", label: "Rejected", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", ring: "ring-red-400/20" },
] as const;

export function PipelineBoard({ stats }: { stats: DashboardStats | null }) {
  const router = useRouter();

  if (!stats) return null;

  return (
    <motion.div variants={cardVariants}>
      <Card
        className="glass-card border-0 h-full cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all"
        onClick={() => router.push("/pipeline")}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Pipeline
              </CardTitle>
              <CardDescription>Application tracking overview</CardDescription>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {columns.map((col) => {
              const value = (stats as unknown as Record<string, number>)[col.key] ?? 0;
              return (
                <div
                  key={col.key}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${col.bg} ring-1 ${col.ring}`}
                  >
                    <col.icon className={`size-4 ${col.color}`} />
                  </div>
                  <span className="text-lg font-bold">{value}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {col.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
