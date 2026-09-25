import PlaceholderPage from "@/components/PlaceholderPage";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      icon={Settings}
      description="Threshold calibration, polling interval, and data-source credentials — the operator feedback loop that tunes model behavior over time."
    />
  );
}
