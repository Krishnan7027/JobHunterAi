"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Brain,
  FileText,
  Mail,
  Link as LinkedinIcon,
  Send,
  BookmarkCheck,
  CalendarCheck,
  Trophy,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  getJob,
  updateJobStatus,
  prepareApplication,
  generateOutreachBundle,
  predictProbability,
  analyzeRejection,
  type Job,
  type PrepareApplicationResult,
  type OutreachBundle,
  type InterviewPrediction,
  type RejectionData,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; accent: string }
> = {
  not_applied: { label: "Not Applied", variant: "secondary", accent: "text-muted-foreground" },
  saved: { label: "Saved", variant: "secondary", accent: "text-amber-400" },
  applied: { label: "Applied", variant: "default", accent: "text-blue-400" },
  interview: { label: "Interview", variant: "outline", accent: "text-violet-400" },
  offered: { label: "Offered", variant: "default", accent: "text-emerald-400" },
  rejected: { label: "Rejected", variant: "destructive", accent: "text-red-400" },
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-red-400";
}

// ---------------------------------------------------------------------------
// Copy Button
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label ? `${label} copied!` : "Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Score Bar (animated)
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  value,
  delay = 0,
}: {
  label: string;
  value: number | null;
  delay?: number;
}) {
  const score = value ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold ${scoreColor(score)}`}>
          {value !== null ? `${Math.round(score)}%` : "N/A"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${scoreBg(score)}`}
          initial={{ width: 0 }}
          animate={{ width: value !== null ? `${score}%` : "0%" }}
          transition={{ delay, duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable Section
// ---------------------------------------------------------------------------

function ExpandableSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-medium flex-1">{title}</span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <Card className="glass-card border-0">
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card border-0">
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  // Core state
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Insights state
  const [prediction, setPrediction] = useState<InterviewPrediction | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [rejection, setRejection] = useState<RejectionData | null>(null);
  const [rejectionLoading, setRejectionLoading] = useState(false);

  // Application state
  const [appResult, setAppResult] = useState<PrepareApplicationResult | null>(null);
  const [appLoading, setAppLoading] = useState(false);

  // Outreach state
  const [outreach, setOutreach] = useState<OutreachBundle | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);

  // Status update loading
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Fetch job data
  const fetchJob = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      const data = await getJob(Number(id));
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [id, isLoggedIn]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Status change handler
  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    setStatusLoading(newStatus);
    try {
      const updated = await updateJobStatus(job.id, newStatus);
      setJob(updated);
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusLoading(null);
    }
  };

  // Predict probability
  const handlePredict = async () => {
    if (!job) return;
    setPredictionLoading(true);
    try {
      const result = await predictProbability([job.id]);
      if (result.predictions.length > 0) {
        setPrediction(result.predictions[0]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to predict probability");
    } finally {
      setPredictionLoading(false);
    }
  };

  // Analyze rejection
  const handleAnalyzeRejection = async () => {
    if (!job) return;
    setRejectionLoading(true);
    try {
      const result = await analyzeRejection(job.id);
      setRejection(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze rejection");
    } finally {
      setRejectionLoading(false);
    }
  };

  // Prepare application
  const handlePrepareApp = async () => {
    if (!job) return;
    setAppLoading(true);
    try {
      const result = await prepareApplication(job.id);
      setAppResult(result);
      toast.success("Application materials ready!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to prepare application");
    } finally {
      setAppLoading(false);
    }
  };

  // Generate outreach
  const handleOutreach = async () => {
    if (!job) return;
    setOutreachLoading(true);
    try {
      const result = await generateOutreachBundle(job.id);
      setOutreach(result);
      toast.success("Outreach messages generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate outreach");
    } finally {
      setOutreachLoading(false);
    }
  };

  // Auth check
  if (!isLoggedIn && !loading) {
    router.push("/login");
    return null;
  }

  if (loading) return <DetailSkeleton />;

  if (error || !job) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Card className="glass-card border-0">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="size-10 mx-auto text-amber-400 mb-4" />
            <p className="text-sm text-muted-foreground">{error || "Job not found"}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/jobs")}>
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.not_applied;
  const matchScore = job.match_score ?? 0;

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Back Button */}
      <motion.div variants={cardVariants}>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Back to Jobs
        </Button>
      </motion.div>

      {/* ----------------------------------------------------------------- */}
      {/* Job Header */}
      {/* ----------------------------------------------------------------- */}
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                  {job.title}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex items-center gap-1">
                    <Briefcase className="size-3.5" />
                    {job.company}
                  </span>
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {job.location}
                    </span>
                  )}
                </CardDescription>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="text-xs">
                    {job.platform}
                  </Badge>
                  <Badge variant={statusCfg.variant} className="text-xs">
                    {statusCfg.label}
                  </Badge>
                  {job.is_easy_apply && (
                    <Badge variant="secondary" className="text-xs text-emerald-400">
                      Easy Apply
                    </Badge>
                  )}
                  {job.is_hidden_job && (
                    <Badge variant="secondary" className="text-xs text-violet-400">
                      Hidden Job
                    </Badge>
                  )}
                  {job.salary_range && (
                    <Badge variant="secondary" className="text-xs">
                      {job.salary_range}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Match Score Circle */}
              {job.match_score !== null && (
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="relative flex size-20 items-center justify-center">
                    <svg className="size-20 -rotate-90" viewBox="0 0 80 80">
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        className="text-white/10"
                      />
                      <motion.circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        className={scoreColor(matchScore)}
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                        animate={{
                          strokeDashoffset:
                            2 * Math.PI * 34 * (1 - matchScore / 100),
                        }}
                        transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
                      />
                    </svg>
                    <span
                      className={`absolute text-lg font-bold ${scoreColor(matchScore)}`}
                    >
                      {Math.round(matchScore)}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Match Score
                  </span>
                </div>
              )}
            </div>
          </CardHeader>

          {/* Apply URL */}
          {job.apply_url && (
            <CardContent className="pt-0">
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                View Original Listing
              </a>
            </CardContent>
          )}
        </Card>
      </motion.div>

      {/* ----------------------------------------------------------------- */}
      {/* Score Breakdown + Status Actions */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Score Breakdown */}
        <motion.div variants={cardVariants}>
          <Card className="glass-card border-0 h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <CardTitle className="text-base">Score Breakdown</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreBar label="Overall Match" value={job.match_score} delay={0.2} />
              <ScoreBar label="Skill Match" value={job.skill_match_pct} delay={0.35} />
              <ScoreBar label="Experience Match" value={job.experience_match} delay={0.5} />
              {job.priority_score !== null && (
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-sm text-muted-foreground">Priority Score</span>
                  <span className="text-sm font-bold">{Math.round(job.priority_score)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Actions */}
        <motion.div variants={cardVariants}>
          <Card className="glass-card border-0 h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <CardTitle className="text-base">Update Status</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Current: <span className={statusCfg.accent}>{statusCfg.label}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { status: "saved", label: "Save", icon: BookmarkCheck, accent: "text-amber-400" },
                  { status: "applied", label: "Applied", icon: Send, accent: "text-blue-400" },
                  { status: "interview", label: "Interview", icon: CalendarCheck, accent: "text-violet-400" },
                  { status: "offered", label: "Offer", icon: Trophy, accent: "text-emerald-400" },
                  { status: "rejected", label: "Reject", icon: XCircle, accent: "text-red-400" },
                ].map(({ status, label, icon: Icon, accent }) => (
                  <Button
                    key={status}
                    variant={job.status === status ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 justify-start"
                    disabled={statusLoading !== null || job.status === status}
                    onClick={() => handleStatusChange(status)}
                  >
                    {statusLoading === status ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Icon className={`size-3.5 ${job.status === status ? "" : accent}`} />
                    )}
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Description */}
      {/* ----------------------------------------------------------------- */}
      {(job.description || job.requirements.length > 0) && (
        <motion.div variants={cardVariants}>
          <Card className="glass-card border-0">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <CardTitle className="text-base">Job Description</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.description && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {job.description}
                  </p>
                </div>
              )}
              {job.requirements.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Requirements</h4>
                  <ul className="space-y-1.5">
                    {job.requirements.map((req, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* AI Insights Panel */}
      {/* ----------------------------------------------------------------- */}
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <CardTitle className="text-base">AI Insights</CardTitle>
            </div>
            <CardDescription className="text-xs">
              AI-powered predictions and analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Interview Probability */}
            {!prediction ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePredict}
                disabled={predictionLoading}
                className="gap-1.5"
              >
                {predictionLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Predict Interview Probability
              </Button>
            ) : (
              <div className="rounded-lg bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Interview Probability</span>
                  <span
                    className={`text-lg font-bold ${scoreColor(prediction.interview_probability * 100)}`}
                  >
                    {Math.round(prediction.interview_probability * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={`h-full rounded-full ${scoreBg(prediction.interview_probability * 100)}`}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${prediction.interview_probability * 100}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                {prediction.factors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Key Factors
                    </p>
                    <ul className="space-y-1">
                      {prediction.factors.map((factor, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground flex items-start gap-1.5"
                        >
                          <span className="mt-1 size-1 shrink-0 rounded-full bg-primary/60" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {prediction.recommendation && (
                  <p className="text-xs text-primary/80 italic">
                    {prediction.recommendation}
                  </p>
                )}
              </div>
            )}

            {/* Rejection Analysis */}
            {job.status === "rejected" && (
              <>
                {!rejection ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAnalyzeRejection}
                    disabled={rejectionLoading}
                    className="gap-1.5"
                  >
                    {rejectionLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="size-3.5" />
                    )}
                    Analyze Rejection
                  </Button>
                ) : (
                  <div className="rounded-lg bg-red-400/5 border border-red-400/10 p-4 space-y-3">
                    <p className="text-sm font-medium text-red-400">
                      Rejection Analysis
                    </p>
                    {rejection.experience_mismatch && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Experience Mismatch:</span>{" "}
                        {rejection.experience_mismatch}
                      </p>
                    )}
                    {rejection.skill_gaps.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Skill Gaps
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {rejection.skill_gaps.map((gap, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">
                              {gap}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {rejection.possible_reasons.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Possible Reasons
                        </p>
                        <ul className="space-y-1">
                          {rejection.possible_reasons.map((reason, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground flex items-start gap-1.5"
                            >
                              <span className="mt-1 size-1 shrink-0 rounded-full bg-red-400/60" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {rejection.improvement_actions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Actions to Improve
                        </p>
                        <ul className="space-y-1">
                          {rejection.improvement_actions.map((action, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground flex items-start gap-1.5"
                            >
                              <span className="mt-1 size-1 shrink-0 rounded-full bg-emerald-400/60" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ----------------------------------------------------------------- */}
      {/* Apply Assistant */}
      {/* ----------------------------------------------------------------- */}
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <CardTitle className="text-base">Apply Assistant</CardTitle>
            </div>
            <CardDescription className="text-xs">
              AI-generated resume and cover letter tailored to this job
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!appResult ? (
              <Button
                onClick={handlePrepareApp}
                disabled={appLoading}
                className="gap-1.5"
              >
                {appLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Prepare Application
              </Button>
            ) : (
              <div className="space-y-3">
                <ExpandableSection
                  title="Tailored Resume"
                  icon={FileText}
                  defaultOpen
                >
                  <div className="relative">
                    <div className="absolute top-0 right-0">
                      <CopyButton text={appResult.tailored_resume} label="Resume" />
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pr-16 max-h-80 overflow-y-auto">
                      {appResult.tailored_resume}
                    </pre>
                  </div>
                </ExpandableSection>

                <ExpandableSection title="Cover Letter" icon={Mail}>
                  <div className="relative">
                    <div className="absolute top-0 right-0">
                      <CopyButton
                        text={appResult.cover_letter}
                        label="Cover Letter"
                      />
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pr-16 max-h-80 overflow-y-auto">
                      {appResult.cover_letter}
                    </pre>
                  </div>
                </ExpandableSection>

                {appResult.answers && appResult.answers.length > 0 && (
                  <ExpandableSection title="Application Answers" icon={MessageSquare}>
                    <div className="space-y-3">
                      {appResult.answers.map((qa, i) => (
                        <div key={i} className="space-y-1">
                          <p className="text-xs font-medium">{qa.question}</p>
                          <p className="text-xs text-muted-foreground">
                            {qa.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ExpandableSection>
                )}

                {appResult.apply_url && (
                  <a
                    href={appResult.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
                  >
                    <ExternalLink className="size-3.5" />
                    Open Application Page
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ----------------------------------------------------------------- */}
      {/* Outreach Panel */}
      {/* ----------------------------------------------------------------- */}
      <motion.div variants={cardVariants}>
        <Card className="glass-card border-0">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="size-4 text-primary" />
              <CardTitle className="text-base">Outreach</CardTitle>
            </div>
            <CardDescription className="text-xs">
              AI-generated cold email, LinkedIn message, and follow-up
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!outreach ? (
              <Button
                variant="outline"
                onClick={handleOutreach}
                disabled={outreachLoading}
                className="gap-1.5"
              >
                {outreachLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Mail className="size-3.5" />
                )}
                Generate Outreach
              </Button>
            ) : (
              <div className="space-y-3">
                {outreach.cold_email && (
                  <ExpandableSection title="Cold Email" icon={Mail} defaultOpen>
                    <div className="relative space-y-2">
                      <div className="absolute top-0 right-0">
                        <CopyButton
                          text={`Subject: ${outreach.cold_email.subject}\n\n${outreach.cold_email.body}`}
                          label="Cold Email"
                        />
                      </div>
                      <p className="text-xs">
                        <span className="font-medium">Subject:</span>{" "}
                        <span className="text-muted-foreground">
                          {outreach.cold_email.subject}
                        </span>
                      </p>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pr-16 max-h-60 overflow-y-auto">
                        {outreach.cold_email.body}
                      </pre>
                    </div>
                  </ExpandableSection>
                )}

                <ExpandableSection title="LinkedIn Message" icon={LinkedinIcon}>
                  <div className="relative">
                    <div className="absolute top-0 right-0">
                      <CopyButton
                        text={outreach.linkedin_message}
                        label="LinkedIn Message"
                      />
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pr-16 max-h-60 overflow-y-auto">
                      {outreach.linkedin_message}
                    </pre>
                  </div>
                </ExpandableSection>

                {outreach.followup_email && (
                  <ExpandableSection title="Follow-up Email" icon={Send}>
                    <div className="relative space-y-2">
                      <div className="absolute top-0 right-0">
                        <CopyButton
                          text={`Subject: ${outreach.followup_email.subject}\n\n${outreach.followup_email.body}`}
                          label="Follow-up"
                        />
                      </div>
                      <p className="text-xs">
                        <span className="font-medium">Subject:</span>{" "}
                        <span className="text-muted-foreground">
                          {outreach.followup_email.subject}
                        </span>
                      </p>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pr-16 max-h-60 overflow-y-auto">
                        {outreach.followup_email.body}
                      </pre>
                    </div>
                  </ExpandableSection>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Posted date / notes footer */}
      {(job.posted_date || job.notes) && (
        <motion.div variants={cardVariants}>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1 pb-4">
            {job.posted_date && <span>Posted: {new Date(job.posted_date).toLocaleDateString()}</span>}
            {job.applied_at && <span>Applied: {new Date(job.applied_at).toLocaleDateString()}</span>}
            {job.notes && <span>Notes: {job.notes}</span>}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
