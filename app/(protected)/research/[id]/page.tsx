import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import { getReport } from "@/lib/services/research";
import { ReportView } from "./report-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResearchReportPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getProfile(supabase, user!.id);
  if (!profile) notFound();

  const report = await getReport(supabase, id, profile.org_id);
  if (!report) notFound();

  return <ReportView report={report} />;
}
