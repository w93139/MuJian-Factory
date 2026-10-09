import { Suspense } from "react";
import { ConceptPage } from "@/concepts/App";
export default function Page() {
  return (
    <Suspense fallback={<p>正在打开幕间…</p>}>
      <ConceptPage />
    </Suspense>
  );
}
