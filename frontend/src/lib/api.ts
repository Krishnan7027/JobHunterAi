import { getToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

/** Like request() but returns partial data on 503 instead of throwing. */
async function requestGraceful<T>(path: string, options?: RequestInit): Promise<{ data: T | null; warning?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...options?.headers,
    },
  });
  if (res.status === 503) {
    const error = await res.json().catch(() => ({ detail: "Service temporarily unavailable" }));
    return { data: null, warning: error.detail || "AI service temporarily unavailable" };
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return { data: await res.json() };
}

// --- Types ---
export interface Profile {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  summary: string | null;
  skills: string[];
  experience: Record<string, unknown>[];
  education: Record<string, unknown>[];
  tools: string[];
  domains: string[];
  file_name: string | null;
  created_at: string;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  requirements: string[];
  salary_range: string | null;
  apply_url: string;
  platform: string;
  source_url: string | null;
  is_easy_apply: boolean;
  is_hidden_job: boolean;
  posted_date: string | null;
  match_score: number | null;
  skill_match_pct: number | null;
  experience_match: number | null;
  priority_score: number | null;
  status: string;
  applied_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Contact {
  id: number;
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  profile_url: string | null;
  source_url: string;
  extraction_type: string;
  verified: boolean;
  job_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface OutreachMessage {
  id: number;
  contact_id: number;
  message_type: string;
  subject: string | null;
  body: string;
  sent: boolean;
  created_at: string;
}

export interface DashboardStats {
  total_jobs: number;
  applied_count: number;
  saved_count: number;
  interview_count: number;
  verified_contacts: number;
  avg_match_score: number;
  top_skills_demanded: Record<string, unknown>[];
}

export interface MatchResult {
  job_id: number;
  match_score: number;
  skill_match_pct: number;
  experience_match: number;
  priority_score: number;
  matched_skills: string[];
  missing_skills: string[];
}

export interface SmartApplyResult {
  tailored_resume: string;
  cover_letter: string;
  is_easy_apply: boolean;
  application_answers: Record<string, unknown>;
  recommended_channel: string;
}

export interface SkillGap {
  skill_name: string;
  demand_count: number;
  importance: string;
  learning_resources: Record<string, unknown>[];
}

// --- Auth ---
export async function registerUser(username: string, email: string, password: string) {
  return request<{ access_token: string; user_id: number; username: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function loginUser(username: string, password: string) {
  return request<{ access_token: string; user_id: number; username: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// --- CV ---
export async function uploadCV(file: File): Promise<{ profile: Profile; warning?: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/cv/upload`, {
    method: "POST",
    body: form,
    headers: authHeaders(),
  });
  if (res.status === 503) {
    // CV saved but AI parsing failed (quota exceeded) — return partial data with warning
    const error = await res.json().catch(() => ({ detail: "AI parsing failed" }));
    // Fetch the latest profile since CV was saved
    const profiles = await getProfiles();
    if (profiles.length > 0) {
      return { profile: profiles[0], warning: error.detail };
    }
    throw new Error(error.detail);
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }
  const profile: Profile = await res.json();
  return { profile };
}

export async function getProfiles(): Promise<Profile[]> {
  return request("/cv/profiles");
}

export async function getProfile(id: number): Promise<Profile> {
  return request(`/cv/profiles/${id}`);
}

export async function deleteProfile(id: number): Promise<void> {
  await request(`/cv/profiles/${id}`, { method: "DELETE" });
}

// --- Jobs ---
export interface FetchJobsResult {
  jobs: Job[];
  source: string;
  total: number;
  query: string;
  location: string | null;
}

export async function fetchJobs(query: string, location?: string, sources?: string[], signal?: AbortSignal, maxResults?: number): Promise<FetchJobsResult> {
  return request("/jobs/fetch", {
    method: "POST",
    body: JSON.stringify({ query, location, sources: sources || ["linkedin"], max_results: maxResults || 20 }),
    signal,
  });
}

export interface RankResult {
  ranked: number;
  jobs: Array<{
    id: number;
    title: string;
    company: string;
    score: number;
    relevance: string;
    matched_skills: string[];
    missing_skills: string[];
    reason: string;
  }>;
  error?: string;
}

export async function rankJobs(): Promise<RankResult> {
  return request("/jobs/rank", { method: "POST" });
}

export async function getJobs(params?: {
  status?: string;
  platform?: string;
  min_score?: number;
  sort_by?: string;
  limit?: number;
}): Promise<Job[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.min_score) searchParams.set("min_score", String(params.min_score));
  if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  return request(`/jobs/?${searchParams.toString()}`);
}

export async function getJob(id: number): Promise<Job> {
  return request(`/jobs/${id}`);
}

export async function updateJobStatus(id: number, status: string, notes?: string): Promise<Job> {
  return request(`/jobs/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

export interface ApplyResult {
  status: string;
  apply_url: string;
  job_title?: string;
  company?: string;
  message: string;
}

export async function applyToJob(jobId: number): Promise<ApplyResult> {
  return request("/jobs/apply", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId }),
  });
}

// --- Matching ---
export async function scoreJobs(profileId?: number, jobIds?: number[]): Promise<MatchResult[]> {
  return request("/matching/score", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId || null, job_ids: jobIds }),
  });
}

export async function smartApply(jobId: number, profileId: number): Promise<SmartApplyResult> {
  return request("/matching/smart-apply", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, profile_id: profileId }),
  });
}

