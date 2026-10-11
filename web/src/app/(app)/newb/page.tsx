"use client";

// New builds — `/newb` (catalogue), `/newb?dev=<name>` (developer page), `/newb?p=<key>[&dev=…][&u=<no>]` (project;
// `dev` keeps the «Назад» target, `u` opens the unit sheet — used from Favourites). Prototype lines 961–1331.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NbCatalog } from "@/components/newb/NbCatalog";
import { NbProject } from "@/components/newb/NbProject";
import { getProjects } from "@/lib/newb";

function NewbInner() {
  const params = useSearchParams();
  const pKey = params.get("p");
  const dev = params.get("dev");
  const u = params.get("u");
  const projects = getProjects();
  const p = pKey ? projects.find((x) => x.k === pKey) : null;
  if (p) return <NbProject key={`${p.k}:${u ?? ""}`} p={p} dev={dev} initialUnit={u ? +u : null} />;
  return <NbCatalog projects={projects} dev={dev} />;
}

export default function NewbPage() {
  return <Suspense><NewbInner /></Suspense>;
}
