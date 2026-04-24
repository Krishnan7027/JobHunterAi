"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Target,
  Briefcase,
  Brain,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Activity,
  ArrowRight,
  RefreshCw,
  Loader2,
  Flame,
  Award,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAnalytics,
  getCoachInsights,
  getStrategy,
  getEvolution,
  type Analytics,
  type CoachData,
  type StrategyData,
  type EvolutionData,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

// --- Animations ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 28 },
  },
};

// --- Pipeline status config ---
const PIPELINE_STATUSES = [
  { key: "saved", label: "Saved", color: "bg-amber-400", text: "text-amber-400" },
  { key: "applied", label: "Applied", color: "bg-blue-400", text: "text-blue-400" },
  { key: "interview", label: "Interview", color: "bg-violet-400", text: "text-violet-400" },
  { key: "offered", label: "Offered", color: "bg-emerald-400", text: "text-emerald-400" },
  { key: "rejected", label: "Rejected", color: "bg-red-400", text: "text-red-400" },
] as const;

// --- Priority colors ---
function priorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case "high":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    case "medium":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "low":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    default:
      return "text-muted-foreground bg-white/5 border-white/10";
  }
}

// --- Category badge color ---
function categoryColor(category: string): string {
  switch (category.toLowerCase()) {
    case "strategy":
      return "text-blue-400 bg-blue-400/10 border-blue-400/30";
    case "skills":
      return "text-violet-400 bg-violet-400/10 border-violet-400/30";
    case "timing":
      return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "networking":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";
    case "improvement":
      return "text-red-400 bg-red-400/10 border-red-400/30";
    default:
      return "text-muted-foreground bg-white/5 border-white/10";
  }
}

