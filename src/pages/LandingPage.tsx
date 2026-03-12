import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Layers,
  LineChart,
  Menu,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
  Users,
  X,
} from "lucide-react";

// ============================================================================
// DESIGN SYSTEM TOKENS
// See /design-system.md for full documentation
// ============================================================================

const theme = {
  // Layout
  container: "mx-auto max-w-6xl px-4 md:px-6",
  
  // Section spacing
  section: "py-20 md:py-28",
  sectionTight: "py-10 md:py-14",
  sectionHero: "py-10 md:py-14",
  
  // Border radius
  radius: {
    sm: "rounded-xl",
    md: "rounded-2xl",
    lg: "rounded-3xl",
    pill: "rounded-full",
  },
  
  // Shadows
  shadow: {
    card: "shadow-[0_18px_40px_-32px_rgba(47,36,58,0.45)]",
    cardStrong: "shadow-[0_32px_64px_-24px_rgba(47,36,58,0.4)]",
    cardHover: "transition hover:-translate-y-1 hover:shadow-[0_22px_48px_-34px_rgba(47,36,58,0.5)]",
    pill: "shadow-[0_4px_12px_-4px_rgba(47,36,58,0.18)]",
    subtle: "shadow-[0_2px_8px_-2px_rgba(47,36,58,0.1)]",
  },
  
  // Typography
  text: {
    h1: "text-4xl md:text-[3.5rem] lg:text-6xl font-bold tracking-[-0.02em] leading-[1.1] text-balance",
    h2: "text-3xl md:text-4xl font-semibold tracking-tight",
    h3: "text-xl md:text-2xl font-semibold",
    body: "text-base md:text-lg leading-relaxed",
    bodySm: "text-sm",
    caption: "text-xs font-medium",
    micro: "text-[11px] font-medium",
    eyebrow: "text-xs font-semibold uppercase tracking-[0.28em]",
    label: "text-sm font-semibold",
    nav: "text-[13px]",
  },
  
  // Colors (tokens defined in src/index.css :root)
  colors: {
    bg: "bg-[color:var(--base)]",
    ink: "text-[color:var(--ink)]",
    inkSoft: "text-[color:var(--ink-70)]",
    inkMuted: "text-[color:var(--ink-55)]",
    accent: "bg-[color:var(--landing-accent)] text-[color:var(--base)]",
    accentSoft: "bg-[color:var(--accent-soft)] text-[color:var(--landing-accent)]",
    border: "border-[color:var(--ink-12)]",
    borderStrong: "border-[color:var(--ink-12)]",
    surface: "bg-[color:var(--surface)]",
    surfaceSoft: "bg-[color:var(--surface-soft)]",
  },
  
  // Spacing
  gap: {
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
    xl: "gap-6",
    "2xl": "gap-8",
    "3xl": "gap-10",
    "4xl": "gap-12",
  },
  
  // Component patterns
  components: {
    card: "border p-6",
    cardLg: "border p-8",
    pill: "px-3 py-1.5",
    pillSm: "px-2.5 py-1",
  },
};

const logos = [
  { name: "Mebelcenter", image: "/mebelcenter..svg" },
  { name: "All Power", image: "/allpower.avif" },
  { name: "Domex", image: "/domex.png" },
  { name: "HobbyFarms", image: "/hobbyfarms.png" },
  { name: "Transcargo", image: "/transcargo.png" },
  { name: "AiByLekov", image: "/aibylekov.png" },
];


const screenshots = {
  dashboard: "/landing/dashboard.jpg",
  orders: "/landing/orders.jpg",
  clients: "/landing/clients.jpg",
  complaints: "/landing/complaints.jpg",
  csv: "/landing/csv-import.jpg",
};

// Removed callout pills - using floating cards instead

 

const ImageFallback = ({ title }: { title: string }) => (
  <div
    className={`${theme.radius.lg} ${theme.colors.surfaceSoft} ${theme.colors.inkSoft} flex h-full w-full items-center justify-center text-sm`}
  >
    {title}
  </div>
);

