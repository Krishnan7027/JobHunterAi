"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Loader2,
  User,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Wrench,
  Globe,
  Star,
  AlertTriangle,
  ChevronDown,
  CheckCircle,
  BarChart3,
  Sparkles,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import type { Profile, SkillGap, ProfileAnalysis } from "@/lib/api";
import {
  uploadCV,
  getProfiles,
  deleteProfile,
  scoreJobs,
  analyzeSkillGaps,
  analyzeProfile,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function importanceBadge(importance: string) {
  switch (importance.toLowerCase()) {
    case "high":
      return { className: "bg-red-500/20 text-red-400 border-red-500/30", icon: "!" };
    case "medium":
      return { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: "~" };
    case "low":
      return { className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: null };
    default:
      return { className: "bg-muted text-muted-foreground", icon: null };
  }
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.1 },
  }),
};

// ---------------------------------------------------------------------------
// Upload zone
// ---------------------------------------------------------------------------

function UploadZone({
  onUpload,
  uploading,
}: {
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && isValidFileType(file)) {
        setSelectedFile(file);
      }
    },
    []
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && isValidFileType(file)) {
        setSelectedFile(file);
      }
    },
    []
  );

  function isValidFileType(file: File): boolean {
    // Check by extension (reliable) — MIME type unreliable for .docx on some OS/browsers
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext && ["pdf", "docx", "doc"].includes(ext)) return true;
    // Fallback: check MIME type
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    return validTypes.includes(file.type);
  }

  return (
    <motion.div
      custom={0}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
    >
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5" />
            Upload CV
          </CardTitle>
          <CardDescription>
            Upload your resume to parse skills, experience, and education
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              relative flex cursor-pointer flex-col items-center justify-center rounded-lg
              border-2 border-dashed p-8 transition-colors
              ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
              }
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleFileChange}
            />
            <FileText className="size-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              Drop your CV here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF or DOCX files accepted
            </p>
          </div>

          <AnimatePresence>
            {selectedFile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  size="sm"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpload(selectedFile);
                  }}
                >
                  {uploading ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="size-4 mr-1.5" />
                  )}
                  Upload & Parse
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Profile selector
// ---------------------------------------------------------------------------

