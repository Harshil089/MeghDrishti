import PlaceholderPage from "@/components/PlaceholderPage";
import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <PlaceholderPage
      title="History"
      icon={History}
      description="Audit log of raw observations and quality flags, kept separately — every past flag stays reviewable, and nothing overwrites the original reading."
    />
  );
}
