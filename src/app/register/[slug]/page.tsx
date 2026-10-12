import type { Metadata } from "next";
import PublicRegistration from "@/components/PublicRegistration";

export const metadata: Metadata = { title: "Register", robots: { index: false } };

export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicRegistration slug={slug} kind="NORMAL" />;
}
