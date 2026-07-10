"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import { isIosNativeApp } from "@/lib/native-app";