"use client";

import { motion } from "framer-motion";
import { TrendingUp, Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { EvolutionData } from "@/lib/api";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

export function ProfileEvolution({ data }: { data: EvolutionData | null }) {
  if (!data || data.score_trend.length === 0) {
    return (
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
            <TrendingUp className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Evolution data appears after taking snapshots
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const trend = data.score_trend.slice(-8);
  const maxScore = Math.max(...trend.map((t) => t.score), 1);
  const latestSnapshot = data.snapshots?.[data.snapshots.length - 1];

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <CardTitle>Profile Evolution</CardTitle>
          </div>
          <CardDescription>
            {data.summary || "Your skill growth and score trends over time"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
            {/* Score Trend Chart */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Match Score Trend
              </p>
              <div className="flex items-end gap-1.5 h-20">
                {trend.map((point, i) => {
                  const height = (point.score / maxScore) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        className="w-full rounded-t-sm bg-primary/80 min-h-[2px]"
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: "easeOut" }}
                        title={`Score: ${point.score}`}
                      />
                      <span className="text-[8px] text-muted-foreground">
                        {new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            {latestSnapshot && (
              <div className="flex sm:flex-col gap-4 sm:gap-3 sm:min-w-[120px]">
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-xl font-bold text-primary">
                    {latestSnapshot.skills_count}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Skills</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-xl font-bold text-emerald-400">
                    {latestSnapshot.avg_match_score.toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Avg Score</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-xl font-bold text-violet-400">
                    {latestSnapshot.conversion_rate.toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Conv. Rate</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
