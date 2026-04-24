"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Flame,
  Zap,
  Target,
  Users,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CoachData } from "@/lib/api";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  skills: Target,
  applications: TrendingUp,
  strategy: Lightbulb,
  networking: Users,
};

const priorityStyles: Record<string, string> = {
  high: "bg-red-400/10 text-red-400 ring-red-400/20",
  medium: "bg-amber-400/10 text-amber-400 ring-amber-400/20",
  low: "bg-emerald-400/10 text-emerald-400 ring-emerald-400/20",
};

export function AICoachPanel({ data }: { data: CoachData | null }) {
  if (!data) {
    return (
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0 h-full">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
            <Brain className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              AI Coach insights will appear here
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0 h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <CardTitle>AI Coach</CardTitle>
            </div>
            {data.streak_days > 0 && (
              <Badge variant="secondary" className="gap-1 text-amber-400">
                <Flame className="size-3" />
                {data.streak_days}d
              </Badge>
            )}
          </div>
          <CardDescription>{data.daily_summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.insights.map((insight, i) => {
            const CategoryIcon = categoryIcons[insight.category] || Lightbulb;
            return (
              <div
                key={i}
                className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <CategoryIcon className="size-3.5 text-primary" />
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {insight.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 ring-1 border-0 ${priorityStyles[insight.priority] || priorityStyles.medium}`}
                  >
                    {insight.priority}
                  </Badge>
                </div>
                <p className="text-sm">{insight.insight}</p>
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Zap className="size-3 text-primary shrink-0 mt-0.5" />
                  <span>{insight.recommendation}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
