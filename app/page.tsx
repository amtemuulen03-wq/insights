import { redirect } from "next/navigation";

export default function Home() {
  redirect("/insights/dashboard/campaign");
}