// --- Profile Analysis ---
export interface ProfileAnalysis {
  strengths: string[];
  weaknesses: string[];
  recommended_roles: string[];
  skill_gaps: string[];
  career_summary: string;
  experience_level: string;
}

export async function analyzeProfile(profileId: number): Promise<ProfileAnalysis> {
  return request("/ai/analyze-profile", {
    method: "POST",
    body: JSON.stringify({ profile_id: profileId }),
  });
}

// --- Contacts ---
export interface ExtractContactsResult {
  contacts: Contact[];
  total: number;
  source_url: string;
  page_fetched: boolean;
  message: string | null;
}

export async function extractContacts(jobId: number): Promise<ExtractContactsResult> {
  return request(`/contacts/extract/${jobId}`, { method: "POST" });
}

export async function getContacts(params?: { verified?: boolean; company?: string }): Promise<Contact[]> {
  const searchParams = new URLSearchParams();
  if (params?.verified !== undefined) searchParams.set("verified", String(params.verified));
  if (params?.company) searchParams.set("company", params.company);
  return request(`/contacts/?${searchParams.toString()}`);
}

// --- Outreach ---
export async function generateOutreach(contactId: number, messageType: string, profileId?: number): Promise<OutreachMessage> {
  return request("/outreach/generate", {
    method: "POST",
    body: JSON.stringify({ contact_id: contactId, message_type: messageType, profile_id: profileId }),
  });
}

export async function getOutreachMessages(contactId?: number): Promise<OutreachMessage[]> {
  const params = contactId ? `?contact_id=${contactId}` : "";
  return request(`/outreach/messages${params}`);
}

// --- Dashboard ---
export async function getDashboardStats(): Promise<DashboardStats> {
  return request("/dashboard/stats");
}

export async function getRecentJobs(limit: number = 5): Promise<Job[]> {
  return request(`/jobs/?sort_by=created_at&limit=${limit}`);
}

export async function getTopMatches(limit: number = 5): Promise<Job[]> {
  return request(`/jobs/?sort_by=match_score&limit=${limit}`);
}

// --- Advanced ---
export async function analyzeSkillGaps(profileId: number): Promise<SkillGap[]> {
  return request(`/advanced/skill-gaps/${profileId}`, { method: "POST" });
}

