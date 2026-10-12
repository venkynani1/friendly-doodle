import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-lanyard p-12 text-white md:flex md:flex-col md:justify-between">
        <p className="text-lg font-semibold opacity-90">Maverick Event Control Hub</p>
        <div className="max-w-md">
          <h1 className="text-5xl font-extrabold leading-[1.05]">Every pass, every counter, one view.</h1>
          <p className="mt-5 text-lg text-white/80">
            Share a link, people register and get a QR pass. Your desks scan entry, food and goodies. You see the numbers as they happen.
          </p>
        </div>
        {/* A lanyard strap and badge, drawn: the event-day object this tool replaces. */}
        <svg aria-hidden viewBox="0 0 240 200" className="absolute -right-6 top-10 w-72 opacity-25">
          <path d="M60 0 L110 120 M180 0 L130 120" stroke="white" strokeWidth="18" fill="none" />
          <rect x="80" y="110" width="80" height="90" rx="10" fill="none" stroke="white" strokeWidth="6" />
          <rect x="98" y="132" width="44" height="44" fill="white" />
        </svg>
        <p className="text-sm text-white/70">For HR and desk staff. Participants register from the event link — no sign-in needed.</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
