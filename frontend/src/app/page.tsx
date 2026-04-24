"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDashboardStats,
  getTopMatches,
  getAnalytics,
  getDailyActions,
  getCoachInsights,
  getEvolution,
  type DashboardStats,
  type Job,
  type Analytics,
  type DailyActions,
  type CoachData,
  type EvolutionData,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

import { HeroSection } from "@/components/dashboard/HeroSection";
import { JobMatchPanel } from "@/components/dashboard/JobMatchPanel";
import { PipelineBoard } from "@/components/dashboard/PipelineBoard";
import { AICoachPanel } from "@/components/dashboard/AICoachPanel";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { ProfileEvolution } from "@/components/dashboard/ProfileEvolution";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

function SectionSkeleton() {
  return (
    <Card className="glass-card border-0">
      <div className="p-6 space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topJobs, setTopJobs] = useState<Job[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dailyActions, setDailyActions] = useState<DailyActions | null>(null);
  const [coachData, setCoachData] = useState<CoachData | null>(null);
  const [evolutionData, setEvolutionData] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      const [statsRes, topRes, analyticsRes, actionsRes, coachRes, evoRes] =
        await Promise.all([
          getDashboardStats(),
          getTopMatches(5),
          getAnalytics().catch(() => null),
          getDailyActions().catch(() => null),
          getCoachInsights().catch(() => null),
          getEvolution().catch(() => null),
        ]);
      setStats(statsRes);
      setTopJobs(topRes);
      setAnalytics(analyticsRes);
      setDailyActions(actionsRes);
      setCoachData(coachRes);
      setEvolutionData(evoRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Not logged in
  if (!isLoggedIn && !loading) {
    return (
      <div className="mx-auto max-w-7xl flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="glass-card rounded-2xl p-8 text-center max-w-md">
          <LogIn className="size-12 mx-auto text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">Welcome to AI Job Hunter</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in to access your personalized job hunting dashboard.
          </p>
          <Button onClick={() => router.push("/login")} className="w-full">
            Sign In
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            No account?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-primary hover:underline"
            >
              Register
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl">
        <Card className="glass-card border-0">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure the API server is running.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {loading ? (
        <div className="space-y-6">
          <SectionSkeleton />
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      ) : (
        <motion.div
          className="space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Hero */}
          <HeroSection
            dailyActions={dailyActions}
            coachData={coachData}
            username={user?.username}
          />

          {/* Job Matches + Pipeline */}
          <div className="grid gap-6 lg:grid-cols-2">
            <JobMatchPanel jobs={topJobs} />
            <PipelineBoard stats={stats} />
          </div>

          {/* AI Coach + Analytics */}
          <div className="grid gap-6 lg:grid-cols-2">
            <AICoachPanel data={coachData} />
            <AnalyticsPanel analytics={analytics} />
          </div>

          {/* Profile Evolution */}
          <ProfileEvolution data={evolutionData} />
        </motion.div>
      )}
    </div>
  );
}
