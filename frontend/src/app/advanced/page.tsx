"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Brain,
  TrendingUp,
  Calendar,
  Sparkles,
  BookOpen,
  Target,
  Users,
  Building,
  Lightbulb,
  RefreshCw,
  MapPin,
  Star,
  BarChart3,
  AlertCircle,
  GraduationCap,
  Briefcase,
  MessageCircle,
  Heart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findHiddenJobs,
  getDailyDigest,
  predictInterviewQuestions,
  analyzeSkillGaps,
  getJobs,
  getProfiles,
  type Job,
  type Profile,
  type SkillGap,
} from "@/lib/api";

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

// ============================================================
// Hidden Jobs Tab
// ============================================================
function HiddenJobsTab() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ found: number; jobs: Job[] } | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await findHiddenJobs(query.trim(), location.trim() || undefined);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Search className="size-5 text-primary" />
          <h3 className="font-semibold">Search Hidden Job Market</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Job title or keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()} className="gap-1.5">
            {loading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="size-4" />
                Find Hidden Jobs
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      )}

      {results && !loading && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found <span className="font-semibold text-foreground">{results.found}</span> hidden
            job{results.found !== 1 ? "s" : ""}
          </p>
          {results.jobs.map((job) => (
            <motion.div key={job.id} variants={cardVariants} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{job.title}</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Building className="size-3.5" />
                    {job.company}
                    {job.location && (
                      <>
                        <span className="text-border">|</span>
                        <MapPin className="size-3.5" />
                        {job.location}
                      </>
                    )}
                  </p>
                </div>
                {job.priority_score != null && (
                  <Badge variant="secondary" className="bg-primary/15 text-primary shrink-0">
                    <Star className="size-3 mr-1" />
                    {job.priority_score}
                  </Badge>
                )}
              </div>
              {job.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {job.description}
                </p>
              )}
              {job.salary_range && (
                <p className="text-sm font-medium text-emerald-400">{job.salary_range}</p>
              )}
              {job.apply_url && (
                <a
                  href={job.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Apply <span aria-hidden>&rarr;</span>
                </a>
              )}
            </motion.div>
          ))}
          {results.jobs.length === 0 && (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
              No hidden jobs found. Try different keywords.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ============================================================
// Daily Digest Tab
// ============================================================
function DailyDigestTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getDailyDigest();
        setDigest(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load digest");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-destructive">
        <AlertCircle className="size-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  if (!digest) return null;

  const date = digest.date as string | undefined;
  const topMatches = (digest.top_matches as Array<Record<string, unknown>>) || [];
  const unscoredCount = (digest.unscored_count as number) ?? 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-amber-500/10">
            <Calendar className="size-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold">Daily Digest</h3>
            {date && (
              <p className="text-sm text-muted-foreground">
                {new Date(date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        {unscoredCount > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-amber-400">{unscoredCount}</span> jobs still
            awaiting scoring
          </p>
        )}
      </motion.div>

      {/* Top matches */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Top Matches</h4>
        {topMatches.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
            No matched jobs today. Check back tomorrow.
          </div>
        ) : (
          topMatches.map((match, idx) => (
            <motion.div
              key={idx}
              variants={cardVariants}
              className="glass-card rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {(match.title as string) || "Untitled"}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {(match.company as string) || "Unknown company"}
                </p>
              </div>
              {match.priority_score != null && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <Badge
                    variant="secondary"
                    className={
                      (match.priority_score as number) >= 80
                        ? "bg-emerald-500/15 text-emerald-400"
                        : (match.priority_score as number) >= 50
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-zinc-500/15 text-zinc-400"
                    }
                  >
                    {match.priority_score as number}
                  </Badge>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ============================================================
// Interview Predictor Tab
// ============================================================
function InterviewPredictorTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJobs();
        setJobs(data);
      } catch {
        // non-critical
      } finally {
        setLoadingJobs(false);
      }
    })();
  }, []);

  const handlePredict = async () => {
    if (!selectedJobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await predictInterviewQuestions(Number(selectedJobId));
      setQuestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    behavioral: <Heart className="size-4 text-rose-400" />,
    technical: <GraduationCap className="size-4 text-blue-400" />,
    role_specific: <Briefcase className="size-4 text-violet-400" />,
    "role specific": <Briefcase className="size-4 text-violet-400" />,
    company_culture: <Building className="size-4 text-amber-400" />,
    "company culture": <Building className="size-4 text-amber-400" />,
    preparation_tips: <Lightbulb className="size-4 text-emerald-400" />,
    "preparation tips": <Lightbulb className="size-4 text-emerald-400" />,
  };

  const categoryLabels: Record<string, string> = {
    behavioral: "Behavioral",
    technical: "Technical",
    role_specific: "Role Specific",
    "role specific": "Role Specific",
    company_culture: "Company Culture",
    "company culture": "Company Culture",
    preparation_tips: "Preparation Tips",
    "preparation tips": "Preparation Tips",
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="size-5 text-primary" />
          <h3 className="font-semibold">Predict Interview Questions</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            {loadingJobs ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select
                value={selectedJobId}
                onValueChange={(val) => setSelectedJobId(val as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>
                      {j.title} - {j.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            onClick={handlePredict}
            disabled={loading || !selectedJobId}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Predicting...
              </>
            ) : (
              <>
                <Brain className="size-4" />
                Predict Questions
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      )}

      {questions && !loading && (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
          {Object.entries(questions).map(([category, items]) => (
            <motion.div key={category} variants={cardVariants} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                {categoryIcons[category.toLowerCase()] || (
                  <MessageCircle className="size-4 text-primary" />
                )}
                <h4 className="font-semibold">
                  {categoryLabels[category.toLowerCase()] ||
                    category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </h4>
                <Badge variant="secondary" className="ml-auto">
                  {items.length}
                </Badge>
              </div>
              <Separator />
              <ul className="space-y-2">
                {items.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary font-mono text-xs mt-0.5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ============================================================
// Skill Gap Analysis Tab
// ============================================================
function SkillGapTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<SkillGap[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfiles();
        setProfiles(data);
      } catch {
        // non-critical
      } finally {
        setLoadingProfiles(false);
      }
    })();
  }, []);

  const handleAnalyze = async () => {
    if (!selectedProfileId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeSkillGaps(Number(selectedProfileId));
      setGaps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const importanceBadge = (importance: string) => {
    const lower = importance.toLowerCase();
    if (lower === "high" || lower === "critical") {
      return (
        <Badge variant="secondary" className="bg-red-500/15 text-red-400">
          {importance}
        </Badge>
      );
    }
    if (lower === "medium") {
      return (
        <Badge variant="secondary" className="bg-amber-500/15 text-amber-400">
          {importance}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-zinc-500/15 text-zinc-400">
        {importance}
      </Badge>
    );
  };

  // Find max demand for scaling bars
  const maxDemand = gaps ? Math.max(...gaps.map((g) => g.demand_count), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" />
          <h3 className="font-semibold">Skill Gap Analysis</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            {loadingProfiles ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select
                value={selectedProfileId}
                onValueChange={(val) => setSelectedProfileId(val as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name || p.file_name || `Profile #${p.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={loading || !selectedProfileId}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <BarChart3 className="size-4" />
                Analyze
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      )}

      {gaps && !loading && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {gaps.length === 0 ? (
            <div className="col-span-full glass-card rounded-xl p-8 text-center text-muted-foreground">
              No skill gaps detected. Your profile matches well with current demand.
            </div>
          ) : (
            gaps.map((gap, idx) => (
              <motion.div
                key={idx}
                variants={cardVariants}
                className="glass-card rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold">{gap.skill_name}</h4>
                  {importanceBadge(gap.importance)}
                </div>

                {/* Demand bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Demand</span>
                    <span>{gap.demand_count} jobs</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(gap.demand_count / maxDemand) * 100}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.05, ease: "easeOut" }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </div>

                {/* Learning resources */}
                {gap.learning_resources && gap.learning_resources.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <BookOpen className="size-3" />
                      Resources
                    </p>
                    <ul className="space-y-1">
                      {gap.learning_resources.slice(0, 3).map((resource, ri) => {
                        const name =
                          (resource as Record<string, unknown>).name ||
                          (resource as Record<string, unknown>).title ||
                          "Resource";
                        const url =
                          ((resource as Record<string, unknown>).url as string) || null;
                        return (
                          <li key={ri} className="text-xs">
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {String(name)}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">{String(name)}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
}

// ============================================================
// Main Advanced Page
// ============================================================
export default function AdvancedPage() {
  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Advanced Features</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered tools for your job search
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Tabs defaultValue="hidden-jobs">
          <TabsList className="w-full sm:w-auto flex-wrap">
            <TabsTrigger value="hidden-jobs" className="gap-1.5">
              <Search className="size-3.5" />
              Hidden Jobs
            </TabsTrigger>
            <TabsTrigger value="daily-digest" className="gap-1.5">
              <Calendar className="size-3.5" />
              Daily Digest
            </TabsTrigger>
            <TabsTrigger value="interview" className="gap-1.5">
              <Brain className="size-3.5" />
              Interview Predictor
            </TabsTrigger>
            <TabsTrigger value="skill-gaps" className="gap-1.5">
              <TrendingUp className="size-3.5" />
              Skill Gaps
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="hidden-jobs">
              <HiddenJobsTab />
            </TabsContent>
            <TabsContent value="daily-digest">
              <DailyDigestTab />
            </TabsContent>
            <TabsContent value="interview">
              <InterviewPredictorTab />
            </TabsContent>
            <TabsContent value="skill-gaps">
              <SkillGapTab />
            </TabsContent>
          </div>
        </Tabs>
      </motion.div>
    </div>
  );
}
