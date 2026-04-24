"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Send,
  CalendarCheck,
  Trophy,
  XCircle,
  GripVertical,
  ExternalLink,
  Filter,
  BarChart3,
  TrendingUp,
  Loader2,
  RefreshCw,
  FileText,
  Copy,
  Check,
  X,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  getAllPipelineJobs,
  updateJobStatus,
  getAnalytics,
  prepareApplication,
  generateAutoFollowup,
  type Job,
  type Analytics,
  type PrepareApplicationResult,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

// --- Pipeline column config ---
const PIPELINE_COLUMNS = [
  { key: "saved", label: "Saved", icon: Bookmark, color: "text-amber-400", bg: "bg-amber-400/10", ring: "ring-amber-400/20" },
  { key: "applied", label: "Applied", icon: Send, color: "text-blue-400", bg: "bg-blue-400/10", ring: "ring-blue-400/20" },
  { key: "interview", label: "Interview", icon: CalendarCheck, color: "text-violet-400", bg: "bg-violet-400/10", ring: "ring-violet-400/20" },
  { key: "offered", label: "Offer", icon: Trophy, color: "text-emerald-400", bg: "bg-emerald-400/10", ring: "ring-emerald-400/20" },
  { key: "rejected", label: "Rejected", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", ring: "ring-red-400/20" },
] as const;

type PipelineStatus = typeof PIPELINE_COLUMNS[number]["key"];

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
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// --- Job Card ---
function JobCard({
  job,
  onStatusChange,
  onPrepare,
  onFollowup,
}: {
  job: Job;
  onStatusChange: (jobId: number, status: string) => void;
  onPrepare: (jobId: number) => void;
  onFollowup: (jobId: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e: React.DragEvent) => {
        setDragging(true);
        e.dataTransfer.setData("text/plain", String(job.id));
      }}
      onDragEnd={() => setDragging(false)}
      className={`group cursor-grab active:cursor-grabbing ${dragging ? "opacity-50" : ""}`}
    >
    <motion.div
      layout
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <Card className="glass-card border-0 transition-all hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <GripVertical className="size-4 shrink-0 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{job.title}</p>
              <p className="text-xs text-muted-foreground truncate">{job.company}</p>
            </div>
            {job.match_score !== null && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                {Math.round(job.match_score)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {job.platform && job.platform !== "other" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {job.platform}
              </Badge>
            )}
            {job.is_easy_apply && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-400 border-emerald-400/30">
                Easy Apply
              </Badge>
            )}
            {job.salary_range && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {job.salary_range}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {job.status === "saved" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2"
                onClick={(e) => { e.stopPropagation(); onPrepare(job.id); }}
              >
                <FileText className="size-3 mr-1" />
                Prepare
              </Button>
            )}
            {job.status === "applied" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px] px-2"
                onClick={(e) => { e.stopPropagation(); onFollowup(job.id); }}
              >
                <Send className="size-3 mr-1" />
                Follow up
              </Button>
            )}
            {job.apply_url && (
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3 mr-1" />
                Link
              </a>
            )}
            <Select
              value={job.status}
              onValueChange={(val: string | null) => { if (val) onStatusChange(job.id, val); }}
            >
              <SelectTrigger className="h-6 text-[10px] px-2 w-auto ml-auto border-0 bg-white/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_COLUMNS.map((col) => (
                  <SelectItem key={col.key} value={col.key} className="text-xs">
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </motion.div>
    </div>
  );
}

