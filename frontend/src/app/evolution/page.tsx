"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Camera,
  Flame,
  Plus,
  Minus,
  Check,
  Clock,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Briefcase,
  Award,
  Calendar,
  ArrowUpRight,
  Sparkles,
  Bell,
  LogIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getEvolution,
  takeEvolutionSnapshot,
  getCoachInsights,
  getFollowupTiming,
  type EvolutionData,
  type CoachData,
  type FollowupTimingItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------
function SummaryCard({
  summary,
  streakDays,
}: {
  summary: string;
  streakDays: number;
}) {
  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-500/10">
              <TrendingUp className="size-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Evolution Summary</CardTitle>
            </div>
            {streakDays > 0 && (
              <Badge variant="secondary" className="bg-amber-500/15 text-amber-400 gap-1">
                <Flame className="size-3" />
                {streakDays} day streak
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary || "No evolution data yet. Take your first snapshot to start tracking progress."}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skill Growth Card
// ---------------------------------------------------------------------------
function SkillGrowthCard({
  skillGrowth,
}: {
  skillGrowth: Record<string, unknown>;
}) {
  const added = (skillGrowth.added as string[]) || [];
  const maintained = (skillGrowth.maintained as string[]) || [];
  const growthCount = (skillGrowth.growth_count as number) ?? added.length;

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-500/10">
              <Award className="size-5 text-emerald-400" />
            </div>
            <CardTitle className="text-lg">Skill Growth</CardTitle>
            {growthCount > 0 && (
              <Badge variant="secondary" className="ml-auto bg-emerald-500/15 text-emerald-400 gap-1">
                <Plus className="size-3" />
                {growthCount} new
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {added.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Added Skills
              </p>
              <div className="flex flex-wrap gap-2">
                {added.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="bg-emerald-500/15 text-emerald-400 gap-1"
                  >
                    <Plus className="size-3" />
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {maintained.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Maintained Skills
              </p>
              <div className="flex flex-wrap gap-2">
                {maintained.slice(0, 12).map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="bg-zinc-500/15 text-zinc-400 gap-1"
                  >
                    <Check className="size-3" />
                    {skill}
                  </Badge>
                ))}
                {maintained.length > 12 && (
                  <Badge variant="secondary" className="bg-zinc-500/15 text-zinc-400">
                    +{maintained.length - 12} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {added.length === 0 && maintained.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No skill data available yet. Take a snapshot to begin tracking.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Score Trend (CSS mini bar chart)
// ---------------------------------------------------------------------------
function ScoreTrendCard({
  scoreTrend,
}: {
  scoreTrend: Array<{ date: string; score: number; apps: number }>;
}) {
  const maxScore = Math.max(...scoreTrend.map((s) => s.score), 1);

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
              <BarChart3 className="size-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Match Score Trend</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {scoreTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No score trend data yet. Keep applying and scoring jobs.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-end gap-1.5 h-32">
                {scoreTrend.map((point, idx) => {
                  const heightPct = (point.score / maxScore) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center gap-1 min-w-0"
                    >
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {Math.round(point.score)}
                      </span>
                      <motion.div
                        className="w-full rounded-t-sm bg-emerald-500/70 min-h-[4px]"
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{
                          duration: 0.5,
                          delay: idx * 0.06,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                {scoreTrend.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-[9px] text-muted-foreground truncate"
                  >
                    {new Date(point.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
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

// ---------------------------------------------------------------------------
// Application Trend (CSS bars)
// ---------------------------------------------------------------------------
function ApplicationTrendCard({
  applicationTrend,
}: {
  applicationTrend: Array<{ date: string; total: number; interviews: number; offers: number }>;
}) {
  const maxTotal = Math.max(...applicationTrend.map((a) => a.total), 1);

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-blue-500/10">
              <Briefcase className="size-5 text-blue-400" />
            </div>
            <CardTitle className="text-lg">Application Trend</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {applicationTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No application data yet. Start applying to see trends.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-400" />
                  Apps
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-400" />
                  Interviews
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  Offers
                </span>
              </div>

              <div className="flex items-end gap-2 h-32">
                {applicationTrend.map((point, idx) => {
                  const totalPct = (point.total / maxTotal) * 100;
                  const interviewPct = (point.interviews / maxTotal) * 100;
                  const offerPct = (point.offers / maxTotal) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 flex items-end gap-0.5 min-w-0"
                    >
                      <motion.div
                        className="flex-1 rounded-t-sm bg-blue-500/70 min-h-[4px]"
                        initial={{ height: 0 }}
                        animate={{ height: `${totalPct}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.06, ease: "easeOut" }}
                      />
                      <motion.div
                        className="flex-1 rounded-t-sm bg-amber-500/70 min-h-[2px]"
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(interviewPct, 3)}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.06 + 0.1, ease: "easeOut" }}
                      />
                      <motion.div
                        className="flex-1 rounded-t-sm bg-emerald-500/70 min-h-[2px]"
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(offerPct, 3)}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.06 + 0.2, ease: "easeOut" }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                {applicationTrend.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex-1 text-center text-[9px] text-muted-foreground truncate"
                  >
                    {new Date(point.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
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

// ---------------------------------------------------------------------------
// Snapshot History
// ---------------------------------------------------------------------------
function SnapshotHistoryCard({
  snapshots,
}: {
  snapshots: EvolutionData["snapshots"];
}) {
  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-violet-500/10">
              <Camera className="size-5 text-violet-400" />
            </div>
            <CardTitle className="text-lg">Snapshot History</CardTitle>
            <Badge variant="secondary" className="ml-auto">
              {snapshots.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No snapshots yet. Take your first one to begin tracking your evolution.
            </p>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snap, idx) => (
                <motion.div
                  key={snap.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="glass-card rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {new Date(snap.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <Badge variant="secondary" className="bg-primary/15 text-primary text-xs">
                      Score: {Math.round(snap.avg_match_score)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Award className="size-3 text-emerald-400" />
                      {snap.skills_count} skills
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="size-3 text-blue-400" />
                      {snap.total_applications} apps
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3 text-amber-400" />
                      {snap.interviews} interviews
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="size-3 text-emerald-400" />
                      {snap.offers} offers
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="size-3 text-violet-400" />
                      {(snap.conversion_rate * 100).toFixed(1)}% conv.
                    </span>
                  </div>
                  {snap.top_skills && snap.top_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {snap.top_skills.slice(0, 5).map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-[10px] bg-zinc-500/10 text-zinc-400"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Follow-up Timing Card
// ---------------------------------------------------------------------------
function FollowupTimingCard({
  followups,
}: {
  followups: FollowupTimingItem[];
}) {
  const urgencyStyles: Record<string, string> = {
    high: "bg-red-500/15 text-red-400",
    medium: "bg-amber-500/15 text-amber-400",
    low: "bg-emerald-500/15 text-emerald-400",
  };

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-amber-500/10">
              <Bell className="size-5 text-amber-400" />
            </div>
            <CardTitle className="text-lg">Follow-up Timing</CardTitle>
            {followups.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {followups.length}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {followups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No follow-ups recommended right now. Keep applying!
            </p>
          ) : (
            <div className="space-y-3">
              {followups.map((item) => (
                <motion.div
                  key={item.job_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.company}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={urgencyStyles[item.urgency?.toLowerCase()] || urgencyStyles.low}
                    >
                      {item.urgency}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {item.days_since_applied}d ago
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      Best: {item.optimal_day}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Action:</span>{" "}
                    {item.recommended_action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Tone:</span>{" "}
                    {item.message_tone}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------
function EvolutionSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Evolution Page
// ---------------------------------------------------------------------------
export default function EvolutionPage() {
  const { isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [coach, setCoach] = useState<CoachData | null>(null);
  const [followups, setFollowups] = useState<FollowupTimingItem[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [evoData, coachData, followupData] = await Promise.all([
        getEvolution(),
        getCoachInsights().catch(() => null),
        getFollowupTiming().catch(() => ({ followups: [] })),
      ]);
      setEvolution(evoData);
      setCoach(coachData);
      setFollowups(followupData.followups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evolution data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchAll();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, fetchAll]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const result = await takeEvolutionSnapshot();
      toast.success("Snapshot taken!", {
        description: `Recorded on ${new Date(result.created_at).toLocaleDateString()}`,
      });
      // Refresh data after snapshot
      await fetchAll();
    } catch (err) {
      toast.error("Snapshot failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setSnapshotting(false);
    }
  };

  // Auth guard
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto flex items-center justify-center">
        <Card className="glass-card border-0 max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10 mx-auto">
              <LogIn className="size-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Sign in to view your evolution</h2>
            <p className="text-sm text-muted-foreground">
              Track your job search progress over time by logging in.
            </p>
            <Button className="gap-2" onClick={() => window.location.href = "/login"}>
              <LogIn className="size-4" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-500/10">
            <Sparkles className="size-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile Evolution</h1>
            <p className="text-sm text-muted-foreground">
              Track how your job hunt has progressed over time
            </p>
          </div>
        </div>
        <Button
          onClick={handleSnapshot}
          disabled={snapshotting || loading}
          className="gap-2 shrink-0"
        >
          {snapshotting ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Taking Snapshot...
            </>
          ) : (
            <>
              <Camera className="size-4" />
              Take Snapshot
            </>
          )}
        </Button>
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-4 text-sm text-destructive flex items-center gap-2"
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAll}
            className="ml-auto gap-1 text-xs"
          >
            <RefreshCw className="size-3" />
            Retry
          </Button>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && <EvolutionSkeleton />}

      {/* Main content */}
      {!loading && evolution && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Summary */}
          <SummaryCard
            summary={evolution.summary}
            streakDays={coach?.streak_days ?? 0}
          />

          {/* Two-column grid for growth + score trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkillGrowthCard skillGrowth={evolution.skill_growth} />
            <ScoreTrendCard scoreTrend={evolution.score_trend} />
          </div>

          {/* Application trend full width */}
          <ApplicationTrendCard applicationTrend={evolution.application_trend} />

          {/* Two-column grid for history + follow-ups */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SnapshotHistoryCard snapshots={evolution.snapshots} />
            <FollowupTimingCard followups={followups} />
          </div>
        </motion.div>
      )}

      {/* Empty state — loaded but no data at all */}
      {!loading && !error && evolution && evolution.snapshots.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-10 text-center space-y-4"
        >
          <div className="flex items-center justify-center size-14 rounded-2xl bg-emerald-500/10 mx-auto">
            <Camera className="size-7 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold">Start tracking your evolution</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Take your first snapshot to capture your current skills, match scores,
            and application progress. Come back regularly to see how you grow.
          </p>
          <Button onClick={handleSnapshot} disabled={snapshotting} className="gap-2">
            {snapshotting ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Taking Snapshot...
              </>
            ) : (
              <>
                <Camera className="size-4" />
                Take First Snapshot
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
