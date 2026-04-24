"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Send,
  Sparkles,
  Menu,
  Crosshair,
  LogIn,
  LogOut,
  User,
  Kanban,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/cv", label: "CV Profile", icon: FileText },
  { href: "/evolution", label: "Evolution", icon: TrendingUp },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/advanced", label: "Advanced", icon: Sparkles },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="active-nav"
          className="absolute inset-0 rounded-lg bg-primary/20 ring-1 ring-primary/30"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
      <Icon className="relative z-10 size-4 shrink-0" />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          isActive={
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)
          }
          onClick={onNavigate}
        />
      ))}
    </nav>
  );
}

function SidebarLogo() {
  return (
    <div className="flex items-center gap-3 px-6 py-5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
        <Crosshair className="size-4 text-primary" />
      </div>
      <div>
        <h1 className="text-sm font-semibold tracking-tight">AI Job Hunter</h1>
        <p className="text-xs text-muted-foreground">Smart career assistant</p>
      </div>
    </div>
  );
}

function SidebarFooter() {
  const { user, isLoggedIn, logout } = useAuth();

  if (!isLoggedIn) {
    return (
      <div className="px-4 py-3">
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <LogIn className="size-4" />
          <span>Sign In</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex size-6 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/30">
          <User className="size-3 text-primary" />
        </div>
        <span className="text-xs font-medium truncate">{user?.username}</span>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
      >
        <LogOut className="size-4" />
        <span>Sign Out</span>
      </button>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <TooltipProvider>
      <aside className="glass-card hidden w-64 shrink-0 flex-col border-r border-glass-border lg:flex">
        <SidebarLogo />
        <Separator />
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <Separator />
        <SidebarFooter />
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation menu"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 glass-card-strong">
        <SheetHeader className="p-0">
          <SheetTitle render={<div />}>
            <SidebarLogo />
          </SheetTitle>
        </SheetHeader>
        <Separator />
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
        <Separator />
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
