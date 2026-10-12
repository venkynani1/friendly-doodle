// Seeds demo data through the API and captures screenshots of the main screens.
// Needs a running app and `playwright` installed. Output: ./screenshots/*.png
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

async function call(method, path, body, cookie) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("ech_session="));
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return { data, cookie: setCookie?.split(";")[0] };
}

const iso = (m) => new Date(Date.now() + m * 60000).toISOString();

const { cookie: hr } = await call("POST", "/api/auth/login", {
  employeeCode: process.env.BOOTSTRAP_ADMIN_CODE,
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
});
await call("POST", "/api/staff", { employeeCode: "SCAN001", name: "Gate A desk", role: "SCANNER_OPERATOR", password: "scanner-pass-1" }, hr).catch(() => null);

const { data: created } = await call(
  "POST",
  "/api/events",
  {
    name: "Q4 Town Hall",
    description: "Lunch is served after the session. Bring your laptop charger if you're staying for the breakout.",
    venue: "Block B auditorium, 3rd floor",
    startsAt: iso(90),
    endsAt: iso(270),
    capacity: 120,
    stages: "ENTRY_FOOD_GOODIES",
    registrationClosesAt: iso(60),
    walkinsEnabled: true,
  },
  hr,
);
const ev = created.event;
await call("POST", "/api/events", { name: "New joiner orientation", venue: "Training room 2", startsAt: iso(60 * 24 * 3), capacity: 30, stages: "ENTRY", walkinsEnabled: false }, hr);

const people = [
  ["E10231", "Asha Raman"],
  ["E10457", "Ben Okafor"],
  ["E10872", "Chitra Iyer"],
  ["E11003", "Dev Malhotra"],
  ["E11290", "Farah Khan"],
  ["E11544", "Gokul Natarajan"],
];
const passes = [];
for (const [id, name] of people) {
  const { data } = await call("POST", `/api/public/events/${ev.registrationSlug}/register`, {
    employeeId: id,
    employeeName: name,
    employeeEmail: `${name.split(" ")[0].toLowerCase()}@example.com`,
  });
  passes.push(data.pass);
}
const { data: walk } = await call("POST", `/api/public/walkins/${ev.walkinSlug}/register`, {
  employeeId: "E12001",
  employeeName: "Harish Kumar",
  employeeEmail: "harish@example.com",
});
await call("POST", `/api/events/${ev.id}/actions`, { action: "open" }, hr);
const scan = (t, stage) => call("POST", "/api/scan/stage", { qrToken: t, stage, locationName: "Gate A", eventId: ev.id }, hr);
for (const p of passes.slice(0, 4)) await scan(p.qrToken, "ENTRY");
await scan(walk.pass.qrToken, "ENTRY");
for (const p of passes.slice(0, 2)) await scan(p.qrToken, "FOOD");
await scan(passes[0].qrToken, "GOODIES");

const browser = await chromium.launch();
const sessionCookie = { name: "ech_session", value: hr.split("=")[1], domain: "localhost", path: "/" };

async function shot(name, url, { mobile = false, auth = true, before } = {}) {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 900 } },
  );
  if (auth) await ctx.addCookies([sessionCookie]);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  if (before) await before(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await ctx.close();
  console.log(`captured ${name}`);
}

await shot("01-login", "/login", { auth: false });
await shot("02-events", "/admin");
await shot("03-event-detail", `/admin/events/${ev.id}`);
await shot("04-new-event", "/admin/events/new");
await shot("05-staff", "/admin/staff");
await shot("06-reports", "/admin/reports");
await shot("07-scanner-accepted", `/scanner?event=${ev.id}`, {
  before: async (page) => {
    await page.getByLabel("QR token").fill(passes[4].qrToken);
    await page.getByRole("button", { name: "Record" }).click();
    await page.waitForSelector("text=Entry recorded");
  },
});
await shot("08-scanner-repeat", `/scanner?event=${ev.id}`, {
  before: async (page) => {
    await page.getByLabel("QR token").fill(passes[0].qrToken);
    await page.getByRole("button", { name: "Record" }).click();
    await page.waitForSelector("text=Already scanned");
  },
});
await shot("09-scanner-mobile", `/scanner?event=${ev.id}`, { mobile: true });
await shot("10-register-mobile", `/register/${ev.registrationSlug}`, { mobile: true, auth: false });
await shot("11-register-success-mobile", `/register/${ev.registrationSlug}`, {
  mobile: true,
  auth: false,
  before: async (page) => {
    await page.getByLabel("Employee ID").fill("E13377");
    await page.getByLabel("Full name").fill("Meera Subramanian");
    await page.getByLabel("Work email").fill("meera@example.com");
    await page.getByRole("button", { name: "Get my pass" }).click();
    await page.waitForSelector("text=You're registered");
    await page.waitForLoadState("networkidle");
  },
});
await shot("12-walkin-mobile", `/walkin/${ev.walkinSlug}`, { mobile: true, auth: false });
await shot("13-event-detail-mobile", `/admin/events/${ev.id}`, { mobile: true });

await browser.close();
