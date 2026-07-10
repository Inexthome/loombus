"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CheckCircle2, GraduationCap, Home, Lock, Send, Store } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const ROOM_TEMPLATES = [
  { id: "business-team", title: "Business Team Room", type: "business", icon: Building2, description: "Private team planning, announcements, decisions, resources, tasks, and events." },
  { id: "res