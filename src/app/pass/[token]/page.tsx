import type { Metadata } from "next";
import PassView from "./PassView";

export const metadata: Metadata = { title: "Your pass", robots: { index: false } };

export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PassView token={token} />;
}
