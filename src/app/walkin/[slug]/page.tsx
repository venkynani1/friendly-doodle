import type { Metadata } from "next";
import PublicRegistration from "@/components/PublicRegistration";

export const metadata: Metadata = { title: "Walk-in registration", robots: { index: false } };

export default async function WalkinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicRegistration slug={slug} kind="WALKIN" />;
}
