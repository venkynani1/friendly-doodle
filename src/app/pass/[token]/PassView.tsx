"use client";

import { useEffect, useState } from "react";
import PassTicket from "@/components/PassTicket";
import { Notice, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";
import type { Pass } from "@/lib/types";

export default function PassView({ token }: { token: string }) {
  const [pass, setPass] = useState<Pass | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ pass: Pass }>(`/api/public/pass/${encodeURIComponent(token)}`)
      .then((r) => setPass(r.pass))
      .catch((e) => setError(errorMessage(e)));
  }, [token]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-8 sm:py-12">
      {error && <Notice tone="bad">{error}</Notice>}
      {!pass && !error && <Spinner label="Loading your pass" />}
      {pass && <PassTicket pass={pass} />}
      <p className="mt-10 text-center text-[13px] text-muted">Maverick Event Control Hub</p>
    </main>
  );
}
