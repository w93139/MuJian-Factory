"use client";
import { useSearchParams } from "next/navigation";
import { useContext } from "react";
import { HomeNavigationContext } from "./Shell";
import { useAuth } from "@/components/AuthProvider";
import WorkflowPanel from "@/components/WorkflowPanel";
import ShowcaseBrowser from "@/components/ShowcaseBrowser";
import { WaveScene } from "@/ui/WaveScene";

/** One workflow implementation for both appearances; this layer only supplies presentation. */
export default function LivePage() {
  const { canEdit } = useAuth();
  const query = useSearchParams();
  const homeNavigation = useContext(HomeNavigationContext);
  return <div className={`cinematic-workspace ${query.get("session") ? "cinematic-session" : ""} ${query.get("view") === "projects" ? "cinematic-projects" : ""}`}>
    {canEdit ? <WorkflowPanel cinematic homeNavigation={homeNavigation} /> : <>
      {!query.get("session") && <section className="wave-stage">
        <WaveScene />
        <div className="wave-hero-copy"><h1>故事的下一幕<br />由你想象</h1></div>
      </section>}
      <ShowcaseBrowser />
    </>}
  </div>;
}
