"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  Search,
  BarChart3,
  Kanban,
  Flame,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DailyActions, CoachData } from "@/lib/api";
import { AgentPlanButton } from "@/components/dashboard/AgentPlanButton";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HeroSection({
  dailyActions,
  coachData,
  username,
}: {
  dailyActions: DailyActions | null;
  coachData: CoachData | null;
  username?: string;
}) {
  const router = useRouter();

  const quickActions = [
    { label: "Find Jobs", icon: Search, href: "/jobs", accent: "text-blue-400" },
    { label: "Score All", icon: BarChart3, href: "/jobs", accent: "text-emerald-400" },
    { label: "Pipeline", icon: Kanban, href: "/pipeline", accent: "text-violet-400" },
  ];

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0 ring-1 ring-primary/20 overflow-hidden relative">
        {/* Subtle gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />

        <CardHeader className="relative">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                {getGreeting()}{username ? `, ${username}` : ""} 👋
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {coachData?.daily_summary || "Your AI-powered job hunting command center"}
              </p>
            </div>
            {coachData && coachData.streak_days > 0 && (
              <Badge variant="secondary" className="gap-1.5 text-amber-400">
                <Flame className="size-3" />
                {coachData.streak_days} day streak
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="relative space-y-4">
          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            <AgentPlanButton />
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="gap-1.5 bg-white/5 border-white/10 hover:bg-white/10"
                onClick={() => router.push(action.href)}
              >
                <action.icon className={`size-3.5 ${action.accent}`} />
                {action.label}
              </Button>
            ))}
          </div>

          {/* Top Daily Actions */}
          {dailyActions && dailyActions.actions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Today&apos;s Focus
                </span>
              </div>
              <div className="space-y-1.5">
                {dailyActions.actions.slice(0, 3).map((action, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => {
                      if (action.type === "apply" || action.type === "followup") {
                        router.push("/pipeline");
                      } else {
                        router.push("/jobs");
                      }
                    }}
                  >
                    <div
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ${
                        action.priority === "high"
                          ? "bg-red-400/10 ring-red-400/20 text-red-400"
                          : "bg-amber-400/10 ring-amber-400/20 text-amber-400"
                      }`}
                    >
                      <span className="text-[8px] font-bold uppercase">
                        {action.priority[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{action.title}</p>
                    </div>
                    <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
