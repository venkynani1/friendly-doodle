// Shapes returned by the API, shared by client pages.

export type Stage = "ENTRY" | "FOOD" | "GOODIES";
export type EventStatus = "DRAFT" | "OPEN" | "COMPLETED";
export type Source = "NORMAL" | "WALKIN";
export type Role = "HR_ADMIN" | "SCANNER_OPERATOR";

export type WindowState = { open: boolean; reason?: string };

export type HrEvent = {
  id: string;
  name: string;
  description: string | null;
  venue: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  status: EventStatus;
  foodEnabled: boolean;
  goodiesEnabled: boolean;
  stages: Stage[];
  registrationSlug: string;
  registrationOpen: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  registrationState: WindowState;
  walkinsEnabled: boolean;
  walkinSlug: string;
  walkinOpen: boolean;
  walkinClosesAt: string | null;
  walkinState: WindowState;
  registrationUrl: string;
  walkinUrl: string;
  registeredCount?: number;
  checkedInCount?: number;
};

export type Dashboard = {
  eventId: string;
  capacity: number | null;
  registered: number;
  normal: number;
  walkins: number;
  checkedIn: number;
  pending: number;
  food: number | null;
  goodies: number | null;
  activity: {
    kind: "SCAN" | "REGISTRATION";
    at: string;
    stage: Stage | null;
    employeeId: string;
    employeeName: string;
    location: string | null;
    by: string | null;
  }[];
  generatedAt: string;
};

export type PublicEvent = {
  name: string;
  description: string | null;
  venue: string;
  startsAt: string;
  endsAt: string | null;
  kind: Source;
  open: boolean;
  closedReason: string | null;
  closesAt: string | null;
};

export type Pass = {
  qrToken: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  source: Source;
  registeredAt: string;
  emailStatus: "PENDING" | "SENT" | "LOGGED" | "FAILED";
  event: { name: string; venue: string; startsAt: string; endsAt: string | null };
};

export type ScanParticipant = {
  employeeId: string;
  employeeName: string;
  source: Source;
  eventName: string;
  stages: { stage: Stage; done: boolean; at: string | null; location: string | null }[];
};

export type StaffUser = {
  id: string;
  employeeCode: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export const STAGE_LABEL: Record<Stage, string> = { ENTRY: "Entry", FOOD: "Food", GOODIES: "Goodies" };
