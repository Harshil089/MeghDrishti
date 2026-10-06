import { PageHeader, Section, Empty } from "@/components/console/ui";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        title="History"
        description="Audit log of raw observations and quality flags. Past flags stay reviewable and original readings are never overwritten."
      />
      <Section title="Audit log">
        <Empty>The audit log view is not available yet.</Empty>
      </Section>
    </>
  );
}
