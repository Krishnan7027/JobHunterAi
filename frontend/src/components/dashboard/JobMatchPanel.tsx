"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Star, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/api";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

export function JobMatchPanel({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const scoredJobs = jobs.filter((j) => j.match_score !== null);

  return (
    <motion.div variants={cardVariants}>
      <Card className="glass-card border-0 h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="size-4 text-primary" />
            <CardTitle>Top Matches</CardTitle>
          </div>
          <CardDescription>Highest scoring jobs for your profile</CardDescription>
        </CardHeader>
        <CardContent>
          {scoredJobs.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                No scored jobs yet. Upload a CV and score your jobs.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/jobs")}
              >
                Go to Jobs
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {scoredJobs.slice(0, 5).map((job, i) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer group"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20">
                    {Math.round(job.match_score || 0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{job.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate">
                        {job.company}
                      </p>
                      {job.platform && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">
                          {job.platform}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${job.match_score || 0}%` }}
                        transition={{
                          delay: 0.5 + i * 0.15,
                          duration: 0.6,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                    <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
