import { Suspense } from "react";
import LivePage from "@/live/Page";
import OriginalPage from "./OriginalPage";

export default function Page() {
  return process.env.NEXT_PUBLIC_MUJIAN_LEGACY === "1" ? <OriginalPage /> : (
    <Suspense fallback={<p>正在打开幕间</p>}><LivePage /></Suspense>
  );
}
