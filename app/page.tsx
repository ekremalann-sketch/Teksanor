"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Database, LockKeyhole, Settings2, UserRound, Workflow } from "lucide-react";

const solutions = [
  { icon: Settings2, title: "Otomasyon", text: "Tekrarlanan işleri azaltan, insan kontrolünü koruyan akıllı süreçler." },
  {