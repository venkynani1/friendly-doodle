// End-to-end smoke test of the demo script, run against a live server and real Postgres.
// Usage: BASE_URL=http://localhost:3000 BOOTSTRAP_ADMIN_CODE=HR001 BOOTSTRAP_ADMIN_PASSWORD=... node scripts/smoke-test.mjs
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ADMIN_CODE = process.env.BOOTSTRAP_ADMIN_CODE || "HR001";
const ADMIN_PASS = process.env.BOOTSTRAP_ADMIN_PASSWORD || "change-me-now";

let passed = 0;
function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

class Client {
  cookie = "";
  async req(method, path, body, { raw = false, redirect = "follow" } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const pair = c.split(";")[0];
      if (pair.startsWith("ech_session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    if (raw) return res;
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }
  get = (p, o) => this.req("GET", p, undefined, o);
  post = (p, b, o) => this.req("POST", p, b ?? {}, o);
  put = (p, b) => this.req("PUT", p, b);
  patch = (p, b) => this.req("PATCH", p, b);
}

const expectStatus = (r, status, label) => assert.equal(r.status, status, `${label}: expected ${status}, got ${r.status} ${JSON.stringify(r.data)}`);
const expectCode = (r, status, code, label) => {
  expectStatus(r, status, label);
  assert.equal(r.data?.error?.code, code, `${label}: expected code ${code}, got ${JSON.stringify(r.data)}`);
};

const iso = (minsFromNow) => new Date(Date.now() + minsFromNow * 60000).toISOString();
const uid = Math.random().toString(36).slice(2, 7).toUpperCase();

async function main() {
  console.log(`Smoke test against ${BASE}`);

  // --- Health and public pages ---
  const anon = new Client();
  expectStatus(await anon.get("/api/health"), 200, "health");
  ok("health check");
  const loginPage = await anon.get("/login", { raw: true });
  assert.equal(loginPage.status, 200);
  ok("login page renders");
  const adminRedirect = await anon.get("/admin", { raw: true, redirect: "manual" });
  assert.ok([302, 307, 308].includes(adminRedirect.status), `admin should redirect when signed out, got ${adminRedirect.status}`);
  assert.match(adminRedirect.headers.get("location") || "", /\/login/);
  ok("admin redirects to login when signed out");
  expectCode(await anon.get("/api/events"), 401, "UNAUTHENTICATED", "events unauthenticated");
  ok("API rejects unauthenticated calls");

  // --- HR login (bootstrap) ---
  const hr = new Client();
  expectCode(await hr.post("/api/auth/login", { employeeCode: ADMIN_CODE, password: "wrong-password" }), 401, "INVALID_CREDENTIALS", "bad login");
  ok("wrong password rejected");
  const login = await hr.post("/api/auth/login", { employeeCode: ADMIN_CODE.toLowerCase(), password: ADMIN_PASS });
  expectStatus(login, 200, "hr login");
  assert.equal(login.data.user.role, "HR_ADMIN");
  assert.ok(hr.cookie, "session cookie set");
  ok("HR admin bootstrap login");
  expectStatus(await hr.get("/api/auth/me"), 200, "me");
  const adminPage = await hr.get("/admin", { raw: true });
  assert.equal(adminPage.status, 200);
  ok("admin page renders when signed in");

  // --- Create event ---
  const created = await hr.post("/api/events", {
    name: `Smoke Town Hall ${uid}`,
    venue: "Block B auditorium",
    startsAt: iso(60),
    endsAt: iso(180),
    capacity: 50,
    stages: "ENTRY_FOOD_GOODIES",
    registrationOpensAt: null,
    registrationClosesAt: iso(120),
    walkinsEnabled: true,
    walkinClosesAt: null,
  });
  expectStatus(created, 201, "create event");
  const ev = created.data.event;
  assert.deepEqual(ev.stages, ["ENTRY", "FOOD", "GOODIES"]);
  assert.equal(ev.status, "DRAFT");
  ok("event created with entry + food + goodies");

  expectCode(await hr.post("/api/events", { name: "", venue: "x", startsAt: iso(5), stages: "ENTRY", walkinsEnabled: false }), 400, "VALIDATION_ERROR", "invalid event");
  ok("invalid event rejected");

  const qr = await hr.get(`/api/events/${ev.id}/link-qr?type=walkin`, { raw: true });
  assert.equal(qr.headers.get("content-type"), "image/png");
  ok("walk-in link QR image");

  // --- Public registration ---
  const pub = await anon.get(`/api/public/events/${ev.registrationSlug}`);
  expectStatus(pub, 200, "public event");
  assert.equal(pub.data.event.open, true);
  const regPage = await anon.get(`/register/${ev.registrationSlug}`, { raw: true });
  assert.equal(regPage.status, 200);
  ok("public registration page and API");

  const p1 = { employeeId: `e${uid}1`, employeeName: "Asha Raman", employeeEmail: `Asha.${uid}@Example.com`, deviceToken: `device-${uid}-1` };
  const r1 = await anon.post(`/api/public/events/${ev.registrationSlug}/register`, p1);
  expectStatus(r1, 201, "register p1");
  const pass1 = r1.data.pass;
  assert.equal(pass1.employeeId, `E${uid}1`, "employee ID upper-cased");
  assert.equal(pass1.employeeEmail, `asha.${uid.toLowerCase()}@example.com`, "email lower-cased");
  assert.ok(pass1.qrToken.length >= 20);
  assert.ok(["LOGGED", "SENT"].includes(pass1.emailStatus), `email status ${pass1.emailStatus}`);
  ok("participant registered and got a QR pass");

  expectCode(await anon.post(`/api/public/events/${ev.registrationSlug}/register`, { ...p1, employeeEmail: `other.${uid}@example.com`, deviceToken: `device-${uid}-x` }), 409, "DUPLICATE_EMPLOYEE", "dup employee");
  ok("duplicate employee ID blocked");
  expectCode(await anon.post(`/api/public/events/${ev.registrationSlug}/register`, { ...p1, employeeId: `e${uid}x`, deviceToken: `device-${uid}-y` }), 409, "DUPLICATE_EMAIL", "dup email");
  ok("duplicate email blocked");
  expectCode(await anon.post(`/api/public/events/${ev.registrationSlug}/register`, { ...p1, employeeId: `e${uid}z`, employeeEmail: `z.${uid}@example.com` }), 409, "DUPLICATE_DEVICE", "dup device");
  ok("same device blocked");
  expectCode(await anon.post(`/api/public/events/${ev.registrationSlug}/register`, { employeeId: "x", employeeName: "y", employeeEmail: "not-an-email" }), 400, "VALIDATION_ERROR", "bad email");
  ok("invalid email rejected");

  const passApi = await anon.get(`/api/public/pass/${pass1.qrToken}`);
  expectStatus(passApi, 200, "pass api");
  const passPng = await anon.get(`/api/public/pass/${pass1.qrToken}/qr`, { raw: true });
  assert.equal(passPng.headers.get("content-type"), "image/png");
  ok("pass page data and QR image");

  // --- Scanner account ---
  const scanCode = `SCAN${uid}`;
  expectStatus(await hr.post("/api/staff", { employeeCode: scanCode, name: "Gate Desk", role: "SCANNER_OPERATOR", password: "scanner-pass-1" }), 201, "create scanner");
  const scanner = new Client();
  expectStatus(await scanner.post("/api/auth/login", { employeeCode: scanCode, password: "scanner-pass-1" }), 200, "scanner login");
  expectCode(await scanner.post("/api/events", {}), 403, "FORBIDDEN", "scanner create event");
  ok("scanner account created; cannot manage events");

  const scan = (token, stage, eventId = ev.id) => scanner.post("/api/scan/stage", { qrToken: token, stage, locationName: "Gate A", eventId });

  expectCode(await scan(pass1.qrToken, "ENTRY"), 409, "EVENT_NOT_ACTIVE", "scan before open");
  ok("scanning blocked before the event is opened");
  expectStatus(await hr.post(`/api/events/${ev.id}/actions`, { action: "open" }), 200, "open event");

  expectCode(await scan(pass1.qrToken, "FOOD"), 409, "NOT_CHECKED_IN", "food before entry");
  ok("food blocked before entry");
  expectStatus(await scan(pass1.qrToken, "ENTRY"), 201, "entry");
  ok("entry accepted");
  const dupEntry = await scan(pass1.qrToken, "ENTRY");
  expectCode(dupEntry, 409, "ALREADY_SCANNED", "dup entry");
  assert.equal(dupEntry.data.error.details.previousLocation, "Gate A");
  ok("duplicate entry blocked (shows where it was first scanned)");
  expectStatus(await scan(pass1.qrToken, "FOOD"), 201, "food");
  expectCode(await scan(pass1.qrToken, "FOOD"), 409, "ALREADY_SCANNED", "dup food");
  ok("food accepted once, duplicate blocked");
  expectStatus(await scan(pass1.qrToken, "GOODIES"), 201, "goodies");
  ok("goodies accepted");
  expectCode(await scan("not-a-real-token-123", "ENTRY"), 404, "INVALID_QR", "invalid qr");
  ok("unknown QR rejected");

  // Race: five desks scan the same pass at the same moment.
  const p2 = { employeeId: `e${uid}2`, employeeName: "Ben Okafor", employeeEmail: `ben.${uid}@example.com`, deviceToken: `device-${uid}-2` };
  const pass2 = (await anon.post(`/api/public/events/${ev.registrationSlug}/register`, p2)).data.pass;
  const race = await Promise.all(Array.from({ length: 5 }, () => scan(pass2.qrToken, "ENTRY")));
  assert.equal(race.filter((r) => r.status === 201).length, 1, `exactly one concurrent scan should win: ${race.map((r) => r.status)}`);
  assert.equal(race.filter((r) => r.data?.error?.code === "ALREADY_SCANNED").length, 4);
  ok("five simultaneous scans of one pass: exactly one recorded");

  // --- Walk-ins ---
  const walk = await anon.post(`/api/public/walkins/${ev.walkinSlug}/register`, { employeeId: `w${uid}`, employeeName: "Chitra Walkin", employeeEmail: `walk.${uid}@example.com`, deviceToken: `device-${uid}-w` });
  expectStatus(walk, 201, "walk-in");
  assert.equal(walk.data.pass.source, "WALKIN");
  expectStatus(await scan(walk.data.pass.qrToken, "ENTRY"), 201, "walk-in entry");
  ok("walk-in registered and checked in");
  expectStatus(await hr.post(`/api/events/${ev.id}/actions`, { action: "walkins-close" }), 200, "close walk-ins");
  expectCode(await anon.post(`/api/public/walkins/${ev.walkinSlug}/register`, { employeeId: `w${uid}b`, employeeName: "Late", employeeEmail: `late.${uid}@example.com` }), 409, "REGISTRATION_CLOSED", "walk-in closed");
  ok("walk-ins blocked after HR closes them");
  expectStatus(await hr.post(`/api/events/${ev.id}/actions`, { action: "registration-close" }), 200, "close reg");
  expectCode(await anon.post(`/api/public/events/${ev.registrationSlug}/register`, { employeeId: `n${uid}`, employeeName: "Late", employeeEmail: `n.${uid}@example.com` }), 409, "REGISTRATION_CLOSED", "reg closed");
  expectStatus(await hr.post(`/api/events/${ev.id}/actions`, { action: "registration-extend", until: iso(30) }), 200, "extend reg");
  expectStatus(await anon.post(`/api/public/events/${ev.registrationSlug}/register`, { employeeId: `n${uid}`, employeeName: "Late But Ok", employeeEmail: `n.${uid}@example.com` }), 201, "reg after extend");
  ok("registration close and extend work");

  // --- Dashboard ---
  const dash = await scanner.get(`/api/events/${ev.id}/dashboard`);
  expectStatus(dash, 200, "dashboard");
  const d = dash.data;
  assert.equal(d.registered, 4, "registered");
  assert.equal(d.walkins, 1, "walkins");
  assert.equal(d.normal, 3, "normal");
  assert.equal(d.checkedIn, 3, "checked in");
  assert.equal(d.pending, 1, "pending");
  assert.equal(d.food, 1, "food");
  assert.equal(d.goodies, 1, "goodies");
  assert.ok(d.activity.length > 0);
  ok("dashboard counts match (registered 4, checked in 3, food 1, goodies 1, walk-ins 1)");

  // --- CSV ---
  const csv = await hr.get(`/api/events/${ev.id}/export`, { raw: true });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type") || "", /text\/csv/);
  const body = (await csv.text()).replace(/^﻿/, "");
  const lines = body.trim().split(/\r\n/);
  assert.equal(lines.length, 5, "header + 4 rows");
  assert.match(lines[0], /"employeeId","employeeName","employeeEmail","source","registeredAt","qrToken","entryStatus"/);
  assert.match(lines[0], /foodStatus/);
  assert.match(lines[0], /goodiesStatus/);
  assert.ok(body.includes('"WALKIN"'));
  ok("CSV export has header, food/goodies columns and all rows");

  // --- Capacity under concurrency ---
  const small = (await hr.post("/api/events", { name: `Cap test ${uid}`, venue: "Room 1", startsAt: iso(60), capacity: 3, stages: "ENTRY", walkinsEnabled: false })).data.event;
  const burst = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      anon.post(`/api/public/events/${small.registrationSlug}/register`, { employeeId: `c${uid}${i}`, employeeName: `Cap ${i}`, employeeEmail: `cap${i}.${uid}@example.com`, deviceToken: `dev-cap-${uid}-${i}` }),
    ),
  );
  assert.equal(burst.filter((r) => r.status === 201).length, 3, `capacity 3 should admit exactly 3: ${burst.map((r) => r.status)}`);
  assert.equal(burst.filter((r) => r.data?.error?.code === "EVENT_FULL").length, 3);
  ok("six simultaneous sign-ups for 3 places: exactly 3 admitted");

