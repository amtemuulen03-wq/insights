import { notFound } from "next/navigation";

import NavigationPlaceholder from "../../components/navigation-placeholder";

const SOURCE_LABELS: Record<string, string> = {
  bap: "BAP",
  "cloud-file": "Cloud File",
  manual: "Manual",
};

export default async function DataSourcePage({
  params,
}: {
  params: Promise<{ source: string }>;
}) {
  const { source } = await params;
  const label = SOURCE_LABELS[source];

  if (!label) notFound();

  return (
    <NavigationPlaceholder
      title={`${label} Data Source`}
      description={`This navigation destination is ready for the ${label} data-source workflow.`}
    />
  );
}
