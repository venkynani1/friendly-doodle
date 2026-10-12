import Link from "next/link";
import EventForm from "@/components/EventForm";

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="text-[15px] font-semibold text-lanyard hover:underline">
        Back to events
      </Link>
      <h1 className="mb-8 mt-2 text-3xl font-extrabold">New event</h1>
      <EventForm />
    </div>
  );
}
