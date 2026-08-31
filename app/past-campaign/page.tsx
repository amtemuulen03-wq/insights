import { notFound } from "next/navigation";

import PastCampaignClient, {
  type PastCampaignOption,
  type PastCampaignScorecard,
} from "../components/past-campaign-client";

export const dynamic = "force-dynamic";

type PastCampaignEnvelope = {
  items?: PastCampaignOption[];
};

export default async function PastCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const query = await searchParams;
  const campaignName = query.campaign?.trim();
  const apiBaseUrl = process.env.INSIGHT_API_URL?.replace(/\/+$/, "");

  if (!campaignName) notFound();
  if (!apiBaseUrl) {
    throw new Error("INSIGHT_API_URL is not configured");
  }

  const apiQuery = new URLSearchParams({ campaign: campaignName });
  const [scorecardResponse, campaignsResponse] = await Promise.all([
    fetch(
      `${apiBaseUrl}/dashboard/past-campaign-scorecard?${apiQuery}`,
      { cache: "no-store" },
    ),
    fetch(`${apiBaseUrl}/dashboard/past-campaigns`, {
      cache: "no-store",
    }),
  ]);

  if (scorecardResponse.status === 404) notFound();
  if (!scorecardResponse.ok) {
    throw new Error(
      `Past campaign API returned ${scorecardResponse.status}`,
    );
  }

  const scorecard =
    (await scorecardResponse.json()) as PastCampaignScorecard;
  let campaignOptions: PastCampaignOption[] = [
    {
      campaignName,
      startDate: scorecard.metadata.startDate,
      endDate: scorecard.metadata.endDate,
    },
  ];

  if (campaignsResponse.ok) {
    const payload =
      (await campaignsResponse.json()) as PastCampaignEnvelope;
    campaignOptions = payload.items ?? campaignOptions;
  }

  return (
    <PastCampaignClient
      initialScorecard={scorecard}
      campaignOptions={campaignOptions}
    />
  );
}