// --- Pipeline Column ---
function PipelineColumn({
  column,
  jobs,
  onStatusChange,
  onPrepare,
  onFollowup,
  onDrop,
}: {
  column: typeof PIPELINE_COLUMNS[number];
  jobs: Job[];
  onStatusChange: (jobId: number, status: string) => void;
  onPrepare: (jobId: number) => void;
  onFollowup: (jobId: number) => void;
  onDrop: (jobId: number, status: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const Icon = column.icon;

  return (
    <div
      className={`flex flex-col min-w-[280px] max-w-[320px] flex-1 rounded-xl transition-all ${
        dragOver ? "ring-2 ring-primary/40 bg-primary/5" : ""
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const jobId = parseInt(e.dataTransfer.getData("text/plain"));
        if (!isNaN(jobId)) onDrop(jobId, column.key);
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <div className={`flex size-7 items-center justify-center rounded-lg ${column.bg} ring-1 ${column.ring}`}>
          <Icon className={`size-3.5 ${column.color}`} />
        </div>
        <span className="text-sm font-medium">{column.label}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
          {jobs.length}
        </Badge>
      </div>

      <div className="flex-1 space-y-2 px-1 pb-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        <AnimatePresence mode="popLayout">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={onStatusChange}
              onPrepare={onPrepare}
              onFollowup={onFollowup}
            />
          ))}
        </AnimatePresence>
        {jobs.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground/50">
            Drag jobs here
          </div>
        )}
      </div>
    </div>
  );
}

// --- Analytics Cards ---
function AnalyticsBar({ analytics }: { analytics: Analytics }) {
  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {[
        { label: "Applications", value: analytics.applications, icon: Send, color: "text-blue-400" },
        { label: "Interviews", value: analytics.interviews, icon: CalendarCheck, color: "text-violet-400" },
        { label: "Conversion", value: `${analytics.conversion_rate}%`, icon: TrendingUp, color: "text-emerald-400" },
        { label: "Offer Rate", value: `${analytics.offer_rate}%`, icon: BarChart3, color: "text-amber-400" },
      ].map((stat) => (
        <motion.div key={stat.label} variants={cardVariants}>
          <Card className="glass-card border-0">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                <stat.icon className={`size-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

// --- Main Page ---
export default function PipelinePage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [pipeline, setPipeline] = useState<Record<string, Job[]>>({
    saved: [], applied: [], interview: [], offered: [], rejected: [],
  });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [preparing, setPreparing] = useState<number | null>(null);
  const [prepareResult, setPrepareResult] = useState<PrepareApplicationResult | null>(null);
  const [followupResult, setFollowupResult] = useState<{ subject: string; body: string; job_title: string; company: string; days_waiting: number } | null>(null);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isLoggedIn) { setLoading(false); return; }
    try {
      const [pipelineData, analyticsData] = await Promise.all([
        getAllPipelineJobs(),
        getAnalytics(),
      ]);
      setPipeline(pipelineData);
      setAnalytics(analyticsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = useCallback(async (jobId: number, newStatus: string) => {
    try {
      await updateJobStatus(jobId, newStatus);
      // Optimistic update
      setPipeline((prev) => {
        const updated = { ...prev };
        let movedJob: Job | undefined;
        for (const key of Object.keys(updated)) {
          const idx = updated[key].findIndex((j) => j.id === jobId);
          if (idx !== -1) {
            movedJob = { ...updated[key][idx], status: newStatus };
            updated[key] = [...updated[key].slice(0, idx), ...updated[key].slice(idx + 1)];
            break;
          }
        }
        if (movedJob && newStatus in updated) {
          updated[newStatus] = [movedJob, ...updated[newStatus]];
        }
        return updated;
      });
      toast.success(`Moved to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  }, []);

  const handlePrepare = useCallback(async (jobId: number) => {
    setPreparing(jobId);
    setPrepareResult(null);
    try {
      const result = await prepareApplication(jobId);
      setPrepareResult(result);
    } catch {
      toast.error("Failed to prepare application");
    } finally {
      setPreparing(null);
    }
  }, []);

  const handleFollowup = useCallback(async (jobId: number) => {
    setFollowupLoading(true);
    setFollowupResult(null);
    try {
      const result = await generateAutoFollowup(jobId);
      setFollowupResult(result);
    } catch {
      toast.error("Failed to generate follow-up");
    } finally {
      setFollowupLoading(false);
    }
  }, []);

  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`${label} copied to clipboard`);
  }, []);

  // Filter by platform
  const filteredPipeline = Object.fromEntries(
    Object.entries(pipeline).map(([status, jobs]) => [
      status,
      filterPlatform === "all" ? jobs : jobs.filter((j) => j.platform === filterPlatform),
    ])
  );

  // Get unique platforms
  const allJobs = Object.values(pipeline).flat();
  const platforms = [...new Set(allJobs.map((j) => j.platform).filter(Boolean))];

  if (!isLoggedIn && !loading) {
    return (
      <div className="mx-auto max-w-7xl flex items-center justify-center min-h-[60vh]">
        <Card className="glass-card border-0 p-8 text-center max-w-md">
          <p className="text-sm text-muted-foreground mb-4">Sign in to view your pipeline</p>
          <Button onClick={() => router.push("/login")}>Sign In</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track applications from saved to offer
          </p>
        </div>
        <div className="flex items-center gap-2">
          {platforms.length > 0 && (
            <Select value={filterPlatform} onValueChange={(val: string | null) => setFilterPlatform(val || "all")}>
              <SelectTrigger className="h-8 text-xs w-[130px]">
                <Filter className="size-3 mr-1.5" />
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={fetchData}>
            <RefreshCw className="size-3 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Analytics Row */}
      {analytics && <AnalyticsBar analytics={analytics} />}

      {/* Kanban Board */}
      <div>
        <div className="flex-1 overflow-x-auto">
          {loading ? (
            <div className="flex gap-4">
              {PIPELINE_COLUMNS.map((col) => (
                <div key={col.key} className="min-w-[280px] flex-1 space-y-3">
                  <Skeleton className="h-8 w-full rounded-lg" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              className="flex gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {PIPELINE_COLUMNS.map((col) => (
                <PipelineColumn
                  key={col.key}
                  column={col}
                  jobs={filteredPipeline[col.key] || []}
                  onStatusChange={handleStatusChange}
                  onPrepare={handlePrepare}
                  onFollowup={handleFollowup}
                  onDrop={handleStatusChange}
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Preparing overlay */}
      <AnimatePresence>
        {preparing !== null && !prepareResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <Card className="glass-card-strong border-0 p-8 text-center max-w-sm">
              <Loader2 className="size-8 mx-auto text-primary animate-spin mb-4" />
              <p className="text-sm font-medium">Preparing Application...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Generating tailored resume & cover letter
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prepare result modal */}
      <AnimatePresence>
        {prepareResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setPrepareResult(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-3xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="glass-card-strong border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="size-5 text-primary" />
                        Application Ready: {prepareResult.job_title}
                      </CardTitle>
                      <CardDescription className="mt-1">{prepareResult.company}</CardDescription>
                    </div>
                    <button
                      onClick={() => setPrepareResult(null)}
                      className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Tailored Resume */}
                  {prepareResult.tailored_resume && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="size-4 text-blue-400" />
                          Tailored Resume
                        </h3>
                        <button
                          onClick={() => handleCopy(prepareResult.tailored_resume, "Resume")}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                        >
                          {copied === "Resume" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                          {copied === "Resume" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                        {prepareResult.tailored_resume}
                      </div>
                    </div>
                  )}

                  {/* Cover Letter */}
                  {prepareResult.cover_letter && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Send className="size-4 text-emerald-400" />
                          Cover Letter
                        </h3>
                        <button
                          onClick={() => handleCopy(prepareResult.cover_letter, "Cover Letter")}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                        >
                          {copied === "Cover Letter" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                          {copied === "Cover Letter" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                        {prepareResult.cover_letter}
                      </div>
                    </div>
                  )}

                  {/* Answers */}
                  {prepareResult.answers.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Application Answers</h3>
                      {prepareResult.answers.map((a, i) => (
                        <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">{a.question}</p>
                          <p className="text-sm">{a.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No content */}
                  {!prepareResult.tailored_resume && !prepareResult.cover_letter && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No content generated. Upload your CV first to enable AI-powered application preparation.
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                    {prepareResult.apply_url && (
                      <Button
                        onClick={() => window.open(prepareResult!.apply_url, "_blank")}
                        className="flex-1"
                      >
                        <ExternalLink className="size-4 mr-1.5" />
                        Apply Now
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setPrepareResult(null)}
                    >
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Followup loading overlay */}
      <AnimatePresence>
        {followupLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <Card className="glass-card-strong border-0 p-8 text-center max-w-sm">
              <Loader2 className="size-8 mx-auto text-primary animate-spin mb-4" />
              <p className="text-sm font-medium">Generating Follow-up...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Creating a polite follow-up email
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Followup result modal */}
      <AnimatePresence>
        {followupResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setFollowupResult(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="glass-card-strong border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="size-5 text-blue-400" />
                        Follow-up Email
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {followupResult.job_title} at {followupResult.company}
                        {followupResult.days_waiting > 0 && (
                          <span className="ml-2 text-amber-400">({followupResult.days_waiting} days since applied)</span>
                        )}
                      </CardDescription>
                    </div>
                    <button
                      onClick={() => setFollowupResult(null)}
                      className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subject */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</h3>
                      <button
                        onClick={() => handleCopy(followupResult.subject, "Subject")}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                      >
                        {copied === "Subject" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                        {copied === "Subject" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium">
                      {followupResult.subject}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Body</h3>
                      <button
                        onClick={() => handleCopy(followupResult.body, "Email")}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                      >
                        {copied === "Email" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                        {copied === "Email" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                      {followupResult.body}
                    </div>
                  </div>

                  {/* Copy All */}
                  <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                    <Button
                      onClick={() => handleCopy(`Subject: ${followupResult.subject}\n\n${followupResult.body}`, "Full Email")}
                      className="flex-1"
                    >
                      <Copy className="size-4 mr-1.5" />
                      Copy Full Email
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setFollowupResult(null)}
                    >
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
