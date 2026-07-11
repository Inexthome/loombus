"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Eye,
  MessageCircle,
  Plus,
  Reply,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { LoombusLoadingScreen } from "