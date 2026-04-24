"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldOff,
  Mail,
  Phone,
  Link as LinkIcon,
  Search,
  MessageSquare,
  Send,
  Eye,
  Users,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getContacts, type Contact } from "@/lib/api";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
  exit: { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.2 } },
} as const;

function ContactCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
    </div>
  );
}

function TrustIndicator({ contact }: { contact: Contact }) {
  const isVerified = contact.verified;

  return (
    <div className="flex flex-col gap-2">
      {/* Primary trust badge */}
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
          isVerified
            ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
            : "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20"
        }`}
      >
        {isVerified ? (
          <ShieldCheck className="size-4 shrink-0" />
        ) : (
          <ShieldOff className="size-4 shrink-0" />
        )}
        <span>{isVerified ? "Verified Contact" : "Unverified Contact"}</span>
      </div>

      {/* Source indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5 shrink-0" />
        <span>Source: {formatExtractionType(contact.extraction_type)}</span>
        {contact.source_url && (
          <a
            href={contact.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            View
          </a>
        )}
      </div>
    </div>
  );
}

function formatExtractionType(type: string): string {
  const map: Record<string, string> = {
    careers_page: "Company Careers Page",
    job_posting: "Job Posting",
    linkedin: "LinkedIn Profile",
    company_website: "Company Website",
    manual: "Manual Entry",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ContactCard({ contact }: { contact: Contact }) {
  const isVerified = contact.verified;

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="glass-card rounded-xl p-5 flex flex-col gap-4 hover:ring-1 hover:ring-primary/20 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground truncate">
            {contact.name}
          </h3>
          {contact.role && (
            <p className="text-sm text-muted-foreground truncate">{contact.role}</p>
          )}
          {contact.company && (
            <p className="text-sm text-primary/80 font-medium truncate">
              {contact.company}
            </p>
          )}
        </div>
        <Badge
          variant={isVerified ? "default" : "secondary"}
          className={
            isVerified
              ? "bg-emerald-500/15 text-emerald-400 shrink-0"
              : "bg-zinc-500/15 text-zinc-400 shrink-0"
          }
        >
          {isVerified ? (
            <>
              <ShieldCheck className="size-3 mr-1" />
              Verified
            </>
          ) : (
            <>
              <ShieldOff className="size-3 mr-1" />
              Unverified
            </>
          )}
        </Badge>
      </div>

      {/* Trust indicator */}
      <TrustIndicator contact={contact} />

      <Separator />

      {/* Contact details */}
      <div className="space-y-2 text-sm">
        {isVerified && contact.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4 text-emerald-400" />
            <a
              href={`mailto:${contact.email}`}
              className="hover:text-foreground transition-colors truncate"
            >
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4 text-blue-400" />
            <a
              href={`tel:${contact.phone}`}
              className="hover:text-foreground transition-colors"
            >
              {contact.phone}
            </a>
          </div>
        )}
        {contact.profile_url && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <LinkIcon className="size-4 text-violet-400" />
            <a
              href={contact.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors truncate"
            >
              Profile
            </a>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {isVerified && (
          <Button variant="default" size="sm" className="gap-1.5">
            <Mail className="size-3.5" />
            Generate Email
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageSquare className="size-3.5" />
          LinkedIn Message
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Eye className="size-3.5" />
          View Outreach
        </Button>
      </div>
    </motion.div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");
  const [companySearch, setCompanySearch] = useState("");

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { verified?: boolean; company?: string } = {};
      if (verifiedFilter !== "all") {
        params.verified = verifiedFilter === "verified";
      }
      if (companySearch.trim()) {
        params.company = companySearch.trim();
      }
      const data = await getContacts(params);
      setContacts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [verifiedFilter, companySearch]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchContacts();
    }, companySearch ? 400 : 0);
    return () => clearTimeout(debounce);
  }, [fetchContacts, companySearch]);

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground">
              Extracted contacts from job postings and company pages
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card rounded-xl p-4 flex flex-col sm:flex-row gap-3"
      >
        <Select
          value={verifiedFilter}
          onValueChange={(val) => { if (val) setVerifiedFilter(val as string); }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contacts</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by company..."
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl p-6 text-center text-destructive"
        >
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchContacts}>
            Retry
          </Button>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ContactCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && contacts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-xl p-12 text-center"
        >
          <Users className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No verified contacts yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Contacts are only stored when a real email or public profile URL is found
            in the job posting. Most job boards (Indeed, LinkedIn) hide recruiter info
            behind their apply buttons.
          </p>
          <div className="text-xs text-muted-foreground/70 max-w-md mx-auto space-y-1">
            <p>To find contacts, try:</p>
            <ul className="list-disc list-inside text-left">
              <li>Extract from company career pages (more likely to have emails)</li>
              <li>Look for jobs with direct company postings</li>
              <li>Add contacts manually with verified source URLs</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* Contact cards */}
      {!loading && !error && contacts.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${verifiedFilter}-${companySearch}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {contacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