export async function predictInterviewQuestions(jobId: number, profileId?: number): Promise<Record<string, string[]>> {
  const params = profileId ? `?profile_id=${profileId}` : "";
  return request(`/advanced/interview-questions/${jobId}${params}`, { method: "POST" });
}

export async function findHiddenJobs(query: string, location?: string): Promise<{ found: number; jobs: Job[] }> {
  const params = new URLSearchParams({ query });
  if (location) params.set("location", location);
  return request(`/advanced/hidden-jobs?${params.toString()}`);
}

export async function getDailyDigest(profileId?: number): Promise<Record<string, unknown>> {
  const params = profileId ? `?profile_id=${profileId}` : "";
  return request(`/advanced/daily-digest${params}`);
}

// --- Analytics ---
export interface Analytics {
  applications: number;
  interviews: number;
  offers: number;
  rejected: number;
  saved: number;
  conversion_rate: number;
  offer_rate: number;
  total_jobs: number;
  avg_match_score: number;
  pipeline: Record<string, number>;
}

export async function getAnalytics(): Promise<Analytics> {
  return request("/dashboard/analytics");
}

// --- Daily Actions ---
export interface ActionItem {
  type: string;
  title: string;
  description: string;
  job_id?: number;
  job_title?: string;
  company?: string;
  priority: string;
}

export interface DailyActions {
  date: string;
  actions: ActionItem[];
  top_jobs: Array<{ id: number; title: string; company: string; match_score: number | null; status: string }>;
  followup_needed: Array<{ job_id: number; title: string; company: string; days_since_applied: number }>;
  total_actions: number;
}

export async function getDailyActions(): Promise<DailyActions> {
  return request("/dashboard/daily-actions");
}

// --- Prepare Application (Auto-Apply Assistant) ---
export interface PrepareApplicationResult {
  tailored_resume: string;
  cover_letter: string;
  answers: Array<{ question: string; answer: string }>;
  is_easy_apply: boolean;
  apply_url: string;
  job_title: string;
  company: string;
}

export async function prepareApplication(
  jobId: number,
  profileId?: number,
  questions?: string[],
): Promise<PrepareApplicationResult> {
  return request("/ai/prepare-application", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      profile_id: profileId || null,
      questions: questions || [],
    }),
  });
}

// --- Generate Outreach Bundle ---
export interface OutreachBundle {
  cold_email: { subject: string; body: string } | null;
  linkedin_message: string;
  followup_email: { subject: string; body: string } | null;
}

export async function generateOutreachBundle(
  jobId: number,
  profileId?: number,
  contactId?: number,
): Promise<OutreachBundle> {
  return request("/ai/generate-outreach", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      profile_id: profileId || null,
      contact_id: contactId || null,
    }),
  });
}

// --- Auto Follow-up ---
export interface AutoFollowup {
  subject: string;
  body: string;
  job_title: string;
  company: string;
  days_waiting: number;
}

export async function generateAutoFollowup(
  jobId: number,
  profileId?: number,
): Promise<AutoFollowup> {
  return request("/ai/generate-auto-followup", {
    method: "POST",
    body: JSON.stringify({
      job_id: jobId,
      profile_id: profileId || null,
    }),
  });
}

// --- Pipeline helpers ---
export async function getJobsByStatus(status: string): Promise<Job[]> {
  return getJobs({ status });
}

export async function getAllPipelineJobs(): Promise<Record<string, Job[]>> {
  const allJobs = await getJobs({ limit: 200 });
  const pipeline: Record<string, Job[]> = {
    saved: [],
    applied: [],
    interview: [],
    offered: [],
    rejected: [],
  };
  for (const job of allJobs) {
    const status = job.status || "not_applied";
    if (status in pipeline) {
      pipeline[status].push(job);
    } else if (status === "not_applied") {
      // not_applied jobs don't appear in pipeline unless saved
    }
  }
  return pipeline;
}