// --- Animated bar component ---
function AnimatedBar({
  value,
  max,
  color,
  delay = 0,
}: {
  value: number;
  max: number;
  color: string;
  delay?: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-8 w-full rounded-lg bg-white/5 overflow-hidden relative">
      <motion.div
        className={`h-full rounded-lg ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay, ease: [0.32, 0.72, 0, 1] }}
      />
      <div className="absolute inset-0 flex items-center justify-end pr-3">
        <span className="text-xs font-semibold tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}

// --- Conversion Funnel ---
function ConversionFunnel({ analytics }: { analytics: Analytics }) {
  const steps = [
    { label: "Applications", value: analytics.applications, color: "bg-blue-400/80" },
    { label: "Interviews", value: analytics.interviews, color: "bg-violet-400/80" },
    { label: "Offers", value: analytics.offers, color: "bg-emerald-400/80" },
  ];
  const maxVal = Math.max(...steps.map((s) => s.value), 1);

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-400/10 ring-1 ring-blue-400/20">
              <TrendingUp className="size-4 text-blue-400" />
            </div>
            Conversion Funnel
          </CardTitle>
          <CardDescription>From application to offer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, i) => {
            const prevVal = i > 0 ? steps[i - 1].value : step.value;
            const pct = prevVal > 0 ? Math.round((step.value / prevVal) * 100) : 0;
            return (
              <div key={step.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.label}</span>
                    {i > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        {pct}% from prev
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-bold tabular-nums">{step.value}</span>
                </div>
                <AnimatedBar value={step.value} max={maxVal} color={step.color} delay={i * 0.15} />
                {i < steps.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowRight className="size-3 text-muted-foreground/40 rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Pipeline Breakdown ---
function PipelineBreakdown({ analytics }: { analytics: Analytics }) {
  const pipeline = analytics.pipeline || {};
  const total = Object.values(pipeline).reduce((sum, v) => sum + (v || 0), 0) || 1;

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-400/10 ring-1 ring-violet-400/20">
              <BarChart3 className="size-4 text-violet-400" />
            </div>
            Pipeline Breakdown
          </CardTitle>
          <CardDescription>Jobs by current status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segmented bar */}
          <div className="h-6 w-full rounded-full bg-white/5 overflow-hidden flex">
            {PIPELINE_STATUSES.map((status, i) => {
              const count = pipeline[status.key] || 0;
              const pct = (count / total) * 100;
              if (pct === 0) return null;
              return (
                <motion.div
                  key={status.key}
                  className={`h-full ${status.color} ${i === 0 ? "rounded-l-full" : ""} ${i === PIPELINE_STATUSES.length - 1 ? "rounded-r-full" : ""}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: [0.32, 0.72, 0, 1] }}
                  title={`${status.label}: ${count}`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PIPELINE_STATUSES.map((status) => {
              const count = pipeline[status.key] || 0;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={status.key} className="flex items-center gap-2">
                  <div className={`size-2.5 rounded-full ${status.color}`} />
                  <span className="text-xs text-muted-foreground">{status.label}</span>
                  <span className="text-xs font-bold ml-auto tabular-nums">{count}</span>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Metrics Cards ---
function MetricsCards({ analytics }: { analytics: Analytics }) {
  const metrics = [
    {
      label: "Conversion Rate",
      value: `${analytics.conversion_rate}%`,
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      ring: "ring-emerald-400/20",
    },
    {
      label: "Offer Rate",
      value: `${analytics.offer_rate}%`,
      icon: Award,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      ring: "ring-amber-400/20",
    },
    {
      label: "Avg Match Score",
      value: analytics.avg_match_score > 0 ? `${Math.round(analytics.avg_match_score)}` : "--",
      icon: Target,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      ring: "ring-violet-400/20",
    },
    {
      label: "Total Jobs",
      value: analytics.total_jobs,
      icon: Briefcase,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      ring: "ring-blue-400/20",
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {metrics.map((m) => (
        <motion.div key={m.label} variants={cardVariants}>
          <Card className="glass-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex size-10 items-center justify-center rounded-xl ${m.bg} ring-1 ${m.ring}`}>
                <m.icon className={`size-5 ${m.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{m.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

// --- Application Trend (CSS bars, no chart library) ---
function ApplicationTrend({ evolution }: { evolution: EvolutionData }) {
  const trend = evolution.application_trend || [];
  if (trend.length === 0) {
    return (
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-400/10 ring-1 ring-blue-400/20">
                <Activity className="size-4 text-blue-400" />
              </div>
              Application Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-6">
              No trend data yet. Take evolution snapshots to track your progress over time.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const maxTotal = Math.max(...trend.map((t) => t.total), 1);
  const recentTrend = trend.slice(-8);

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-400/10 ring-1 ring-blue-400/20">
              <Activity className="size-4 text-blue-400" />
            </div>
            Application Trend
          </CardTitle>
          <CardDescription>Recent activity snapshots</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {recentTrend.map((point, i) => {
              const totalPct = (point.total / maxTotal) * 100;
              const interviewPct = point.total > 0 ? (point.interviews / point.total) * 100 : 0;
              const dateLabel = new Date(point.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-full flex flex-col items-center justify-end h-28 relative">
                    {/* Total bar */}
                    <motion.div
                      className="w-full max-w-[40px] rounded-t-md bg-blue-400/30 relative overflow-hidden"
                      initial={{ height: 0 }}
                      animate={{ height: `${totalPct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: [0.32, 0.72, 0, 1] }}
                    >
                      {/* Interview portion overlay */}
                      {interviewPct > 0 && (
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 bg-violet-400/60 rounded-t-sm"
                          initial={{ height: 0 }}
                          animate={{ height: `${interviewPct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08 + 0.3 }}
                        />
                      )}
                    </motion.div>
                    <span className="text-[10px] font-bold tabular-nums mt-1">{point.total}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground/60 truncate w-full text-center">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-blue-400/30" />
              <span className="text-[10px] text-muted-foreground">Applications</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-violet-400/60" />
              <span className="text-[10px] text-muted-foreground">Interviews</span>
            </div>
          </div>

          {/* Summary */}
          {evolution.summary && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              {evolution.summary}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- AI Coach Section ---
function CoachSection({ coach }: { coach: CoachData }) {
  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400/10 ring-1 ring-amber-400/20">
              <Brain className="size-4 text-amber-400" />
            </div>
            AI Coach
            {coach.streak_days > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px] px-2 py-0.5 text-amber-400 border-amber-400/30">
                <Flame className="size-3 mr-1" />
                {coach.streak_days} day streak
              </Badge>
            )}
          </CardTitle>
          {coach.daily_summary && (
            <CardDescription className="leading-relaxed">{coach.daily_summary}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {coach.insights.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No insights yet. Apply to more jobs to get AI-powered coaching.
            </p>
          )}
          {coach.insights.map((insight, i) => (
            <motion.div
              key={i}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryColor(insight.category)}`}>
                  {insight.category}
                </Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColor(insight.priority)}`}>
                  {insight.priority} priority
                </Badge>
              </div>
              <div className="flex items-start gap-2">
                <Lightbulb className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">{insight.insight}</p>
              </div>
              <div className="flex items-start gap-2 pl-5">
                <Zap className="size-3 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">{insight.recommendation}</p>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Strategy Section ---
function StrategySection({ strategy }: { strategy: StrategyData }) {
  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/20">
              <Target className="size-4 text-emerald-400" />
            </div>
            Strategy Recommendations
          </CardTitle>
          {strategy.summary && (
            <CardDescription className="leading-relaxed">{strategy.summary}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Apply Recommendations */}
          {strategy.apply.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ThumbsUp className="size-4 text-emerald-400" />
                Recommended to Apply
              </h3>
              <div className="space-y-2">
                {strategy.apply.map((job) => (
                  <div
                    key={job.job_id}
                    className="flex items-start gap-3 rounded-lg bg-emerald-400/[0.04] border border-emerald-400/10 p-3"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 ring-1 ring-emerald-400/20 text-xs font-bold text-emerald-400 tabular-nums">
                      {Math.round(job.score)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                      <p className="text-xs text-emerald-400/70 mt-1 leading-relaxed">{job.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skip Recommendations */}
          {strategy.skip.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ThumbsDown className="size-4 text-red-400" />
                Consider Skipping
              </h3>
              <div className="space-y-2">
                {strategy.skip.map((job) => (
                  <div
                    key={job.job_id}
                    className="flex items-start gap-3 rounded-lg bg-red-400/[0.04] border border-red-400/10 p-3"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-400/10 ring-1 ring-red-400/20 text-xs font-bold text-red-400 tabular-nums">
                      {Math.round(job.score)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{job.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                      <p className="text-xs text-red-400/70 mt-1 leading-relaxed">{job.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {strategy.apply.length === 0 && strategy.skip.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No strategy recommendations yet. Add more jobs to get personalized advice.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// --- Loading Skeleton ---
function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      {/* Coach + Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

// --- Main Page ---
export default function AnalyticsPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      const [analyticsData, coachData, strategyData, evolutionData] = await Promise.all([
        getAnalytics(),
        getCoachInsights().catch(() => null),
        getStrategy().catch(() => null),
        getEvolution().catch(() => null),
      ]);
      setAnalytics(analyticsData);
      setCoach(coachData);
      setStrategy(strategyData);
      setEvolution(evolutionData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Auth guard
  if (!isLoggedIn && !loading) {
    return (
      <div className="mx-auto max-w-7xl flex items-center justify-center min-h-[60vh]">
        <Card className="glass-card border-0 p-8 text-center max-w-md">
          <BarChart3 className="size-10 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">Sign in to view your analytics dashboard</p>
          <Button onClick={() => router.push("/login")}>Sign In</Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <motion.div
      className="mx-auto max-w-7xl space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your job search performance and get AI-powered insights
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="size-3 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3 mr-1.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Metrics Cards */}
      {analytics && <MetricsCards analytics={analytics} />}

      {/* Funnel + Pipeline */}
      {analytics && (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          variants={containerVariants}
        >
          <ConversionFunnel analytics={analytics} />
          <PipelineBreakdown analytics={analytics} />
        </motion.div>
      )}

      {/* Application Trend */}
      {evolution && (
        <motion.div variants={containerVariants}>
          <ApplicationTrend evolution={evolution} />
        </motion.div>
      )}

      {/* Coach + Strategy */}
      {(coach || strategy) && (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          variants={containerVariants}
        >
          {coach && <CoachSection coach={coach} />}
          {strategy && <StrategySection strategy={strategy} />}
        </motion.div>
      )}

      {/* Empty state when no AI data */}
      {!coach && !strategy && !evolution && analytics && (
        <motion.div variants={cardVariants}>
          <Card className="glass-card border-0">
            <CardContent className="p-8 text-center">
              <Brain className="size-10 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium mb-1">AI insights will appear here</p>
              <p className="text-xs text-muted-foreground">
                Apply to jobs, take evolution snapshots, and build your pipeline to unlock AI coaching and strategy recommendations.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