const ImageWithFallback = ({
  src,
  alt,
  className,
  loading = "lazy",
  fetchPriority = "auto",
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ImageFallback title={alt} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const direction = i18n.dir();

  const workflowSteps = [
    {
      title: t("landing.workflow.steps.0.title"),
      detail: t("landing.workflow.steps.0.detail"),
    },
    {
      title: t("landing.workflow.steps.1.title"),
      detail: t("landing.workflow.steps.1.detail"),
    },
    {
      title: t("landing.workflow.steps.2.title"),
      detail: t("landing.workflow.steps.2.detail"),
    },
    {
      title: t("landing.workflow.steps.3.title"),
      detail: t("landing.workflow.steps.3.detail"),
    },
  ];

  const testimonials = [
    {
      quote: t("landing.testimonials.items.0.quote"),
      name: t("landing.testimonials.items.0.name"),
      company: t("landing.testimonials.items.0.company"),
    },
    {
      quote: t("landing.testimonials.items.1.quote"),
      name: t("landing.testimonials.items.1.name"),
      company: t("landing.testimonials.items.1.company"),
    },
    {
      quote: t("landing.testimonials.items.2.quote"),
      name: t("landing.testimonials.items.2.name"),
      company: t("landing.testimonials.items.2.company"),
    },
  ];

  const faqs = [
    {
      question: t("landing.faq.items.0.question"),
      answer: t("landing.faq.items.0.answer"),
    },
    {
      question: t("landing.faq.items.1.question"),
      answer: t("landing.faq.items.1.answer"),
    },
    {
      question: t("landing.faq.items.2.question"),
      answer: t("landing.faq.items.2.answer"),
    },
    {
      question: t("landing.faq.items.3.question"),
      answer: t("landing.faq.items.3.answer"),
    },
    {
      question: t("landing.faq.items.4.question"),
      answer: t("landing.faq.items.4.answer"),
    },
    {
      question: t("landing.faq.items.5.question"),
      answer: t("landing.faq.items.5.answer"),
    },
  ];

  const buyerBullets = [
    t("landing.features.rows.buyers.bullets.0"),
    t("landing.features.rows.buyers.bullets.1"),
    t("landing.features.rows.buyers.bullets.2"),
  ];

  const supplierBullets = [
    t("landing.features.rows.suppliers.bullets.0"),
    t("landing.features.rows.suppliers.bullets.1"),
    t("landing.features.rows.suppliers.bullets.2"),
  ];

  const stats = [
    {
      icon: ClipboardCheck,
      value: t("landing.stats.items.0.value"),
      label: t("landing.stats.items.0.label"),
      detail: t("landing.stats.items.0.detail"),
    },
    {
      icon: Layers,
      value: t("landing.stats.items.1.value"),
      label: t("landing.stats.items.1.label"),
      detail: t("landing.stats.items.1.detail"),
    },
    {
      icon: LineChart,
      value: t("landing.stats.items.2.value"),
      label: t("landing.stats.items.2.label"),
      detail: t("landing.stats.items.2.detail"),
    },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className={`min-h-screen ${theme.colors.bg} ${theme.colors.ink}`} dir={direction}>
      {/* Floating navbar - centered with no visible wrapper */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] max-w-6xl">
        <header
          className={`rounded-2xl transition-all duration-300 ease-out ${
            scrolled
              ? "bg-white border border-[color:var(--ink-12)] shadow-[0_8px_32px_-8px_rgba(47,36,58,0.15)]"
              : "bg-white border border-[color:var(--ink-08)] shadow-[0_4px_16px_-4px_rgba(47,36,58,0.08)]"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-3">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="rounded-xl bg-[color:var(--landing-accent)] flex h-9 w-9 items-center justify-center shadow-[0_2px_8px_-2px_rgba(68,64,84,0.3)] transition-all duration-300 group-hover:shadow-[0_4px_12px_-2px_rgba(68,64,84,0.4)] group-hover:-translate-y-0.5">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <span className="text-[15px] font-semibold text-[color:var(--ink)]">FurniTrade</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 lg:flex">
              <a 
                className="px-4 py-2 rounded-full text-[13px] font-medium text-[color:var(--ink)] transition-all duration-300 ease-out hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)]" 
                href="#features"
              >
                {t("landing.nav.features")}
              </a>
              <a 
                className="px-4 py-2 rounded-full text-[13px] font-medium text-[color:var(--ink)] transition-all duration-300 ease-out hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)]" 
                href="#highlights"
              >
                {t("landing.nav.product")}
              </a>
              <a 
                className="px-4 py-2 rounded-full text-[13px] font-medium text-[color:var(--ink)] transition-all duration-300 ease-out hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)]" 
                href="#workflow"
              >
                {t("landing.nav.workflow")}
              </a>
              <a 
                className="px-4 py-2 rounded-full text-[13px] font-medium text-[color:var(--ink)] transition-all duration-300 ease-out hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)]" 
                href="#roi"
              >
                {t("landing.nav.impact")}
              </a>
              <a 
                className="px-4 py-2 rounded-full text-[13px] font-medium text-[color:var(--ink)] transition-all duration-300 ease-out hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)]" 
                href="#faq"
              >
                {t("landing.nav.faq")}
              </a>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <LanguageSwitcher />
              <Link 
                to="/auth/login" 
                className="text-[13px] font-medium text-[color:var(--ink)] hover:text-[color:var(--landing-accent)] transition-colors duration-300 relative group"
              >
                {t("landing.nav.login")}
                <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-[color:var(--landing-accent)] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out origin-left" />
              </Link>
              <Button 
                className="bg-[color:var(--landing-accent)] hover:bg-[#363043] text-white font-semibold rounded-lg px-5 shadow-[0_2px_10px_-2px_rgba(68,64,84,0.35)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_6px_16px_-2px_rgba(68,64,84,0.4)]" 
                size="sm" 
                asChild
              >
                <Link to="/auth/signup">{t("landing.nav.startTrial")}</Link>
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] transition-colors duration-200"
              aria-label={t("landing.nav.toggleMenu")}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile menu */}
          <div
            className={`lg:hidden overflow-hidden transition-all duration-300 ease-out ${
              mobileMenuOpen ? "max-h-[400px] pb-6" : "max-h-0"
            }`}
          >
            <nav className="flex flex-col gap-1 pt-2 border-t border-[color:var(--ink-08)]">
              <a 
                className="px-4 py-3 rounded-xl text-[14px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)] transition-all duration-200" 
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("landing.nav.features")}
              </a>
              <a 
                className="px-4 py-3 rounded-xl text-[14px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)] transition-all duration-200" 
                href="#highlights"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("landing.nav.product")}
              </a>
              <a 
                className="px-4 py-3 rounded-xl text-[14px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)] transition-all duration-200" 
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("landing.nav.workflow")}
              </a>
              <a 
                className="px-4 py-3 rounded-xl text-[14px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)] transition-all duration-200" 
                href="#roi"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("landing.nav.impact")}
              </a>
              <a 
                className="px-4 py-3 rounded-xl text-[14px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--landing-accent)] transition-all duration-200" 
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("landing.nav.faq")}
              </a>
              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-[color:var(--ink-08)]">
                <div className="px-4">
                  <LanguageSwitcher />
                </div>
                <Link 
                  to="/auth/login" 
                  className="px-4 py-3 rounded-xl text-[14px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--accent-soft)] transition-all duration-200 text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t("landing.nav.login")}
                </Link>
                <Button 
                  className="bg-[color:var(--landing-accent)] hover:bg-[#363043] text-white font-semibold rounded-lg shadow-[0_2px_10px_-2px_rgba(68,64,84,0.35)]" 
                  asChild
                >
                  <Link to="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                    {t("landing.nav.startTrial")}
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        </header>
      </div>

      <main className="pt-20">
        <section className="relative overflow-hidden bg-[color:var(--base)]">
          
          {/* Curved decorative lines - using --ink-08, loosely connecting badges */}
          <svg className="absolute top-1/4 left-0 w-full h-64 pointer-events-none hidden lg:block" preserveAspectRatio="none">
            {/* Main flowing curve */}
            <path
              d="M 0 80 Q 200 50, 450 70 T 900 55 T 1400 75"
              stroke="rgba(47,36,58,0.08)"
              strokeWidth="1.5"
              fill="none"
            />
            {/* Secondary subtle curve */}
            <path
              d="M 50 130 Q 300 100, 550 115 T 1050 105 T 1300 120"
              stroke="rgba(47,36,58,0.06)"
              strokeWidth="1"
              fill="none"
            />
            {/* Third gentle curve - connecting badges area */}
            <path
              d="M 400 160 Q 600 140, 800 150 T 1100 145"
              stroke="rgba(68,64,84,0.10)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="4 6"
            />
          </svg>

          <div
            className={`${theme.container} ${theme.sectionHero} relative grid items-center gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12`}
          >
            <div className="space-y-5">
              {/* Badge - premium pill with subtle glow */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[color:var(--surface)] border border-[color:var(--ink-12)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.08),_0_1px_2px_-1px_rgba(47,36,58,0.06)] hover:shadow-[0_4px_12px_-4px_rgba(47,36,58,0.12)] transition-shadow duration-200">
                <div className="h-5 w-5 rounded-full bg-[color:var(--accent-soft)] flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-[color:var(--landing-accent)]" />
                </div>
                <span className="text-[11px] font-semibold tracking-wide text-[color:var(--ink)]">
                  {t("landing.hero.badge")}
                </span>
              </div>

              <div>
                <h1 className="text-[2rem] sm:text-4xl md:text-[3.5rem] lg:text-6xl font-bold tracking-[-0.02em] leading-[1.1] text-balance text-[color:var(--ink)]">
                  {t("landing.hero.headlinePrefix")}
                  <span className="underline decoration-[color:var(--landing-accent)] decoration-[3px] underline-offset-[5px]">
                    {t("landing.hero.headlineAccent")}
                  </span>
                  {t("landing.hero.headlineSuffix")}
                </h1>
                <p className={`${theme.text.body} ${theme.colors.inkSoft} max-w-[340px] sm:max-w-[380px] mt-3`}>
                  {t("landing.hero.subheadline")}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button 
                  className="bg-[color:var(--landing-accent)] hover:bg-[#363043] text-[color:var(--base)] font-semibold shadow-[0_4px_14px_-4px_rgba(68,64,84,0.4)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(68,64,84,0.5)]" 
                  size="lg" 
                  asChild
                >
                  <Link to="/auth/signup">{t("landing.hero.ctaPrimary")}</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-[color:var(--ink)] border border-[color:var(--ink-12)] bg-transparent hover:bg-[color:var(--surface)] gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-4px_rgba(47,36,58,0.15)]"
                >
                  {t("landing.hero.ctaSecondary")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Trust signals - refined pill style */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--surface)] border border-[color:var(--ink-08)] shadow-[0_1px_3px_-1px_rgba(47,36,58,0.08)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />
                  <span className="text-[11px] font-medium text-[color:var(--ink-55)]">
                    {t("landing.trust.noCard")}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--surface)] border border-[color:var(--ink-08)] shadow-[0_1px_3px_-1px_rgba(47,36,58,0.08)]">
                  <FileCheck2 className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />
                  <span className="text-[11px] font-medium text-[color:var(--ink-55)]">
                    {t("landing.trust.compliant")}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative lg:scale-[1.06] lg:origin-left">
              {/* Floating chip - above screenshot (success green accent) */}
              <div className="hidden md:flex justify-start mb-3 ml-4 lg:ml-10">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 shadow-[0_6px_16px_-6px_rgba(16,185,129,0.25)] px-2.5 py-1 flex items-center gap-1.5 rotate-[-3deg]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span className="text-[9px] font-semibold text-emerald-700">
                    {t("landing.chips.quoteApproved")}
                  </span>
                </div>
              </div>

              {/* Main screenshot - stronger cardStrong shadow + inner glow */}
              <div
                className="rounded-3xl border-2 border-[color:var(--ink-12)] bg-[color:var(--surface)] overflow-hidden ring-1 ring-inset ring-[color:var(--ink-08)]"
                style={{
                  boxShadow: '0 36px 72px -28px rgba(47,36,58,0.45), 0 0 0 1px rgba(47,36,58,0.04), inset 0 1px 0 rgba(255,255,255,0.5)'
                }}
              >
                <ImageWithFallback
                  src={screenshots.dashboard}
                  alt={t("landing.hero.screenshotAlt")}
                  className="h-full w-full object-contain"
                  loading="eager"
                  fetchPriority="high"
                />
                
                {/* Live data chip - inside screenshot top right */}
                <div className="absolute top-3 right-3">
                  <div className="rounded-lg bg-[color:var(--surface)] border border-[color:var(--ink-08)] px-2 py-1 text-[8px] font-semibold text-[color:var(--ink-55)] shadow-[0_4px_14px_-4px_rgba(47,36,58,0.2)] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-live)] animate-pulse" />
                    {t("landing.chips.liveData")}
                  </div>
                </div>
              </div>

              {/* Floating chip - below screenshot (refined style) */}
              <div className="hidden md:flex justify-end mt-3 mr-4 lg:mr-10">
                <div className="rounded-xl bg-[color:var(--surface)] border border-[color:var(--ink-12)] shadow-[0_8px_20px_-8px_rgba(47,36,58,0.2)] px-3 py-1.5 flex items-center gap-2 rotate-[2deg]">
                  <div className="h-5 w-5 rounded-md bg-[color:var(--accent-soft)] flex items-center justify-center">
                    <Tag className="h-2.5 w-2.5 text-[color:var(--landing-accent)]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-semibold text-[color:var(--ink)]">
                      {t("landing.chips.tierPricing")}
                    </span>
                    <span className="text-[8px] text-[color:var(--ink-55)]">
                      {t("landing.chips.discountApplied")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Floating card - left side (larger, more rotation) */}
              <div className="absolute -left-2 lg:-left-5 top-20 hidden lg:block rotate-[-6deg]">
                <div className="rounded-2xl bg-[color:var(--surface)] border border-[color:var(--ink-12)] shadow-[0_20px_44px_-24px_rgba(47,36,58,0.4)] px-3 py-2 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-[color:var(--accent-soft)] flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[color:var(--ink)]">
                      {t("landing.chips.clientAdded")}
                    </p>
                    <p className="text-[8px] text-[color:var(--ink-55)]">
                      {t("landing.chips.customPricingSet")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating card - right side (smaller, varied rotation) */}
              <div className="absolute -right-1 lg:-right-4 bottom-28 hidden lg:block rotate-[7deg]">
                <div className="rounded-xl bg-[color:var(--surface)] border border-[color:var(--ink-08)] shadow-[0_14px_32px_-18px_rgba(47,36,58,0.35)] px-2.5 py-1.5 flex items-center gap-2">
                  <div className="h-5 w-5 rounded-md bg-[color:var(--accent-soft)] flex items-center justify-center">
                    <FileText className="h-3 w-3 text-[color:var(--landing-accent)]" />
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-[color:var(--ink)]">
                      {t("landing.chips.proformaReady")}
                    </p>
                    <p className="text-[7px] text-[color:var(--ink-55)]">
                      {t("landing.chips.bgCompliant")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Extra badge - orders metric with trend */}
              <div className="absolute top-4 left-1/4 hidden xl:block rotate-[4deg]">
                <div className="rounded-xl bg-[color:var(--landing-accent)] px-3 py-1.5 shadow-[0_6px_16px_-4px_rgba(68,64,84,0.4)] flex items-center gap-2">
                  <div className="h-5 w-5 rounded-md bg-white/20 flex items-center justify-center">
                    <ArrowRight className="h-3 w-3 text-white rotate-[-45deg]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white leading-none">+24</span>
                    <span className="text-[7px] font-medium text-white/70">
                      {t("landing.chips.ordersToday")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Extra "Syncing" badge - white style like Live data */}
              <div className="absolute bottom-8 left-8 hidden xl:block rotate-[-2deg]">
                <div className="rounded-lg bg-[color:var(--surface)] border border-[color:var(--ink-08)] px-2.5 py-1 shadow-[0_4px_12px_-4px_rgba(47,36,58,0.15)] flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-live)] animate-pulse" />
                  <span className="text-[8px] font-semibold text-[color:var(--ink-55)]">
                    {t("landing.chips.syncing")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`border-y ${theme.colors.border} bg-[color:var(--surface)] overflow-hidden`}>
          <div className="py-12 md:py-16">
            {/* Header */}
            <div className={`${theme.container} text-center mb-10`}>
              <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--ink)] mb-3 relative inline-block">
                {t("landing.trusted.eyebrow")}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-[color:var(--landing-accent)] opacity-30 rounded-full" />
              </h3>
              <p className="text-[14px] text-[color:var(--ink-70)] max-w-md mx-auto mt-3">
                {t("landing.trusted.subheadline")}
              </p>
            </div>
            
            {/* Marquee container with fade edges */}
            <div className="relative">
              {/* Left fade */}
              <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-[color:var(--surface)] via-[color:var(--surface)]/80 to-transparent z-10 pointer-events-none" />
              {/* Right fade */}
              <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-[color:var(--surface)] via-[color:var(--surface)]/80 to-transparent z-10 pointer-events-none" />
              
              {/* Marquee track - 6 duplications for seamless infinite scroll */}
              <div className="marquee-container overflow-hidden">
                <div className="marquee-track flex items-center gap-16 md:gap-20 lg:gap-24 py-4 hover:[animation-play-state:paused]">
                  {/* Repeat logos 6 times for truly seamless scroll */}
                  {[...Array(6)].map((_, setIndex) => (
                    logos.map((logo) => (
                      <div
                        key={`set${setIndex}-${logo.name}`}
                        className="flex-shrink-0 group px-2"
                      >
                        <div className="h-10 md:h-12 flex items-center justify-center opacity-75 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 ease-out">
                          <img 
                            src={logo.image} 
                            alt={logo.name}
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            className="h-full w-auto max-w-[100px] md:max-w-[120px] object-contain"
                          />
                        </div>
                      </div>
                    ))
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Marquee animation styles */}
          <style>{`
            .marquee-track {
              animation: marquee 45s linear infinite;
              width: fit-content;
            }
            
            @keyframes marquee {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-16.666%);
              }
            }
            
            /* Slower on mobile */
            @media (max-width: 768px) {
              .marquee-track {
                animation-duration: 35s;
              }
            }
            
            @media (prefers-reduced-motion: reduce) {
              .marquee-track {
                animation: none;
              }
            }
          `}</style>
        </section>

        {/* ============================================
            CONSOLIDATED "HOW IT WORKS" SECTION
            5 rows + Predictable Flow diagram
            ============================================ */}
        <section id="features" className="py-20 md:py-28 bg-[color:var(--ink-08)]/30">
          <div className={theme.container}>
            {/* Section Header */}
            <div className="text-center mb-16 md:mb-20">
              <Badge className={`${theme.radius.pill} ${theme.colors.accentSoft} ${theme.text.caption} mb-5`}>
                {t("landing.features.badge")}
              </Badge>
              <h2 className="text-3xl md:text-4xl lg:text-[44px] font-bold text-[color:var(--ink)] mb-5 relative inline-block">
                {t("landing.features.title")}
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-[color:var(--landing-accent)] opacity-25 rounded-full" />
              </h2>
              <p className="text-[16px] md:text-lg text-[color:var(--ink-70)] max-w-2xl mx-auto mt-6 leading-relaxed">
                {t("landing.features.subtitle")}
              </p>
            </div>

            {/* Alternating Feature Rows - 5 rows */}
            <div className="space-y-14 md:space-y-20">
              
              {/* Row 1: Unified Catalog + Client Pricing (merged) */}
              <div 
                className="feature-row group"
                style={{ animation: 'fadeInUp 0.6s ease-out 0s both' }}
              >
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-center">
                  {/* Text Card - Modern Design */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative h-full">
                      {/* Clean card - no accent */}
                      <Card className="h-full rounded-[28px] border border-[color:var(--ink-08)] bg-gradient-to-b from-white to-[color:var(--base)] shadow-[0_4px_24px_-8px_rgba(47,36,58,0.08)] transition-all duration-400 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_32px_64px_-16px_rgba(47,36,58,0.18)] group-hover:border-[color:var(--ink-12)]">
                        <div className="p-8 md:p-10">
                          {/* Stacked icons - clean white style */}
                          <div className="flex items-center mb-7">
                            <div className="relative flex items-center">
                              <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-white border border-[color:var(--ink-08)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.12)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)] z-10">
                                <Layers className="h-5 w-5 text-[color:var(--landing-accent)]" />
                              </div>
                              <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-[color:var(--base)] border border-[color:var(--ink-12)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.08)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)] -ml-3">
                                <BadgeCheck className="h-5 w-5 text-[color:var(--ink-70)]" />
                              </div>
                            </div>
                          </div>
                          
                          {/* Title */}
                          <h3 className="text-[22px] md:text-[26px] font-semibold text-[color:var(--ink)] mb-3 tracking-[-0.02em]">
                            {t("landing.features.rows.catalogPricing.title")}
                          </h3>
                          
                          {/* Description */}
                          <p className="text-[15px] text-[color:var(--ink-70)] leading-[1.7] mb-6">
                            {t("landing.features.rows.catalogPricing.description")}
                          </p>
                          
                          {/* Feature pills */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[color:var(--ink-08)] text-[12px] font-medium text-[color:var(--ink)] shadow-[0_1px_3px_rgba(47,36,58,0.06)]">
                              <Layers className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />{" "}
                              {t("landing.features.rows.catalogPricing.pills.unified")}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[color:var(--ink-08)] text-[12px] font-medium text-[color:var(--ink)] shadow-[0_1px_3px_rgba(47,36,58,0.06)]">
                              <BadgeCheck className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />{" "}
                              {t("landing.features.rows.catalogPricing.pills.custom")}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                  
                  {/* Screenshot - tilted style */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative">
                      <Card className="rounded-[28px] bg-white border border-[color:var(--ink-08)] p-3 shadow-[0_4px_24px_-8px_rgba(47,36,58,0.12)] transition-all duration-400 ease-out group-hover:shadow-[0_24px_48px_-16px_rgba(47,36,58,0.2)] overflow-hidden rotate-[2deg] group-hover:rotate-0">
                        <div className="rounded-2xl overflow-hidden border border-[color:var(--ink-08)]">
                          <div className="relative aspect-[16/10]">
                            <ImageWithFallback
                              src={screenshots.clients}
                              alt={t("landing.features.rows.catalogPricing.imageAlt")}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Quote to Order (merged) - Reversed */}
              <div 
                className="feature-row group"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}
              >
                <div className="flex flex-col lg:flex-row-reverse gap-8 lg:gap-14 items-center">
                  {/* Text Card - Modern Design */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative h-full">
                      {/* Clean card - no accent */}
                      <Card className="h-full rounded-[28px] border border-[color:var(--ink-08)] bg-gradient-to-b from-white to-[color:var(--base)] shadow-[0_4px_24px_-8px_rgba(47,36,58,0.08)] transition-all duration-400 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_32px_64px_-16px_rgba(47,36,58,0.18)] group-hover:border-[color:var(--ink-12)]">
                        <div className="p-8 md:p-10">
                          {/* Stacked icons - clean white style */}
                          <div className="flex items-center mb-7">
                            <div className="relative flex items-center">
                              <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-white border border-[color:var(--ink-08)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.12)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)] z-10">
                                <ClipboardCheck className="h-5 w-5 text-[color:var(--landing-accent)]" />
                              </div>
                              <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-[color:var(--base)] border border-[color:var(--ink-12)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.08)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)] -ml-3">
                                <FileCheck2 className="h-5 w-5 text-[color:var(--ink-70)]" />
                              </div>
                            </div>
                          </div>
                          
                          {/* Title */}
                          <h3 className="text-[22px] md:text-[26px] font-semibold text-[color:var(--ink)] mb-3 tracking-[-0.02em]">
                            {t("landing.features.rows.quoteToOrder.title")}
                          </h3>
                          
                          {/* Description */}
                          <p className="text-[15px] text-[color:var(--ink-70)] leading-[1.7] mb-6">
                            {t("landing.features.rows.quoteToOrder.description")}
                          </p>
                          
                          {/* Feature pills */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[color:var(--ink-08)] text-[12px] font-medium text-[color:var(--ink)] shadow-[0_1px_3px_rgba(47,36,58,0.06)]">
                              <ClipboardCheck className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />{" "}
                              {t("landing.features.rows.quoteToOrder.pills.approvals")}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[color:var(--ink-08)] text-[12px] font-medium text-[color:var(--ink)] shadow-[0_1px_3px_rgba(47,36,58,0.06)]">
                              <FileCheck2 className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />{" "}
                              {t("landing.features.rows.quoteToOrder.pills.compliant")}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                  
                  {/* Screenshot - tilted style */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative">
                      <Card className="rounded-[28px] bg-white border border-[color:var(--ink-08)] p-3 shadow-[0_4px_24px_-8px_rgba(47,36,58,0.12)] transition-all duration-400 ease-out group-hover:shadow-[0_24px_48px_-16px_rgba(47,36,58,0.2)] overflow-hidden rotate-[-2deg] group-hover:rotate-0">
                        <div className="rounded-2xl overflow-hidden border border-[color:var(--ink-08)]">
                          <div className="relative aspect-[16/10]">
                            <ImageWithFallback
                              src={screenshots.orders}
                              alt={t("landing.features.rows.quoteToOrder.imageAlt")}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================
                  PREDICTABLE FLOW DIAGRAM (Full Width)
                  ============================================ */}
              <div 
                id="workflow"
                className="py-10 md:py-14 px-6 md:px-10 rounded-3xl bg-white/60 backdrop-blur-sm border border-[color:var(--ink-08)]"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.15s both' }}
              >
                <div className="text-center mb-10">
                  <Badge className={`${theme.radius.pill} ${theme.colors.accentSoft} ${theme.text.caption} mb-4`}>
                    {t("landing.workflow.badge")}
                  </Badge>
                  <h3 className="text-2xl md:text-3xl font-bold text-[color:var(--ink)] mb-3">
                    {t("landing.workflow.title")}
                  </h3>
                  <p className="text-[15px] text-[color:var(--ink-70)] max-w-lg mx-auto">
                    {t("landing.workflow.subtitle")}
                  </p>
                </div>
                
                <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
                  {workflowSteps.map((step, index) => (
                    <Card
                      key={step.title}
                      className="rounded-2xl bg-white/90 backdrop-blur-md border border-[color:var(--ink-08)] p-6 md:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(47,36,58,0.18)] hover:border-[color:var(--ink-12)]"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color:var(--accent-soft)] text-[11px] font-semibold text-[color:var(--ink)]">
                          {t("landing.workflow.step", { number: index + 1 })}
                        </span>
                        {index < workflowSteps.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-[color:var(--ink-55)] hidden lg:block" />
                        )}
                      </div>
                      <h4 className="text-lg font-semibold text-[color:var(--ink)] mb-2">{step.title}</h4>
                      <p className="text-[13px] text-[color:var(--ink-70)] leading-relaxed">{step.detail}</p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Row 3: CSV Import */}
              <div 
                className="feature-row group"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}
              >
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-center">
                  {/* Text Card - Clean Modern Design (no accent) */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative h-full">
                      <Card className="h-full rounded-[28px] border border-[color:var(--ink-08)] bg-gradient-to-b from-white to-[color:var(--base)] shadow-[0_4px_24px_-8px_rgba(47,36,58,0.08)] transition-all duration-400 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_32px_64px_-16px_rgba(47,36,58,0.18)] group-hover:border-[color:var(--ink-12)]">
                        
                        <div className="p-8 md:p-10">
                          {/* Single icon */}
                          <div className="mb-7">
                            <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-white border border-[color:var(--ink-08)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.12)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)]">
                              <FileText className="h-5 w-5 text-[color:var(--landing-accent)]" />
                            </div>
                          </div>
                          
                          {/* Title */}
                          <h3 className="text-[22px] md:text-[26px] font-semibold text-[color:var(--ink)] mb-3 tracking-[-0.02em]">
                            {t("landing.features.rows.csv.title")}
                          </h3>
                          
                          {/* Description */}
                          <p className="text-[15px] text-[color:var(--ink-70)] leading-[1.7] mb-6">
                            {t("landing.features.rows.csv.description")}
                          </p>
                          
                          {/* Feature pill */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[color:var(--ink-08)] text-[12px] font-medium text-[color:var(--ink)] shadow-[0_1px_3px_rgba(47,36,58,0.06)]">
                              <FileText className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />{" "}
                              {t("landing.features.rows.csv.pill")}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                  
                  {/* Screenshot - tilted style */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative">
                      <Card className="rounded-[28px] bg-white border border-[color:var(--ink-08)] p-3 shadow-[0_4px_24px_-8px_rgba(47,36,58,0.12)] transition-all duration-400 ease-out group-hover:shadow-[0_24px_48px_-16px_rgba(47,36,58,0.2)] overflow-hidden rotate-[2deg] group-hover:rotate-0">
                        <div className="rounded-2xl overflow-hidden border border-[color:var(--ink-08)]">
                          <div className="relative aspect-[16/10]">
                            <ImageWithFallback
                              src={screenshots.csv}
                              alt={t("landing.features.rows.csv.imageAlt")}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Complaints & Reporting (Reversed) */}
              <div 
                className="feature-row group"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.25s both' }}
              >
                <div className="flex flex-col lg:flex-row-reverse gap-8 lg:gap-14 items-center">
                  {/* Text Card - Modern Design */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative h-full">
                      <Card className="h-full rounded-[28px] border border-[color:var(--ink-08)] bg-gradient-to-b from-white to-[color:var(--base)] shadow-[0_4px_24px_-8px_rgba(47,36,58,0.08)] transition-all duration-400 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_32px_64px_-16px_rgba(47,36,58,0.18)] group-hover:border-[color:var(--ink-12)]">
                        <div className="p-8 md:p-10">
                          {/* Single icon */}
                          <div className="mb-7">
                            <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-white border border-[color:var(--ink-08)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.12)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)]">
                              <LineChart className="h-5 w-5 text-[color:var(--landing-accent)]" />
                            </div>
                          </div>
                          
                          {/* Title */}
                          <h3 className="text-[22px] md:text-[26px] font-semibold text-[color:var(--ink)] mb-3 tracking-[-0.02em]">
                            {t("landing.features.rows.complaints.title")}
                          </h3>
                          
                          {/* Description */}
                          <p className="text-[15px] text-[color:var(--ink-70)] leading-[1.7] mb-6">
                            {t("landing.features.rows.complaints.description")}
                          </p>
                          
                          {/* Feature pill */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[color:var(--ink-08)] text-[12px] font-medium text-[color:var(--ink)] shadow-[0_1px_3px_rgba(47,36,58,0.06)]">
                              <LineChart className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" />{" "}
                              {t("landing.features.rows.complaints.pill")}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                  
                  {/* Screenshot - tilted style */}
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="relative">
                      <Card className="rounded-[28px] bg-white border border-[color:var(--ink-08)] p-3 shadow-[0_4px_24px_-8px_rgba(47,36,58,0.12)] transition-all duration-400 ease-out group-hover:shadow-[0_24px_48px_-16px_rgba(47,36,58,0.2)] overflow-hidden rotate-[-2deg] group-hover:rotate-0">
                        <div className="rounded-2xl overflow-hidden border border-[color:var(--ink-08)]">
                          <div className="relative aspect-[16/10]">
                            <ImageWithFallback
                              src={screenshots.complaints}
                              alt={t("landing.features.rows.complaints.imageAlt")}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 5: Buyer & Supplier Portals */}
              <div 
                className="feature-row"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.3s both' }}
              >
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Buyers Card - Clean Design */}
                  <Card className="group rounded-[28px] border border-[color:var(--ink-08)] bg-gradient-to-b from-white to-[color:var(--base)] shadow-[0_4px_24px_-8px_rgba(47,36,58,0.08)] transition-all duration-400 hover:-translate-y-2 hover:shadow-[0_32px_64px_-16px_rgba(47,36,58,0.18)] hover:border-[color:var(--ink-12)]">
                    <div className="p-8 md:p-10">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-white border border-[color:var(--ink-08)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.12)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)]">
                          <Users className="h-5 w-5 text-[color:var(--landing-accent)]" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-[color:var(--ink)] tracking-[-0.01em]">
                            {t("landing.features.rows.buyers.title")}
                          </h4>
                          <p className="text-[12px] text-[color:var(--ink-55)]">
                            {t("landing.features.rows.buyers.subtitle")}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-3">
                        {buyerBullets.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-[color:var(--landing-accent)] flex-shrink-0" />
                            <span className="text-[14px] text-[color:var(--ink-70)] leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                  
                  {/* Suppliers Card - Clean Design */}
                  <Card className="group rounded-[28px] border border-[color:var(--ink-08)] bg-gradient-to-b from-white to-[color:var(--base)] shadow-[0_4px_24px_-8px_rgba(47,36,58,0.08)] transition-all duration-400 hover:-translate-y-2 hover:shadow-[0_32px_64px_-16px_rgba(47,36,58,0.18)] hover:border-[color:var(--ink-12)]">
                    <div className="p-8 md:p-10">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="rounded-2xl h-12 w-12 flex items-center justify-center bg-white border border-[color:var(--ink-08)] shadow-[0_2px_8px_-2px_rgba(47,36,58,0.12)] transition-all duration-300 group-hover:border-[color:var(--landing-accent)] group-hover:shadow-[0_4px_16px_-4px_rgba(68,64,84,0.25)]">
                          <Truck className="h-5 w-5 text-[color:var(--landing-accent)]" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-[color:var(--ink)] tracking-[-0.01em]">
                            {t("landing.features.rows.suppliers.title")}
                          </h4>
                          <p className="text-[12px] text-[color:var(--ink-55)]">
                            {t("landing.features.rows.suppliers.subtitle")}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-3">
                        {supplierBullets.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-[color:var(--landing-accent)] flex-shrink-0" />
                            <span className="text-[14px] text-[color:var(--ink-70)] leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
          
          {/* Fade-in animation */}
          <style>{`
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </section>

        {/* ============================================
            STATS / ROI SECTION - Polished
            ============================================ */}
        <section id="roi" className="py-20 md:py-28 bg-[color:var(--base)]">
          <div className={theme.container}>
            {/* Section Header */}
            <div className="text-center mb-14">
              <Badge className={`${theme.radius.pill} ${theme.colors.accentSoft} ${theme.text.caption} mb-5`}>
                {t("landing.stats.badge")}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-[color:var(--ink)] mb-4">
                {t("landing.stats.title")}
              </h2>
              <p className="text-[16px] text-[color:var(--ink-70)] max-w-xl mx-auto">
                {t("landing.stats.subtitle")}
              </p>
            </div>

            {/* Stats Cards - Horizontal with mini-icons */}
            <div className="grid gap-6 md:grid-cols-3">
              {stats.map((metric, index) => (
                <Card
                  key={metric.label}
                  className="group rounded-3xl bg-white/95 backdrop-blur-md border border-[color:var(--ink-08)] p-8 md:p-10 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_32px_64px_-24px_rgba(47,36,58,0.2)] hover:border-[color:var(--ink-12)]"
                  style={{ animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both` }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="rounded-xl h-12 w-12 flex items-center justify-center bg-[color:var(--accent-soft)] transition-all duration-300 group-hover:bg-[color:var(--landing-accent)] flex-shrink-0">
                      <metric.icon className="h-5 w-5 text-[color:var(--landing-accent)] transition-colors duration-300 group-hover:text-white" />
                    </div>
                    <div>
                      <p className="text-4xl md:text-5xl font-bold text-[color:var(--ink)]">{metric.value}</p>
                    </div>
                  </div>
                  <p className="text-lg font-medium text-[color:var(--ink)] mb-2">{metric.label}</p>
                  <p className="text-[14px] text-[color:var(--ink-70)] leading-relaxed">{metric.detail}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            TESTIMONIALS SECTION - Staggered Layout
            ============================================ */}
        <section className="py-20 md:py-28 bg-[color:var(--ink-08)]/30">
          <div className={theme.container}>
            {/* Section Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-14">
              <div className="space-y-3">
                <Badge className={`${theme.radius.pill} ${theme.colors.accentSoft} ${theme.text.caption}`}>
                  {t("landing.testimonials.badge")}
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-[color:var(--ink)]">
                  {t("landing.testimonials.title")}
                </h2>
              </div>
              <Button
                variant="outline"
                className="text-[color:var(--ink)] border border-[color:var(--ink-12)] bg-white/80 hover:bg-white rounded-xl"
              >
                {t("landing.testimonials.cta")}
              </Button>
            </div>

            {/* Testimonials - Staggered Grid */}
            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <Card
                  key={testimonial.name}
                  className={`group rounded-3xl bg-white/95 backdrop-blur-md border border-[color:var(--ink-08)] p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_32px_64px_-24px_rgba(47,36,58,0.2)] hover:border-[color:var(--ink-12)] ${
                    index === 1 ? 'md:translate-y-6' : ''
                  }`}
                  style={{ animation: `fadeInUp 0.6s ease-out ${index * 0.1}s both` }}
                >
                  {/* Quote */}
                  <p className="text-[15px] text-[color:var(--ink-70)] leading-relaxed mb-8">
                    "{testimonial.quote}"
                  </p>
                  
                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-[color:var(--accent-soft)] border border-[color:var(--ink-08)] flex items-center justify-center">
                      <span className="text-lg font-semibold text-[color:var(--landing-accent)]">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">{testimonial.name}</p>
                      <p className="text-[13px] text-[color:var(--ink-55)]">{testimonial.company}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className={`${theme.section}`}>
          <div className={`${theme.container} grid gap-10 lg:grid-cols-[0.9fr_1.1fr]`}>
            <div className="space-y-4">
              <Badge className={`${theme.radius.pill} ${theme.colors.accentSoft} ${theme.text.caption}`}>
                {t("landing.faq.badge")}
              </Badge>
              <h2 className={theme.text.h2}>{t("landing.faq.title")}</h2>
              <p className={`${theme.text.body} ${theme.colors.inkSoft}`}>
                {t("landing.faq.subtitle")}
              </p>
              <Card
                className={`${theme.radius.md} ${theme.colors.surface} border ${theme.colors.border} p-6`}
              >
                <p className={theme.text.label}>{t("landing.faq.cardTitle")}</p>
                <p className={`${theme.text.bodySm} ${theme.colors.inkMuted} mt-2`}>
                  {t("landing.faq.cardBody")}
                </p>
                <Button className={`${theme.colors.accent} mt-4`}>
                  {t("landing.faq.cardCta")}
                </Button>
              </Card>
            </div>
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.question}
                  value={faq.question}
                  className={`${theme.radius.md} ${theme.colors.surface} border ${theme.colors.border} px-4`}
                >
                  <AccordionTrigger
                    className={`text-left ${theme.text.bodySm} ${theme.colors.ink}`}
                  >
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className={`${theme.text.bodySm} ${theme.colors.inkMuted}`}>
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className={`${theme.section} ${theme.colors.surfaceSoft} border-t ${theme.colors.border}`}>
          <div className={theme.container}>
            <Card
              className={`${theme.radius.lg} ${theme.shadow.card} ${theme.colors.surface} border ${theme.colors.border} p-10`}
            >
              <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                <div className="space-y-4">
                  <Badge className={`${theme.radius.pill} ${theme.colors.accentSoft} ${theme.text.caption}`}>
                    {t("landing.cta.badge")}
                  </Badge>
                  <h2 className={theme.text.h2}>
                    {t("landing.cta.title")}
                  </h2>
                  <p className={`${theme.text.body} ${theme.colors.inkSoft}`}>
                    {t("landing.cta.subtitle")}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button className={theme.colors.accent} size="lg" asChild>
                    <Link to="/auth/signup">{t("landing.cta.primary")}</Link>
                  </Button>
                  <Button
                    variant="outline"
                    className={`${theme.colors.ink} border border-[color:var(--ink-12)] bg-transparent hover:bg-[color:var(--surface)]`}
                    size="lg"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t("landing.cta.secondary")}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className={`border-t ${theme.colors.border} ${theme.colors.surfaceSoft}`}>
        <div className={`${theme.container} grid gap-8 py-12 md:grid-cols-4`}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`${theme.radius.sm} ${theme.colors.surface} flex h-9 w-9 items-center justify-center border border-[color:var(--ink-12)]`}
              >
                <Sparkles className="h-5 w-5" />
              </span>
              <span className={theme.text.label}>FurniTrade</span>
            </div>
            <p className={`${theme.text.bodySm} ${theme.colors.inkMuted}`}>
              {t("landing.footer.tagline")}
            </p>
          </div>
          <div>
            <p className={theme.text.label}>{t("landing.footer.product")}</p>
            <ul className={`mt-3 space-y-2 ${theme.text.bodySm} ${theme.colors.inkMuted}`}>
              <li>
                <a href="#features" className="hover:text-[color:var(--ink)]">
                  {t("landing.footer.productLinks.features")}
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-[color:var(--ink)]">
                  {t("landing.footer.productLinks.workflow")}
                </a>
              </li>
              <li>
                <a href="#roi" className="hover:text-[color:var(--ink)]">
                  {t("landing.footer.productLinks.impact")}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className={theme.text.label}>{t("landing.footer.company")}</p>
            <ul className={`mt-3 space-y-2 ${theme.text.bodySm} ${theme.colors.inkMuted}`}>
              <li>{t("landing.footer.companyLinks.about")}</li>
              <li>{t("landing.footer.companyLinks.careers")}</li>
              <li>{t("landing.footer.companyLinks.contact")}</li>
            </ul>
          </div>
          <div>
            <p className={theme.text.label}>{t("landing.footer.resources")}</p>
            <ul className={`mt-3 space-y-2 ${theme.text.bodySm} ${theme.colors.inkMuted}`}>
              <li>{t("landing.footer.resourceLinks.compliance")}</li>
              <li>{t("landing.footer.resourceLinks.security")}</li>
              <li>{t("landing.footer.resourceLinks.support")}</li>
            </ul>
          </div>
        </div>
        <div className={`border-t ${theme.colors.border} py-6 text-center ${theme.text.caption} ${theme.colors.inkMuted}`}>
          {t("landing.footer.copyright")}
        </div>
      </footer>
    </div>
  );
}
