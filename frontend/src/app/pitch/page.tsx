"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Lightbulb,
  Monitor,
  Globe,
  Zap,
  Cpu,
  DollarSign,
  Map,
  Rocket,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Kanban,
  Brain,
  FileText,
  Search,
  Mail,
  Clock,
  Users,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Slide {
  icon: LucideIcon;
  title: string;
  content: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 1400, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) {
      setValue(0);
      return;
    }
    let raf: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - t0) / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  value,
  suffix,
  label,
  active,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  active: boolean;
  delay: number;
}) {
  const count = useCountUp(value, 1400, active);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card rounded-xl p-5 text-center"
    >
      <p className="text-3xl font-bold text-primary sm:text-4xl">
        {count}
        {suffix}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Feature card
// ---------------------------------------------------------------------------

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card rounded-xl p-5"
    >
      <Icon className="mb-3 h-7 w-7 text-primary" />
      <h4 className="mb-1 font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Bullet list with stagger
// ---------------------------------------------------------------------------

function BulletList({
  items,
  baseDelay = 0.3,
}: {
  items: { icon?: LucideIcon; text: string }[];
  baseDelay?: number;
}) {
  return (
    <ul className="mt-6 space-y-4 text-left">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: baseDelay + i * 0.1, duration: 0.4 }}
            className="flex items-start gap-3 text-base text-foreground/90 sm:text-lg"
          >
            {Icon ? (
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            ) : (
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            )}
            <span>{item.text}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Tech badge
// ---------------------------------------------------------------------------

function TechBadge({ label, delay }: { label: string; delay: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="glass-card inline-block rounded-full px-4 py-1.5 text-sm font-medium text-foreground"
    >
      {label}
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Timeline item
// ---------------------------------------------------------------------------

function TimelineItem({
  phase,
  period,
  items,
  done,
  delay,
}: {
  phase: string;
  period: string;
  items: string[];
  done?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="relative border-l-2 border-primary/40 pl-6"
    >
      <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
      <p className="text-sm font-medium text-primary">{period}</p>
      <h4 className="mt-1 text-lg font-semibold">
        {phase}
        {done && (
          <CheckCircle2 className="ml-2 inline h-5 w-5 text-green-400" />
        )}
      </h4>
      <ul className="mt-2 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Revenue bar
// ---------------------------------------------------------------------------

function RevenueBar({
  label,
  width,
  amount,
  delay,
}: {
  label: string;
  width: string;
  amount: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.4 }}
      className="space-y-1"
    >
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{amount}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500"
        />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Pricing card
// ---------------------------------------------------------------------------

function PricingCard({
  tier,
  price,
  features,
  highlight,
  delay,
}: {
  tier: string;
  price: string;
  features: string[];
  highlight?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`glass-card rounded-xl p-5 ${highlight ? "ring-2 ring-primary" : ""}`}
    >
      <h4 className="text-lg font-semibold">{tier}</h4>
      <p className="mt-1 text-2xl font-bold text-primary">{price}</p>
      <ul className="mt-3 space-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Slides data
// ---------------------------------------------------------------------------

function useSlides(currentSlide: number): Slide[] {
  return [
    // 0 -- Problem
    {
      icon: AlertTriangle,
      title: "Job Search is Broken",
      content: (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <StatCard value={78} suffix="%" label="of applications get zero response" active={currentSlide === 0} delay={0.3} />
            <StatCard value={100} suffix="+" label="applications per average job seeker" active={currentSlide === 0} delay={0.4} />
          </div>
          <BulletList
            baseDelay={0.5}
            items={[
              { text: "No data-driven guidance on where to focus effort" },
              { text: "Manual tracking in spreadsheets and sticky notes" },
              { text: "Recruiters overwhelmed, candidates invisible" },
            ]}
          />
        </>
      ),
    },
    // 1 -- Solution
    {
      icon: Lightbulb,
      title: "AI Job Operating System",
      content: (
        <BulletList
          items={[
            { icon: Search, text: "AI-powered job matching & scoring across platforms" },
            { icon: Globe, text: "Automated job discovery from Indeed, LinkedIn, Google & hidden sources" },
            { icon: Kanban, text: "Smart application pipeline management with status tracking" },
            { icon: Mail, text: "AI-generated outreach, follow-ups & cover letters" },
            { icon: Brain, text: "Personalized AI coaching & rejection analysis" },
          ]}
        />
      ),
    },
    // 2 -- Product Demo
    {
      icon: Monitor,
      title: "See It In Action",
      content: (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <FeatureCard icon={BarChart3} title="Real-time Analytics" description="Dashboard with conversion rates, funnel analysis, and application trends" delay={0.3} />
          <FeatureCard icon={Kanban} title="Kanban Pipeline" description="Drag-and-drop tracking from saved to offered with status management" delay={0.4} />
          <FeatureCard icon={Brain} title="AI Coach" description="Daily personalized insights, strategy recommendations, and skill gap analysis" delay={0.5} />
          <FeatureCard icon={FileText} title="One-click Prep" description="AI-generated resumes, cover letters, and application answers tailored per job" delay={0.6} />
        </div>
      ),
    },
    // 3 -- Market
    {
      icon: Globe,
      title: "Massive Market",
      content: (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value={200} suffix="M+" label="active job seekers globally" active={currentSlide === 3} delay={0.3} />
            <StatCard value={5} suffix=".4B" label="recruitment tech market (2024)" active={currentSlide === 3} delay={0.4} />
            <StatCard value={8} suffix=".3%" label="CAGR growth rate" active={currentSlide === 3} delay={0.5} />
            <StatCard value={73} suffix="%" label="want AI assistance" active={currentSlide === 3} delay={0.6} />
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center text-lg text-muted-foreground"
          >
            The intersection of AI and career services is the fastest-growing segment in HR tech.
          </motion.p>
        </>
      ),
    },
    // 4 -- UVP
    {
      icon: Zap,
      title: "Not Just Another Job Board",
      content: (
        <BulletList
          items={[
            { icon: Brain, text: "AI Decision Engine -- not just listings, but actionable intelligence" },
            { icon: Globe, text: "Multi-source intelligence from Indeed, LinkedIn, Google & hidden jobs" },
            { icon: ShieldCheck, text: "Verified recruiter contacts with extraction & validation" },
            { icon: TrendingUp, text: "Profile evolution tracking -- see your growth over time" },
            { icon: AlertTriangle, text: "Rejection analysis & learning -- turn setbacks into strategy" },
          ]}
        />
      ),
    },
    // 5 -- Technology
    {
      icon: Cpu,
      title: "Built on Modern AI",
      content: (
        <>
          <BulletList
            items={[
              { icon: Cpu, text: "Google Gemini AI for intelligent matching & content generation" },
              { icon: Globe, text: "Multi-source web scraping engine with rate limiting" },
              { icon: BarChart3, text: "Real-time analytics pipeline with caching layer" },
              { icon: TrendingUp, text: "Profile evolution algorithms tracking skill growth" },
              { icon: Clock, text: "Smart follow-up timing engine based on application patterns" },
            ]}
          />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {["Python", "FastAPI", "Next.js", "React 19", "Gemini AI", "SQLite"].map(
              (tech, i) => (
                <TechBadge key={tech} label={tech} delay={0.7 + i * 0.08} />
              )
            )}
          </div>
        </>
      ),
    },
    // 6 -- Business Model
    {
      icon: DollarSign,
      title: "Freemium SaaS",
      content: (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <PricingCard
              tier="Free"
              price="$0"
              features={["20 jobs/month", "Basic matching", "Manual tracking"]}
              delay={0.3}
            />
            <PricingCard
              tier="Pro"
              price="$19/mo"
              features={["Unlimited jobs", "AI Coach", "Outreach generation", "Analytics"]}
              highlight
              delay={0.4}
            />
            <PricingCard
              tier="Enterprise"
              price="$49/mo"
              features={["Team features", "API access", "Priority support", "Custom integrations"]}
              delay={0.5}
            />
          </div>
          <div className="mt-8 space-y-3">
            <RevenueBar label="Year 1" width="20%" amount="$240K ARR" delay={0.6} />
            <RevenueBar label="Year 2" width="50%" amount="$1.2M ARR" delay={0.7} />
            <RevenueBar label="Year 3" width="100%" amount="$5M ARR" delay={0.8} />
          </div>
        </>
      ),
    },
    // 7 -- Roadmap
    {
      icon: Map,
      title: "The Path Forward",
      content: (
        <div className="mt-8 space-y-8">
          <TimelineItem
            phase="Phase 1 -- MVP"
            period="Q1 - Q2 2025"
            items={["Core matching engine", "Job discovery & pipeline", "Basic analytics & AI scoring"]}
            done
            delay={0.3}
          />
          <TimelineItem
            phase="Phase 2 -- Intelligence"
            period="Q3 - Q4 2025"
            items={["AI Coach & strategy suite", "Multi-agent system", "Mobile app", "Recruiter verification"]}
            delay={0.5}
          />
          <TimelineItem
            phase="Phase 3 -- Platform"
            period="2026"
            items={["Enterprise features", "Public API platform", "Recruiter marketplace", "International expansion"]}
            delay={0.7}
          />
        </div>
      ),
    },
    // 8 -- Vision
    {
      icon: Rocket,
      title: "The Future of Career Intelligence",
      content: (
        <div className="mt-8 flex flex-col items-center text-center">
          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400 bg-clip-text text-2xl font-bold leading-relaxed text-transparent sm:text-3xl md:text-4xl"
          >
            &ldquo;Every professional deserves
            <br />
            an AI career advisor.&rdquo;
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 space-y-2"
          >
            <div className="flex items-center justify-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-muted-foreground">Founding Team</span>
            </div>
            <div className="glass-card mx-auto flex max-w-md items-center gap-4 rounded-xl p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Your Name Here</p>
                <p className="text-sm text-muted-foreground">
                  Founder & CEO
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-10"
          >
            <p className="text-lg font-semibold text-foreground">
              Let&apos;s build the future together.
            </p>
            <p className="mt-1 text-muted-foreground">
              contact@aijobhunter.com
            </p>
          </motion.div>
        </div>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Slide transition variants
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PitchPage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const slides = useSlides(currentSlide);
  const totalSlides = slides.length;

  const goTo = useCallback(
    (index: number, dir?: number) => {
      if (index < 0 || index >= totalSlides) return;
      setDirection(dir ?? (index > currentSlide ? 1 : -1));
      setCurrentSlide(index);
    },
    [currentSlide, totalSlides]
  );

  const next = useCallback(() => goTo(currentSlide + 1, 1), [currentSlide, goTo]);
  const prev = useCallback(() => goTo(currentSlide - 1, -1), [currentSlide, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        router.push("/");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [next, prev, router]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 60) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  const slide = slides[currentSlide];
  const SlideIcon = slide.icon;

  return (
    <div
      className="gradient-bg fixed inset-0 z-50 flex flex-col overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide counter */}
      <div className="absolute right-4 top-4 z-10 text-sm text-muted-foreground sm:right-8 sm:top-6">
        {currentSlide + 1} / {totalSlides}
      </div>

      {/* Slide area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 sm:px-8">
        {/* Background icon */}
        <SlideIcon className="pointer-events-none absolute h-48 w-48 text-foreground opacity-[0.03] sm:h-64 sm:w-64" />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="mx-auto w-full max-w-4xl"
          >
            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-center text-3xl font-bold text-transparent sm:text-4xl md:text-5xl"
            >
              {slide.title}
            </motion.h2>

            {/* Content */}
            <div className="mx-auto mt-2 max-w-3xl">{slide.content}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation bar */}
      <div className="relative shrink-0 pb-4 pt-2">
        {/* Progress bar */}
        <div className="absolute left-0 right-0 top-0 h-1 bg-muted/30">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-violet-500"
            initial={false}
            animate={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        </div>

        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 pt-3 sm:px-8">
          {/* Prev button */}
          <button
            onClick={prev}
            disabled={currentSlide === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-glass-border text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Dot indicators */}
          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === currentSlide
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Next button */}
          <button
            onClick={next}
            disabled={currentSlide === totalSlides - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-glass-border text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* ESC hint */}
        <p className="mt-2 text-center text-xs text-muted-foreground/50">
          Press ESC to exit
        </p>
      </div>
    </div>
  );
}
