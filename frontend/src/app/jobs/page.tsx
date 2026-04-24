"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  Bookmark,
  ExternalLink,
  Star,
  Users,
  Loader2,
  Zap,
  EyeOff,
  ArrowUpDown,
  Briefcase,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
// Tabs removed — using plain buttons for reliable filtering
import { Skeleton } from "@/components/ui/skeleton";

import type { Job } from "@/lib/api";
import {
  fetchJobs,
  getJobs,
  updateJobStatus,
  scoreJobs,
  extractContacts,
  rankJobs,
  applyToJob,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "not_applied", label: "Not Applied" },
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
] as const;

const SORT_OPTIONS = [
  { value: "created_at", label: "Newest" },
  { value: "priority_score", label: "Priority" },
  { value: "match_score", label: "Match Score" },
] as const;

const SOURCE_OPTIONS = [
  { value: "indeed", label: "Indeed" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "naukri", label: "Naukri" },
  { value: "google", label: "Google (All)" },
  { value: "hidden", label: "Hidden Jobs" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case "saved":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "applied":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "interview":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function priorityLabel(score: number | null): {
  text: string;
  className: string;
} {
  if (score === null) return { text: "Unscored", className: "text-muted-foreground" };
  if (score >= 80) return { text: "High", className: "text-priority-high" };
  if (score >= 50) return { text: "Medium", className: "text-priority-medium" };
  return { text: "Low", className: "text-priority-low" };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function JobCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

function MatchScoreBar({ score }: { score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Match</span>
        <span className="font-medium tabular-nums">{score}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${scoreBarColor(score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JobCard
// ---------------------------------------------------------------------------

interface JobCardProps {
  job: Job;
  index: number;
  onStatusChange: (id: number, status: string) => void;
  onScore: (id: number) => void;
  onApply: (id: number) => void;
  onExtractContacts: (id: number) => void;
  loadingAction: string | null;
}

function JobCard({
  job,
  index,
  onStatusChange,
  onScore,
  onApply,
  onExtractContacts,
  loadingAction,
}: JobCardProps) {
  const priority = priorityLabel(job.priority_score);
  const isLoading = loadingAction === String(job.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      layout
    >
      <Card className="glass-card border-0 hover:ring-2 hover:ring-primary/20 transition-all duration-200 overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate font-bold">{job.title}</CardTitle>
              <CardDescription className="mt-0.5">{job.company}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge
                variant="outline"
                className={statusColor(job.status)}
              >
                {job.status.replace("_", " ")}
              </Badge>
              {job.priority_score !== null && (
                <span className={`text-xs font-semibold ${priority.className}`}>
                  {priority.text} priority
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Location & platform */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {job.location}
              </span>
            )}
            <Badge variant="secondary" className={`capitalize text-xs ${
              job.platform === "linkedin" ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
              job.platform === "naukri" ? "bg-purple-500/15 text-purple-400 border-purple-500/20" :
              job.platform === "indeed" ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
              ""
            }`}>
              {job.platform}
            </Badge>
            {job.match_score !== null && job.match_score > 0 && (
              <Badge className={`text-xs font-bold ${
                job.match_score >= 70 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                job.match_score >= 50 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                "bg-red-500/20 text-red-400 border-red-500/30"
              }`}>
                {job.match_score}% match
              </Badge>
            )}
            {job.is_easy_apply && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                <Zap className="size-3 mr-0.5" />
                Easy Apply
              </Badge>
            )}
            {job.is_hidden_job && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                <EyeOff className="size-3 mr-0.5" />
                Hidden Job
              </Badge>
            )}
          </div>

          {/* Posted / Added date */}
          {job.posted_date ? (
            <p className="text-xs text-muted-foreground/70">
              Posted {job.posted_date}
            </p>
          ) : job.created_at ? (
            <p className="text-xs text-muted-foreground/70">
              Added {new Date(job.created_at).toLocaleDateString()}
            </p>
          ) : null}

          {/* Salary */}
          {job.salary_range && (
            <p className="text-sm font-medium text-emerald-400">
              {job.salary_range}
            </p>
          )}

          {/* Match score bar */}
          {job.match_score !== null && job.match_score > 0 && (
            <MatchScoreBar score={job.match_score} />
          )}
        </CardContent>

        <CardFooter className="flex-wrap gap-1.5 border-t-0 bg-transparent p-4 pt-0">
          {job.status !== "saved" && (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => onStatusChange(job.id, "saved")}
            >
              <Bookmark className="size-3.5 mr-1" />
              Save
            </Button>
          )}

          {job.status !== "applied" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => onApply(job.id)}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <Briefcase className="size-3.5 mr-1" />
              Apply
            </Button>
          ) : (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-2 py-1">
              Applied
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => onScore(job.id)}
          >
            {isLoading ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <Star className="size-3.5 mr-1" />
            )}
            Score
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => onExtractContacts(job.id)}
          >
            <Users className="size-3.5 mr-1" />
            Extract Contacts
          </Button>

          {job.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="size-3.5" />
              View
            </a>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function JobsPage() {
  const searchParams = useSearchParams();

  // Search state
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("india");
  const [workType, setWorkType] = useState("all");
  const [platform, setSource] = useState<string>("indeed");

  // Data state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<string | null>(null);
  const [autoSearchDone, setAutoSearchDone] = useState(false);
  const [ranking, setRanking] = useState(false);

  // Filter / sort state
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");

  // Load existing jobs on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getJobs();
        if (!cancelled) setJobs(data);
      } catch {
        // Silently fail on initial load
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-search from URL param (?q=QA+automation)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSearchDone) {
      setQuery(q);
      setAutoSearchDone(true);
    }
  }, [searchParams, autoSearchDone]);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      // Build search query with work type
      let searchQuery = query;
      if (workType === "remote") searchQuery += " remote work from home";
      else if (workType === "wfo") searchQuery += " onsite office";

      // Map location
      const loc = location === "india" ? "India" : undefined;

      const result = await fetchJobs(
        searchQuery,
        loc,
        [platform]
      );
      setJobs(result.jobs);
      setSearchSource(result.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, location, workType, platform]);

  // Auto-trigger search when query set from URL
  useEffect(() => {
    if (autoSearchDone && query && !searching && jobs.length === 0) {
      handleSearch();
    }
  }, [autoSearchDone, query, handleSearch, searching, jobs.length]);

  // Apply handler — opens URL + tracks in DB
  const handleApply = useCallback(async (jobId: number) => {
    setLoadingAction(String(jobId));
    try {
      const result = await applyToJob(jobId);

      // Open apply URL in new tab
      if (result.apply_url) {
        window.open(result.apply_url, "_blank", "noopener,noreferrer");
      }

      // Update local state
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "applied" } : j))
      );

      if (result.status === "already_applied") {
        toast.info("Already Applied", { description: result.message });
      } else {
        toast.success("Application Tracked", { description: result.message });
      }
    } catch (err) {
      toast.error("Apply failed", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoadingAction(null);
    }
  }, []);

  // Action handlers
  const handleStatusChange = useCallback(async (id: number, status: string) => {
    setLoadingAction(String(id));
    try {
      const updated = await updateJobStatus(id, status);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoadingAction(null);
    }
  }, []);

  const handleScore = useCallback(async (jobId: number) => {
    setLoadingAction(String(jobId));
    try {
      const results = await scoreJobs(undefined, [jobId]);
      if (results.length > 0) {
        const result = results[0];
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  match_score: result.match_score,
                  skill_match_pct: result.skill_match_pct,
                  experience_match: result.experience_match,
                  priority_score: result.priority_score,
                }
              : j
          )
        );
        toast.success(`Match score: ${result.match_score}%`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scoring failed";
      // Show CV upload prompt if profile missing
      if (msg.includes("CV") || msg.includes("profile") || msg.includes("skills")) {
        toast.error("CV Required", { description: msg });
      } else {
        toast.error("Scoring failed", { description: msg });
      }
    } finally {
      setLoadingAction(null);
    }
  }, []);

  const handleExtractContacts = useCallback(async (jobId: number) => {
    setLoadingAction(String(jobId));
    try {
      const result = await extractContacts(jobId);
      if (result.total > 0) {
        setError(null);
        const verified = result.contacts.filter((c) => c.verified).length;
        const unverified = result.total - verified;
        toast.success(`Extracted ${result.total} contact(s)`, {
          description: `${verified} verified, ${unverified} unverified. Check the Contacts tab.`,
        });
      } else {
        toast.warning("No contacts found", {
          description: result.message || "This job posting has no visible recruiter info.",
        });
      }
    } catch (err) {
      toast.error("Contact extraction failed", {
        description: err instanceof Error ? err.message : "Try again later.",
      });
    } finally {
      setLoadingAction(null);
    }
  }, []);

  // Rank jobs with AI
  const handleRankJobs = useCallback(async () => {
    setRanking(true);
    try {
      const result = await rankJobs();
      if (result.error) {
        toast.warning(result.error);
        return;
      }
      if (result.jobs && result.jobs.length > 0) {
        // Update local jobs with scores
        setJobs((prev) =>
          prev.map((j) => {
            const ranked = result.jobs.find((r) => r.id === j.id);
            if (ranked) {
              return { ...j, match_score: ranked.score, priority_score: ranked.score };
            }
            return j;
          })
        );
        toast.success(`Ranked ${result.ranked} jobs`, {
          description: `Top score: ${result.jobs[0]?.score || 0}. Sort by "Best Match" to see results.`,
        });
      } else {
        toast.info("No unscored jobs to rank");
      }
    } catch (err) {
      toast.error("Ranking failed", {
        description: err instanceof Error ? err.message : "Try again later.",
      });
    } finally {
      setRanking(false);
    }
  }, []);

  // Filter and sort jobs (real-time client-side after search)
  const filteredJobs = jobs
    .filter((j) => statusFilter === "all" || j.status === statusFilter)
    .filter((j) => {
      // Location filter
      if (location === "india") {
        const loc = (j.location || "").toLowerCase();
        const indianCities = [
          "india", "bangalore", "bengaluru", "mumbai", "delhi", "new delhi",
          "hyderabad", "chennai", "pune", "kolkata", "noida", "gurgaon", "gurugram",
          "kochi", "cochin", "trivandrum", "thiruvananthapuram", "ahmedabad",
          "jaipur", "lucknow", "chandigarh", "indore", "bhopal", "nagpur",
          "coimbatore", "madurai", "visakhapatnam", "vizag", "mysore", "mysuru",
          "mangalore", "mangaluru", "thrissur", "calicut", "kozhikode",
          "surat", "vadodara", "rajkot", "gandhinagar", "patna", "ranchi",
          "bhubaneswar", "guwahati", "dehradun", "shimla", "amritsar",
          "mohali", "panchkula", "faridabad", "ghaziabad", "greater noida",
          "navi mumbai", "thane", "wakad", "hinjewadi", "whitefield",
          "electronic city", "manyata", "marathahalli", "koramangala",
          "karnataka", "maharashtra", "tamil nadu", "kerala", "telangana",
          "andhra pradesh", "west bengal", "uttar pradesh", "rajasthan",
          "gujarat", "haryana", "punjab",
        ];
        return indianCities.some((c) => loc.includes(c))
          || loc.includes("remote") || loc === "";
      }
      return true; // "other" = show all
    })
    .filter((j) => {
      // Work type filter
      if (workType === "all") return true;
      const loc = (j.location || "").toLowerCase();
      const desc = (j.description || "").toLowerCase();
      const text = loc + " " + desc;
      if (workType === "remote") {
        return text.includes("remote") || text.includes("work from home") || text.includes("wfh");
      }
      if (workType === "wfo") {
        return !text.includes("remote") && !text.includes("work from home") && !text.includes("wfh");
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "priority_score") {
        return (b.priority_score ?? 0) - (a.priority_score ?? 0);
      }
      if (sortBy === "match_score") {
        return (b.match_score ?? 0) - (a.match_score ?? 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground mt-1">
          Search, track, and manage your job applications
        </p>
      </motion.div>

      {/* Search bar */}
      <motion.div
        className="glass-card rounded-xl p-4 space-y-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Job title, keywords, or company..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Select value={location} onValueChange={(v: string | null) => { if (v) setLocation(v); }}>
            <SelectTrigger className="sm:w-32">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="india">India</SelectItem>
              <SelectItem value="other">Global</SelectItem>
            </SelectContent>
          </Select>
          <Select value={workType} onValueChange={(v: string | null) => { if (v) setWorkType(v); }}>
            <SelectTrigger className="sm:w-32">
              <SelectValue placeholder="Work Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="remote">Remote / WFH</SelectItem>
              <SelectItem value="wfo">On-site / WFO</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={(v: string | null) => { if (v) setSource(v); }}>
            <SelectTrigger className="sm:w-36">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="sm:w-28"
          >
            {searching ? (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            ) : (
              <Search className="size-4 mr-1.5" />
            )}
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setQuery("");
              setLocation("india");
              setWorkType("all");
              setSource("indeed");
              setSearchSource(null);
              setError(null);
              setJobs([]);
            }}
            className="sm:w-28 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <RotateCcw className="size-4 mr-1.5" />
            Reset
          </Button>
          {jobs.length > 0 && (
            <Button
              onClick={handleRankJobs}
              disabled={ranking}
              className="sm:w-32 bg-violet-600 hover:bg-violet-700"
            >
              {ranking ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Star className="size-4 mr-1.5" />
              )}
              {ranking ? "Ranking..." : "AI Rank"}
            </Button>
          )}
        </div>
      </motion.div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 underline hover:no-underline"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status filter + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          {STATUS_OPTIONS.map((opt) => {
            const count = opt.value === "all" ? jobs.length : jobs.filter((j) => j.status === opt.value).length;
            const isActive = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
                {opt.value !== "all" && count > 0 && (
                  <span className="text-xs tabular-nums opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
          {SORT_OPTIONS.map((opt) => {
            const isActive = sortBy === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.value === "created_at" && <ArrowUpDown className="size-3" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Job grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <Briefcase className="size-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No jobs found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {statusFilter !== "all"
              ? "No jobs match the current filter. Try selecting a different tab."
              : "Search for jobs using the search bar above to get started."}
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          layout
        >
          <AnimatePresence mode="popLayout">
            {filteredJobs.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                index={i}
                onStatusChange={handleStatusChange}
                onScore={handleScore}
                onApply={handleApply}
                onExtractContacts={handleExtractContacts}
                loadingAction={loadingAction}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Source badge + count footer */}
      {!loading && filteredJobs.length > 0 && (
        <div className="text-center pb-4 space-y-1">
          {searchSource && (
            <div className="inline-flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                searchSource.includes("fallback")
                  ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20"
                  : "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
              }`}>
                {searchSource.includes("fallback")
                  ? `Results via ${searchSource.replace("_fallback", "")} (fallback)`
                  : `Source: ${searchSource}`}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Showing {filteredJobs.length} of {jobs.length} jobs
          </p>
        </div>
      )}
    </div>
  );
}
