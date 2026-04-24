"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Mail,
  MessageSquare,
  Briefcase,
  TrendingUp,
  AlertTriangle,
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
import { executeAgentPlan, type AgentPlan } from "@/lib/api";
import { toast } from "sonner";

const AGENT_STEPS = [
  { name: "job_finder", label: "Finding Jobs", icon: Briefcase },
  { name: "job_scorer", label: "Scoring Jobs", icon: TrendingUp },
  { name: "strategy", label: "Building Strategy", icon: Bot },
  { name: "outreach", label: "Generating Outreach", icon: Mail },
  { name: "followup", label: "Checking Follow-ups", icon: Clock },
  { name: "analytics", label: "Analyzing Performance", icon: TrendingUp },
];

const statusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="size-3.5 text-emerald-400" />,
  failed: <XCircle className="size-3.5 text-red-400" />,
  skipped: <SkipForward className="size-3.5 text-amber-400" />,
};

const statusColor: Record<string, string> = {
  completed: "text-emerald-400",
  failed: "text-red-400",
  skipped: "text-amber-400",
};

export function AgentPlanButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentPlan | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate step progression while waiting for API
  useEffect(() => {
    if (loading) {
      setCurrentStep(0);
      setElapsed(0);
      setError(null);

      // Elapsed timer — tick every 100ms
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 100);
      }, 100);

      // Step progression — advance every ~3s with some randomness
      let step = 0;
      stepTimerRef.current = setInterval(() => {
        step++;
        if (step < AGENT_STEPS.length) {
          setCurrentStep(step);
        }
      }, 2500 + Math.random() * 1500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [loading]);

  const handleExecute = async () => {
    setLoading(true);
    setShowModal(true);
    setResult(null);
    setError(null);
    try {
      const plan = await executeAgentPlan(undefined, undefined, true);
      setResult(plan);
      setCurrentStep(AGENT_STEPS.length); // All done
      toast.success(`AI Plan complete in ${(plan.duration_ms / 1000).toFixed(1)}s`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Agent plan failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const progressPct = result
    ? 100
    : Math.min(((currentStep + 1) / AGENT_STEPS.length) * 100, 95);

  const completedCount = result
    ? result.agents.filter((a) => a.status === "completed").length
    : 0;
  const failedCount = result
    ? result.agents.filter((a) => a.status === "failed").length
    : 0;

  return (
    <>
      <Button
        onClick={handleExecute}
        disabled={loading}
        className="gap-2 bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90 text-white shadow-lg shadow-primary/20"
        size="sm"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Bot className="size-3.5" />
        )}
        {loading ? "Running..." : "Execute AI Plan"}
      </Button>

      {/* Progress + Results Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !loading && setShowModal(false)}
          >
            <motion.div
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="glass-card-strong border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="size-5 text-primary" />
                      <CardTitle>
                        {loading ? "Running AI Agents..." : error ? "Agent Plan Failed" : "AI Agent Plan Results"}
                      </CardTitle>
                    </div>
                    {!loading && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowModal(false)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    {loading
                      ? `Elapsed: ${(elapsed / 1000).toFixed(1)}s`
                      : result
                        ? `Completed in ${(result.duration_ms / 1000).toFixed(1)}s — ${completedCount} succeeded${failedCount > 0 ? `, ${failedCount} failed` : ""}`
                        : error || ""}
                  </CardDescription>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        error
                          ? "bg-red-400"
                          : result
                            ? "bg-emerald-400"
                            : "bg-primary"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${error ? 100 : progressPct}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                  {loading && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(progressPct)}% — Step {currentStep + 1} of {AGENT_STEPS.length}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Agent Pipeline Steps */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Agent Pipeline
                    </h3>
                    <div className="space-y-1.5">
                      {AGENT_STEPS.map((step, i) => {
                        const agentResult = result?.agents.find(
                          (a) => a.name === step.name
                        );
                        const isActive = loading && i === currentStep;
                        const isDone = loading
                          ? i < currentStep
                          : !!agentResult;
                        const isFuture = loading && i > currentStep;
                        const StepIcon = step.icon;

                        return (
                          <motion.div
                            key={step.name}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                              isActive
                                ? "bg-primary/10 ring-1 ring-primary/20"
                                : "bg-white/[0.03]"
                            } ${isFuture ? "opacity-40" : ""}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: isFuture ? 0.4 : 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            {/* Status indicator */}
                            {isActive ? (
                              <Loader2 className="size-3.5 text-primary animate-spin" />
                            ) : agentResult ? (
                              statusIcon[agentResult.status] || statusIcon.completed
                            ) : isDone ? (
                              <CheckCircle2 className="size-3.5 text-emerald-400" />
                            ) : (
                              <StepIcon className="size-3.5 text-muted-foreground" />
                            )}

                            <span
                              className={`text-sm font-medium flex-1 ${
                                isActive ? "text-primary" : ""
                              }`}
                            >
                              {step.label}
                            </span>

                            {/* Right side: status or spinner */}
                            {agentResult ? (
                              <>
                                <span
                                  className={`text-xs ${statusColor[agentResult.status] || ""}`}
                                >
                                  {agentResult.status}
                                </span>
                                <span className="text-[10px] text-muted-foreground min-w-[40px] text-right">
                                  {agentResult.duration_ms}ms
                                </span>
                              </>
                            ) : isActive ? (
                              <span className="text-xs text-primary animate-pulse">
                                running...
                              </span>
                            ) : isDone ? (
                              <span className="text-xs text-emerald-400">done</span>
                            ) : null}

                            {/* Error tooltip */}
                            {agentResult?.error && (
                              <span className="text-[10px] text-red-400 truncate max-w-[120px]" title={agentResult.error}>
                                {agentResult.error}
                              </span>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Error State */}
                  {error && !result && (
                    <div className="flex items-center gap-3 rounded-lg px-4 py-3 bg-red-400/10 ring-1 ring-red-400/20">
                      <AlertTriangle className="size-4 text-red-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-400">Execution Failed</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Results — only show after completion */}
                  {result && (
                    <>
                      {/* Jobs to Apply */}
                      {result.plan.jobs_to_apply.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Briefcase className="size-3" />
                            Recommended to Apply ({result.plan.jobs_to_apply.length})
                          </h3>
                          <div className="space-y-1.5">
                            {result.plan.jobs_to_apply.map((job, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 bg-emerald-400/5 ring-1 ring-emerald-400/10"
                              >
                                <Badge variant="secondary" className="text-emerald-400 text-xs">
                                  {job.score}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{job.title}</p>
                                  <p className="text-xs text-muted-foreground">{job.company}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outreach Messages */}
                      {result.plan.messages.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Mail className="size-3" />
                            Outreach Messages ({result.plan.messages.length})
                          </h3>
                          <div className="space-y-2">
                            {result.plan.messages.map((msg, i) => (
                              <div
                                key={i}
                                className="rounded-lg px-3 py-2 bg-white/[0.03] space-y-1"
                              >
                                <p className="text-sm font-medium">
                                  {msg.title} — {msg.company}
                                </p>
                                {msg.cold_email && (
                                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <Mail className="size-3 mt-0.5 text-blue-400" />
                                    <span className="truncate">{msg.cold_email.subject}</span>
                                  </div>
                                )}
                                {msg.linkedin_message && (
                                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <MessageSquare className="size-3 mt-0.5 text-violet-400" />
                                    <span className="line-clamp-1">{msg.linkedin_message}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-ups */}
                      {result.plan.followups.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Clock className="size-3" />
                            Follow-ups Needed ({result.plan.followups.length})
                          </h3>
                          <div className="space-y-1.5">
                            {result.plan.followups.map((fu, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 rounded-lg px-3 py-2 bg-white/[0.03]"
                              >
                                <Badge
                                  variant="outline"
                                  className={`text-xs border-0 ring-1 ${
                                    fu.urgency === "high"
                                      ? "text-red-400 ring-red-400/20"
                                      : "text-amber-400 ring-amber-400/20"
                                  }`}
                                >
                                  {fu.urgency}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">
                                    {fu.title} — {fu.company}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {fu.days_since_applied}d waiting — {fu.recommended_action}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary Stats */}
                      <div className="flex gap-3 flex-wrap">
                        <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center flex-1 min-w-[80px]">
                          <TrendingUp className="size-3.5 text-primary mx-auto mb-1" />
                          <p className="text-lg font-bold">{result.plan.jobs_found}</p>
                          <p className="text-[10px] text-muted-foreground">Jobs Found</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center flex-1 min-w-[80px]">
                          <Briefcase className="size-3.5 text-emerald-400 mx-auto mb-1" />
                          <p className="text-lg font-bold">{result.plan.jobs_scored}</p>
                          <p className="text-[10px] text-muted-foreground">Scored</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center flex-1 min-w-[80px]">
                          <Mail className="size-3.5 text-blue-400 mx-auto mb-1" />
                          <p className="text-lg font-bold">{result.plan.messages.length}</p>
                          <p className="text-[10px] text-muted-foreground">Messages</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center flex-1 min-w-[80px]">
                          <Clock className="size-3.5 text-amber-400 mx-auto mb-1" />
                          <p className="text-lg font-bold">{result.plan.followups.length}</p>
                          <p className="text-[10px] text-muted-foreground">Follow-ups</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