function ProfileSelector({
  profiles,
  selectedId,
  onSelect,
  onDelete,
}: {
  profiles: Profile[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  if (profiles.length === 0) return null;

  return (
    <motion.div
      custom={1}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
    >
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Your Profiles
          </CardTitle>
          <CardDescription>
            Select a profile to view details and run actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => { setOpen(!open); setConfirmId(null); }}
            className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <span className="font-medium">
              {selectedId
                ? profiles.find((p) => p.id === selectedId)?.name ||
                  profiles.find((p) => p.id === selectedId)?.file_name ||
                  `Profile #${selectedId}`
                : "Select a profile..."}
            </span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
          {open && (
            <div className="space-y-1">
              {profiles.map((p) => (
                <div key={p.id}>
                  <div
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors hover:bg-muted/50 ${
                      selectedId === p.id ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <button
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      onClick={() => {
                        onSelect(p.id);
                        setOpen(false);
                        setConfirmId(null);
                      }}
                    >
                      <User className="size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {p.name || p.file_name || `Profile #${p.id}`}
                        </p>
                        {p.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {p.email}
                          </p>
                        )}
                      </div>
                    </button>
                    {selectedId === p.id && (
                      <CheckCircle className="size-4 text-primary shrink-0" />
                    )}
                    {confirmId === p.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            onDelete(p.id);
                            setConfirmId(null);
                          }}
                          className="h-6 px-2 rounded text-xs font-medium bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(p.id)}
                        className="size-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                        title="Delete profile"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Profile detail display
// ---------------------------------------------------------------------------

function ProfileDetail({ profile }: { profile: Profile }) {
  return (
    <motion.div
      custom={2}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Basic info */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle>{profile.name || "Profile Details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            {profile.email && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Mail className="size-4" />
                {profile.email}
              </span>
            )}
            {profile.phone && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-4" />
                {profile.phone}
              </span>
            )}
          </div>
          {profile.summary && (
            <>
              <Separator />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {profile.summary}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      {profile.skills.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="size-4" />
              Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Experience */}
      {profile.experience.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="size-4" />
              Experience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4 pl-6 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
              {profile.experience.map((exp, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-6 top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {String(exp.title || exp.role || "Position")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {String(exp.company || "")}
                      {exp.dates ? ` -- ${String(exp.dates)}` : ""}
                    </p>
                    {exp.description ? (
                      <p className="text-xs text-muted-foreground/80 mt-1">
                        {String(exp.description)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {profile.education.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="size-4" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.education.map((edu, i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-sm font-medium">
                  {String(edu.degree || edu.title || "Degree")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {String(edu.institution || edu.school || "")}
                  {edu.year ? ` -- ${String(edu.year)}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tools */}
      {profile.tools.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-4" />
              Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {profile.tools.map((tool) => (
                <Badge key={tool} variant="outline">
                  {tool}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domains */}
      {profile.domains.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4" />
              Domains
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {profile.domains.map((domain) => (
                <Badge
                  key={domain}
                  variant="secondary"
                  className="bg-primary/10 text-primary"
                >
                  {domain}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skill gaps display
// ---------------------------------------------------------------------------

function SkillGapsDisplay({ gaps }: { gaps: SkillGap[] }) {
  return (
    <motion.div
      custom={4}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
    >
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Skill Gaps Analysis
          </CardTitle>
          <CardDescription>
            Skills demanded by job postings that are missing from your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {gaps.map((gap) => {
              const badge = importanceBadge(gap.importance);
              return (
                <motion.div
                  key={gap.skill_name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant="outline"
                      className={badge.className}
                    >
                      {gap.importance}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {gap.skill_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BarChart3 className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {gap.demand_count} jobs
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Profile analysis display
// ---------------------------------------------------------------------------

function ProfileAnalysisDisplay({ analysis }: { analysis: ProfileAnalysis }) {
  const sections = [
    {
      title: "Strengths",
      items: analysis.strengths,
      color: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
      icon: "✓",
    },
    {
      title: "Weaknesses",
      items: analysis.weaknesses,
      color: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
      icon: "!",
    },
    {
      title: "Recommended Roles",
      items: analysis.recommended_roles,
      color: "bg-blue-500/15 text-blue-400 ring-blue-500/20",
      icon: "→",
    },
    {
      title: "Skill Gaps",
      items: analysis.skill_gaps,
      color: "bg-red-500/15 text-red-400 ring-red-500/20",
      icon: "△",
    },
  ];

  return (
    <motion.div
      custom={5}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Summary card */}
      {analysis.career_summary && (
        <Card className="glass-card border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="size-5" />
                AI Profile Analysis
              </CardTitle>
              <Badge variant="outline" className="capitalize">
                {analysis.experience_level}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {analysis.career_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Detail sections */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {section.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">None identified</p>
              ) : (
                <div className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`inline-flex items-center justify-center size-5 rounded text-xs font-bold ring-1 shrink-0 ${section.color}`}>
                        {section.icon}
                      </span>
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="glass-card rounded-xl p-4 space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-16 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CVPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([]);
  const [profileAnalysis, setProfileAnalysis] = useState<ProfileAnalysis | null>(null);

  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [scoringAll, setScoringAll] = useState(false);
  const [analyzingGaps, setAnalyzingGaps] = useState(false);
  const [analyzingProfile, setAnalyzingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;

  // Load existing profiles on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getProfiles();
        if (!cancelled) {
          setProfiles(data);
          if (data.length > 0) {
            setSelectedProfileId(data[0].id);
          }
        }
      } catch {
        // Silently fail - page will show empty state
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Delete handler
  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (selectedProfileId === id) {
        const remaining = profiles.filter((p) => p.id !== id);
        setSelectedProfileId(remaining.length > 0 ? remaining[0].id : null);
      }
      setSkillGaps([]);
      setProfileAnalysis(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, [selectedProfileId, profiles]);

  // Upload handler
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { profile, warning } = await uploadCV(file);
      setProfiles((prev) => [profile, ...prev]);
      setSelectedProfileId(profile.id);
      if (warning) {
        setError(`CV saved but: ${warning}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  // Score all jobs
  const handleScoreAll = useCallback(async () => {
    if (!selectedProfileId) return;
    setScoringAll(true);
    setError(null);
    try {
      await scoreJobs(selectedProfileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoringAll(false);
    }
  }, [selectedProfileId]);

  // Analyze skill gaps
  const handleAnalyzeGaps = useCallback(async () => {
    if (!selectedProfileId) return;
    setAnalyzingGaps(true);
    setError(null);
    try {
      const gaps = await analyzeSkillGaps(selectedProfileId);
      setSkillGaps(gaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzingGaps(false);
    }
  }, [selectedProfileId]);

  // Analyze profile with AI
  const handleAnalyzeProfile = useCallback(async () => {
    if (!selectedProfileId) return;
    setAnalyzingProfile(true);
    setError(null);
    setProfileAnalysis(null);
    try {
      const result = await analyzeProfile(selectedProfileId);
      setProfileAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile analysis failed");
    } finally {
      setAnalyzingProfile(false);
    }
  }, [selectedProfileId]);

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">CV Profile</h1>
        <p className="text-muted-foreground mt-1">
          Upload and manage your resume to enable AI-powered job matching
        </p>
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

      {/* Upload zone */}
      <UploadZone onUpload={handleUpload} uploading={uploading} />

      {/* Profile selector */}
      {loadingProfiles ? (
        <ProfileSkeleton />
      ) : (
        <>
          <ProfileSelector
            profiles={profiles}
            selectedId={selectedProfileId}
            onSelect={setSelectedProfileId}
            onDelete={handleDelete}
          />

          {/* Profile detail */}
          <AnimatePresence mode="wait">
            {selectedProfile && (
              <ProfileDetail key={selectedProfile.id} profile={selectedProfile} />
            )}
          </AnimatePresence>

          {/* Actions */}
          {selectedProfile && (
            <motion.div
              custom={3}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                  <CardDescription>
                    Run AI-powered analysis on your profile
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleAnalyzeProfile}
                    disabled={analyzingProfile}
                  >
                    {analyzingProfile ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-4 mr-1.5" />
                    )}
                    {analyzingProfile ? "Analyzing..." : "AI Profile Analysis"}
                  </Button>
                  <Button
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      // Build search query from profile skills
                      const skills = selectedProfile?.skills?.slice(0, 3).join(" ") || "";
                      const domains = selectedProfile?.domains?.[0] || "";
                      const q = `${domains} ${skills}`.trim() || "software engineer";
                      router.push(`/jobs?q=${encodeURIComponent(q)}`);
                    }}
                  >
                    <Search className="size-4 mr-1.5" />
                    Find Matching Jobs
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* AI Profile Analysis results */}
          <AnimatePresence>
            {profileAnalysis && <ProfileAnalysisDisplay analysis={profileAnalysis} />}
          </AnimatePresence>

          {/* Skill gaps */}
          <AnimatePresence>
            {skillGaps.length > 0 && <SkillGapsDisplay gaps={skillGaps} />}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
