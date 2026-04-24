"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  MessageSquare,
  Copy,
  Check,
  Send,
  Clock,
  Sparkles,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getOutreachMessages,
  getContacts,
  getProfiles,
  generateOutreach,
  type OutreachMessage,
  type Contact,
  type Profile,
} from "@/lib/api";

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
} as const;

function MessageTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    email: {
      label: "Email",
      className: "bg-blue-500/15 text-blue-400",
      icon: <Mail className="size-3" />,
    },
    linkedin: {
      label: "LinkedIn",
      className: "bg-violet-500/15 text-violet-400",
      icon: <MessageSquare className="size-3" />,
    },
    followup: {
      label: "Follow-up",
      className: "bg-amber-500/15 text-amber-400",
      icon: <RefreshCw className="size-3" />,
    },
  };

  const c = config[type] || {
    label: type,
    className: "bg-zinc-500/15 text-zinc-400",
    icon: <Mail className="size-3" />,
  };

  return (
    <Badge variant="secondary" className={c.className}>
      {c.icon}
      <span className="ml-1">{c.label}</span>
    </Badge>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-1.5"
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          Copy to Clipboard
        </>
      )}
    </Button>
  );
}

function MessageCard({ message }: { message: OutreachMessage }) {
  return (
    <motion.div variants={cardVariants} className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageTypeBadge type={message.message_type} />
          {message.sent ? (
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400">
              <Check className="size-3 mr-1" />
              Sent
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-zinc-500/15 text-zinc-400">
              <Clock className="size-3 mr-1" />
              Draft
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(message.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {message.subject && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Subject</p>
          <p className="text-sm font-medium">{message.subject}</p>
        </div>
      )}

      <Textarea
        readOnly
        value={message.body}
        className="min-h-32 text-sm bg-muted/30 resize-none cursor-default"
      />

      <div className="flex justify-end">
        <CopyButton text={message.body} />
      </div>
    </motion.div>
  );
}

function MessageSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="flex justify-end">
        <Skeleton className="h-8 w-36" />
      </div>
    </div>
  );
}

export default function OutreachPage() {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate form state
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedMessageType, setSelectedMessageType] = useState<string>("email");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<OutreachMessage | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [msgs, contactList, profileList] = await Promise.all([
        getOutreachMessages(),
        getContacts(),
        getProfiles(),
      ]);
      setMessages(msgs);
      setContacts(contactList);
      setProfiles(profileList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    if (!selectedContactId) return;
    setGenerating(true);
    setGenerateError(null);
    setGeneratedMessage(null);
    try {
      const profileId = selectedProfileId ? Number(selectedProfileId) : undefined;
      const msg = await generateOutreach(
        Number(selectedContactId),
        selectedMessageType,
        profileId
      );
      setGeneratedMessage(msg);
      // Refresh messages list
      const updatedMsgs = await getOutreachMessages();
      setMessages(updatedMsgs);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Failed to generate outreach"
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10">
            <Send className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Outreach</h1>
            <p className="text-sm text-muted-foreground">
              Generate and manage personalized outreach messages
            </p>
          </div>
        </div>
      </motion.div>

      {/* Generate new outreach */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass-card rounded-xl p-6 space-y-5"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Generate New Outreach</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contact</label>
            <Select
              value={selectedContactId}
              onValueChange={(val) => setSelectedContactId(val as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Message Type
            </label>
            <Select
              value={selectedMessageType}
              onValueChange={(val) => setSelectedMessageType(val as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="linkedin">LinkedIn Message</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Profile (optional)
            </label>
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
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!selectedContactId || generating}
          className="gap-1.5"
        >
          {generating ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate
            </>
          )}
        </Button>

        {generateError && (
          <p className="text-sm text-destructive">{generateError}</p>
        )}

        {/* Generated message preview */}
        <AnimatePresence>
          {generatedMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Separator className="my-2" />
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-emerald-400">
                    Message Generated
                  </p>
                  <CopyButton text={generatedMessage.body} />
                </div>
                {generatedMessage.subject && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Subject</p>
                    <p className="text-sm font-medium">{generatedMessage.subject}</p>
                  </div>
                )}
                <Textarea
                  readOnly
                  value={generatedMessage.body}
                  className="min-h-32 text-sm bg-muted/30 resize-none cursor-default"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl p-6 text-center text-destructive"
        >
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadData}>
            Retry
          </Button>
        </motion.div>
      )}

      {/* Messages list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Previous Messages</h2>

        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <MessageSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl p-12 text-center"
          >
            <Inbox className="size-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Generate your first outreach message using the form above. Messages are
              personalized based on the contact and your profile.
            </p>
          </motion.div>
        )}

        {!loading && !error && messages.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {messages.map((msg) => (
              <MessageCard key={msg.id} message={msg} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