// --- Intelligence: AI Coach ---
export interface CoachInsight {
  insight: string;
  recommendation: string;
  category: string;
  priority: string;
}

export interface CoachData {
  insights: CoachInsight[];
  daily_summary: string;
  streak_days: number;
}

export async function getCoachInsights(): Promise<CoachData> {
  return request("/intelligence/coach");
}

// --- Intelligence: Strategy ---
export interface StrategyJob {
  job_id: number;
  title: string;
  company: string;
  score: number;
  reason: string;
}

export interface StrategyData {
  apply: StrategyJob[];
  skip: StrategyJob[];
  summary: string;
}

export async function getStrategy(): Promise<StrategyData> {
  return request("/intelligence/strategy");
}

// --- Intelligence: Interview Probability ---
export interface InterviewPrediction {
  job_id: number;
  title: string;
  company: string;
  interview_probability: number;
  factors: string[];
  recommendation: string;
}

export async function predictProbability(jobIds?: number[]): Promise<{ predictions: InterviewPrediction[] }> {
  return request("/intelligence/probability", {
    method: "POST",
    body: JSON.stringify(jobIds || null),
  });
}

// --- Intelligence: Rejection Analysis ---
export interface RejectionData {
  job_id: number;
  title: string;
  company: string;
  skill_gaps: string[];
  experience_mismatch: string;
  possible_reasons: string[];
  improvement_actions: string[];
}

export async function analyzeRejection(jobId: number): Promise<RejectionData> {
  return request(`/intelligence/rejection/${jobId}`);
}

// --- Intelligence: Follow-up Timing ---
export interface FollowupTimingItem {
  job_id: number;
  title: string;
  company: string;
  days_since_applied: number;
  recommended_action: string;
  optimal_day: string;
  urgency: string;
  message_tone: string;
}

export async function getFollowupTiming(): Promise<{ followups: FollowupTimingItem[] }> {
  return request("/intelligence/followup-timing");
}

// --- Intelligence: Evolution ---
export interface EvolutionSnapshot {
  id: number;
  user_id: number;
  skills_count: number;
  avg_match_score: number;
  total_applications: number;
  interviews: number;
  offers: number;
  conversion_rate: number;
  top_skills: string[];
  created_at: string;
}

export interface EvolutionData {
  snapshots: EvolutionSnapshot[];
  skill_growth: Record<string, unknown>;
  score_trend: Array<{ date: string; score: number; apps: number }>;
  application_trend: Array<{ date: string; total: number; interviews: number; offers: number }>;
  summary: string;
}

export async function getEvolution(): Promise<EvolutionData> {
  return request("/intelligence/evolution");
}

export async function takeEvolutionSnapshot(): Promise<{ id: number; created_at: string }> {
  return request("/intelligence/evolution/snapshot", { method: "POST" });
}

// --- Agent Plan ---
export interface AgentStepResult {
  name: string;
  status: string;
  duration_ms: number;
  error: string | null;
}

export interface AgentPlan {
  status: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  agents: AgentStepResult[];
  plan: {
    jobs_found: number;
    jobs_scored: number;
    jobs_to_apply: Array<{ job_id: number; title: string; company: string; score: number; reason: string }>;
    jobs_to_skip: Array<{ job_id: number; title: string; company: string; score: number; reason: string }>;
    messages: Array<{ job_id: number; title: string; company: string; cold_email?: { subject: string; body: string }; linkedin_message?: string }>;
    followups: Array<{ job_id: number; title: string; company: string; days_since_applied: number; recommended_action: string; urgency: string }>;
    analytics: Record<string, unknown>;
  };
}

export async function executeAgentPlan(query?: string, location?: string, skipFetch?: boolean): Promise<AgentPlan> {
  return request("/ai/agent-plan", {
    method: "POST",
    body: JSON.stringify({
      query: query || null,
      location: location || null,
      skip_fetch: skipFetch || false,
    }),
  });
}
