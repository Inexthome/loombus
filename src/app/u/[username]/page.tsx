"use client";

import { ProfileAvatar } from "@/components/profile-avatar";
import { normalizePublicText } from "@/lib/public-text";
import { DEFAULT_REPORT_REASON, REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, Ban, ExternalLink, FileText, Flag, Globe2, Link2, MessageCircle, Share2, Sparkles, UserPlus, Users } from "luc