"use client";
import { useSearchParams } from "next/navigation";
import { useContext } from "react";
import { HomeNavigationContext } from "./Shell";
import { useAuth } from "@/components/AuthProvider";
import WorkflowPanel from "@/components/WorkflowPanel";
import ShowcaseBrowser from "@/components/ShowcaseBrowser";

/** One workflow implementation for both appearances; this layer only supplies presentation. */
export default function LivePage() {
  const { canEdit } = useAuth();
  const query = useSearchParams();
  const homeNavigation = useContext(HomeNavigationContext);
  return <div className={`cinematic-workspace ${query.get("session") ? "cinematic-session" : ""}`}>
    {canEdit ? <WorkflowPanel cinematic homeNavigation={homeNavigation} /> : <ShowcaseBrowser />}
  </div>;
}