  // Scanning a pass at the wrong event's desk.
  expectStatus(await hr.post(`/api/events/${small.id}/actions`, { action: "open" }), 200, "open small");
  expectCode(await scan(pass2.qrToken, "ENTRY", small.id), 409, "WRONG_EVENT", "wrong event");
  ok("pass from another event rejected");
  expectCode(await scan(pass2.qrToken, "FOOD", small.id), 409, "WRONG_EVENT", "wrong event food");

  // --- Completion ---
  expectStatus(await hr.post(`/api/events/${ev.id}/actions`, { action: "complete" }), 200, "complete");
  expectCode(await scan(pass2.qrToken, "FOOD"), 409, "EVENT_NOT_ACTIVE", "scan after complete");
  ok("scanning blocked after the event is completed");

  // --- Staff management ---
  const staff = (await hr.get("/api/staff")).data.staff;
  const scannerUser = staff.find((s) => s.employeeCode === scanCode);
  expectStatus(await hr.patch(`/api/staff/${scannerUser.id}`, { active: false }), 200, "deactivate");
  expectCode(await scanner.get("/api/auth/me"), 401, "UNAUTHENTICATED", "deactivated session");
  ok("deactivated scanner loses access immediately");

  expectStatus(await hr.post("/api/auth/logout"), 200, "logout");
  expectCode(await hr.get("/api/events"), 401, "UNAUTHENTICATED", "after logout");
  ok("sign out");

  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((err) => {
  console.error(`\n✗ Failed after ${passed} passing checks:\n`, err);
  process.exit(1);
});
