var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.staging.js
var FIREBASE_IDENTITY = "https://identitytoolkit.googleapis.com/v1";
var FIREBASE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
var CUSTOM_TOKEN_AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
var jwksCache = null;
var jwksFetchedAt = 0;
var serviceTokenCache = null;
var readCache = /* @__PURE__ */ new Map();
var READ_CACHE_MS = 8e3;
var index_staging_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (new URL(request.url).pathname === "/health") return json({ ok: true, service: "talaan-api" }, 200, cors);
    if (request.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405, cors);
    if (!originAllowed(origin, env)) return json({ success: false, error: "Origin not allowed." }, 403, cors);
    try {
      const declaredLength = Number(request.headers.get("Content-Length") || 0);
      if (declaredLength > 9e5) return json({ success: false, error: "Request is too large." }, 413, cors);
      const rawBody = await request.text();
      if (rawBody.length > 9e5) return json({ success: false, error: "Request is too large." }, 413, cors);
      const body = JSON.parse(rawBody || "{}");
      const action = norm(body.action || "");
      const params = body.params && typeof body.params === "object" ? body.params : {};
      const result = await route(action, params, request, env);
      return json(result, result && result.success === false ? 400 : 200, cors);
    } catch (error) {
      console.error("TALAAN API error", error && error.message ? error.message : error);
      return json({ success: false, error: safeError(error) }, error && error.statusCode || 400, cors);
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runCutoffAutomation(env));
  }
};
function corsHeaders(origin, env) {
  const allowed = originAllowed(origin, env);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}
__name(corsHeaders, "corsHeaders");
function originAllowed(origin, env) {
  if (!origin) return true;
  const list = String(env.APP_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
  return list.includes(origin) || origin === "http://localhost:5000" || origin === "http://127.0.0.1:5000";
}
__name(originAllowed, "originAllowed");
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers });
}
__name(json, "json");
function safeError(e) {
  if (e && e.publicMessage) return e.publicMessage;
  const m = e && e.message ? String(e.message) : "";
  if (/firestore|permission_denied|service account|oauth|invalid_grant|identitytoolkit/i.test(m)) return "The TALAAN server could not complete this request. Please contact the administrator.";
  return m || "Request failed.";
}
__name(safeError, "safeError");
function fail(message) {
  const e = new Error(message);
  e.publicMessage = message;
  throw e;
}
__name(fail, "fail");
function clean(v) {
  return v === null || v === void 0 ? "" : String(v).trim();
}
__name(clean, "clean");
function norm(v) {
  return clean(v).toLowerCase().replace(/\s+/g, " ");
}
__name(norm, "norm");
function normCode(v) {
  return clean(v).toUpperCase().replace(/\s+/g, "");
}
__name(normCode, "normCode");
function round2(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}
__name(round2, "round2");
function yearLabel(y) {
  return { "1": "1ST YEAR", "2": "2ND YEAR", "3": "3RD YEAR", "4": "4TH YEAR" }[String(y)] || `${y} YEAR`;
}
__name(yearLabel, "yearLabel");
function todayManila() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(/* @__PURE__ */ new Date());
  const m = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return `${m.year}-${m.month}-${m.day}`;
}
__name(todayManila, "todayManila");
function manilaClock() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(/* @__PURE__ */ new Date());
  const m = Object.fromEntries(p.map((x) => [x.type, x.value]));
  return `${m.hour}:${m.minute}:${m.second}`;
}
__name(manilaClock, "manilaClock");
function parseDate(v) {
  const s = clean(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return validDate(+m[3], +m[1], +m[2]);
  m = s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (m) {
    const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    let mo = months.indexOf(m[1].toLowerCase());
    if (mo < 0) mo = months.findIndex((x) => x.slice(0, 3) === m[1].toLowerCase());
    if (mo >= 0) return validDate(+(m[3] || todayManila().slice(0, 4)), mo + 1, +m[2]);
  }
  return null;
}
__name(parseDate, "parseDate");
function validDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
}
__name(validDate, "validDate");
function dateLabel(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}
__name(dateLabel, "dateLabel");
function cutoffClock(v) {
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = +m[1], min = +(m[2] || 0);
  const mer = (m[3] || "").toUpperCase();
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === "AM" && h === 12) h = 0;
    if (mer === "PM" && h !== 12) h += 12;
  } else if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
__name(cutoffClock, "cutoffClock");
function normalizeType(v) {
  const n = norm(v);
  return n === "physical" || n === "online" || n === "hybrid" ? n[0].toUpperCase() + n.slice(1) : clean(v);
}
__name(normalizeType, "normalizeType");
function sessionFromClaims(c) {
  const authTime = Number(c.auth_time || 0) * 1e3;
  return { uid: c.sub, role: c.role || "", accountId: c.accountId || "", studentId: c.studentId || "", name: c.name || "", section: c.section || "", yearLevel: c.yearLevel || "", sectionFilter: c.sectionFilter || "", position: c.position || "", course: c.course || "ALL", expiresAt: (authTime || Date.now()) + 30 * 864e5 };
}
__name(sessionFromClaims, "sessionFromClaims");
function sanitizeSession(s) {
  return { role: s.role, code: "", studentId: s.studentId || "", name: s.name || "", section: s.section || "", yearLevel: s.yearLevel || "", sectionFilter: s.sectionFilter || "", teacherScopes: s.teacherScopes || [], position: s.position || "", course: s.course || "ALL", expiresAt: s.expiresAt || Date.now() + 30 * 864e5 };
}
__name(sanitizeSession, "sanitizeSession");
async function validateLiveSession(claims, env) {
  const tokenSession = sessionFromClaims(claims);

  // Student authentication is separate from staff access-code authentication.
  // Reject tokens from revoked or unknown login sessions, for every role.
  const sid = clean(claims.talaanSid);
  if (!/^[a-f0-9]{32}$/.test(sid)) fail('Your session must be renewed. Please log in again.');
  const sessionDoc = await fsRequest(env, `authSessions/${sid}`);
  if (!sessionDoc) fail('Your session is no longer active. Please log in again.');
  const live = decodeFields(sessionDoc.fields || {});
  if (live.revoked === true || live.uid !== claims.sub || live.role !== claims.role ||
      (Number(live.createdAtMs) + 30 * 86400000) < Date.now()) {
    fail('Your session is no longer active. Please log in again.');
  }
  if (tokenSession.role === 'Student') {
    const studentId = normCode(claims.studentId);
    if (!studentId) fail('Student account could not be verified. Please log in again.');
    const studentDoc = await fsRequest(env, `students/${encodeURIComponent(studentId)}`);
    if (!studentDoc) fail('Student account no longer exists. Please contact the Secretary.');
    const student = decodeFields(studentDoc.fields || {});
    if (!student.firebaseUid || student.firebaseUid !== claims.sub || student.active === false) {
      fail('Student account is no longer active. Please log in again.');
    }
    return {...tokenSession, studentId, name:student.name || tokenSession.name,
      yearLevel:String(student.yearLevel || tokenSession.yearLevel), section:student.section || ''};
  }

  const accountId = clean(claims.accountId);
  if (!accountId || claims.sub !== `staff_${accountId.slice(0,48)}`) {
    fail('Staff account could not be verified. Please log in again.');
  }

  // Use fsRequest directly so a cached staff record cannot preserve old permissions.
  const doc = await fsRequest(env, `staffAccounts/${encodeURIComponent(accountId)}`);
  if (!doc) fail('This staff account is no longer available. Please contact the Secretary.');
  const account = decodeFields(doc.fields || {});

  if (account.active === false) {
    fail('This staff account is inactive. Please contact the Secretary.');
  }

  const allowedRoles = ['Secretary','Admin','Teacher','Class Sec'];
  if (!allowedRoles.includes(account.role) || account.role !== claims.role) {
    fail('Your staff role has changed. Please log in again.');
  }

  return {
    ...tokenSession,
    role: account.role,
    accountId,
    name: account.name || '',
    yearLevel: account.yearLevel || 'ALL',
    sectionFilter: account.sectionFilter || '',
    teacherScopes: Array.isArray(account.teacherScopes) ? account.teacherScopes : [],
    course: account.course || 'ALL',
    position: account.position || ''
  };
}

async function route(action, p, request, env) {
  if (action === 'login') {
    await enforceAuthRateLimit(request, env, 'staff', p.code);
    const role = norm(p.role || 'secretary');
    if (role !== 'secretary') fail('Invalid login role.');
    return loginStaff(p.code, ['Secretary','Class Sec'], env);
  }
  if (action === 'stafflogin') { await enforceAuthRateLimit(request, env, 'staff', p.code); return loginStaff(p.code, null, env); }
  if (action === 'studentauth') { await enforceAuthRateLimit(request, env, 'student', p.studentId || p.id); return studentAuth(p, env); }
  if (action === 'logout') {
    const claims = await verifyBearer(request, env);
    await validateLiveSession(claims, env);
    const sid = clean(claims.talaanSid);
    const doc = await fsRequest(env, `authSessions/${sid}`);
    if (!doc) fail('Session no longer exists.');
    const live = decodeFields(doc.fields || {});
    await fsSet(env, 'authSessions', sid, {...live, revoked:true, revokedAt:new Date().toISOString()});
    return { success:true, message:'Logged out successfully.' };
  }
  const claims = await verifyBearer(request, env);
  const session = await validateLiveSession(claims, env);
  const blocked = new Set(['studentdirectory','studentrecord','searchstudent','warnings','attendance','updatestudentattendance','record','updatesettings','addevent','deleteevent','v2studentcreate','v2studentupdate','v2studentdelete','v2rosterpreview','v2rosterapply','v2activityadd','v2activitydelete','v2exportdata']);
  if (session.role === 'Student' && blocked.has(action)) fail('Student access is limited to Dashboard, Profile, Settings, and Logout.');
  // All authenticated staff routes are checked individually below; student roles are blocked explicitly.
  switch (action) {
    case 'v2studentcreate': return v2StudentCreate(p, session, env);
    case 'v2studentupdate': return v2StudentUpdate(p, session, env);
    case 'v2studentdelete': return v2StudentDelete(p, session, env);
    case 'v2rosterpreview': return v2RosterPreview(p, session, env);
    case 'v2rosterapply': return v2RosterApply(p, session, env);
    case 'v2activities': return v2Activities(session, env);
    case 'v2activityadd': return v2ActivityAdd(p, session, env);
    case 'v2activitydelete': return v2ActivityDelete(p, session, env);
    case 'v2exportdata': return v2ExportData(p, session, env);
    case 'dashboard': return dashboard(p, session, env);
    case 'attendance': return attendance(p, session, env);
    case 'warnings': return warnings(session, env);
    case 'searchstudent': return searchStudent(p, session, env);
    case 'studentrecord': return studentRecord(p, session, env);
    case 'studentdirectory': return studentDirectory(session, env);
    case 'profile': return profile(session, env);
    case 'accountsettings': return accountSettings(session, env);
    case 'updateaccountsettings': return updateAccountSettings(p, session, env);
    case 'changepassword': return changePassword(p, session, env);
    case 'updatesettings': requireRole(session,['Secretary']); return updateEvent(p, session, env);
    case 'addevent': requireRole(session,['Secretary']); return addEvent(p, session, env);
    case 'deleteevent': requireRole(session,['Secretary']); return deleteEvent(p, session, env);
    case 'record': requireRole(session,['Secretary']); return recordAttendance(p, session, env);
    case 'updatestudentattendance': requireRole(session,['Secretary','Class Sec']); return updateStudentAttendance(p, session, env);
    default: fail(`Unknown API action: ${action}`);
  }
}
function requireRole(s, roles) {
  if (!roles.includes(s.role)) fail("You are not authorized to access this feature.");
}
__name(requireRole, "requireRole");
async function enforceAuthRateLimit(request, env, bucket, identifier) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const accountKey = await hmacHex(env.TALAAN_PEPPER, `login:${bucket}:${normCode(identifier) || "missing"}`);
  const ipResult = await env.LOGIN_IP_LIMITER.limit({ key: `${bucket}:${ip}` });
  const accountResult = await env.ACCOUNT_LOGIN_LIMITER.limit({ key: accountKey });
  if (!ipResult.success || !accountResult.success) {
    const e = new Error("Too many sign-in attempts. Wait one minute and try again.");
    e.publicMessage = e.message;
    e.statusCode = 429;
    throw e;
  }
}
__name(enforceAuthRateLimit, "enforceAuthRateLimit");
function studentMatchesAccess(st, s) {
  if (s.role === "Secretary" || s.role === "Admin") return true;
  if (s.role === "Student") return st.id === s.studentId;
  if (s.role === "Class Sec") return !!clean(s.sectionFilter) && norm(st.section) === norm(s.sectionFilter) && (String(s.yearLevel) === 'ALL' || String(st.yearLevel) === String(s.yearLevel));
  if (s.role === "Teacher") return (s.teacherScopes || []).some(x => String(x.yearLevel) === String(st.yearLevel) && norm(x.section) === norm(st.section));
  return false;
}
__name(studentMatchesAccess, "studentMatchesAccess");
async function loginStaff(rawCode, expectedRole, env) {
  const code = normCode(rawCode); if (!code) fail('Access code is required.');
  const accountId = await hmacHex(env.TALAAN_PEPPER, `staff:${code}`);
  const account = await fsGet(env, 'staffAccounts', accountId);
  if (!account || account.active === false) fail(expectedRole ? 'Invalid Secretary access code.' : 'Invalid TALAAN authorization code.');
  if (expectedRole && !(Array.isArray(expectedRole) ? expectedRole.includes(account.role) : account.role === expectedRole)) fail('Invalid Secretary access code.');
  const uid = `staff_${accountId.slice(0,48)}`;
  const claims = { role:account.role, accountId, name:account.name || '', yearLevel:account.yearLevel || 'ALL', sectionFilter:account.sectionFilter || '', course:account.course || 'ALL', position:account.position || '' };
  const talaanSid = [...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
  await fsSet(env, 'authSessions', talaanSid, {uid, role:account.role, revoked:false, createdAtMs:Date.now()});
  const customToken = await createCustomToken(env, uid, {...claims, talaanSid});
  return { success:true, message:'Login successful.', customToken, session:sanitizeSession({...claims, studentId:'', section:''}) };
}
async function studentAuth(p, env) {
  const id = normCode(p.studentId || p.id); const mode = norm(p.mode || 'login'); const password = String(p.password || '');
  if (!id || !password) fail('Student TALAAN ID and password are required.');
  const student = await fsGet(env, 'students', id); if (!student || student.active === false) fail('TALAAN ID not found or inactive. Please contact the TALAAN administrator.');
  const email = studentAuthEmail(id);
  let authResult;
  if (mode === 'create') {
    const pin = clean(p.enrollmentPin); if (!pin) fail('Enter your one-time enrollment PIN.');
    if (student.firebaseUid) fail('This student account already exists. Please use Log In.');
    const expected = await hmacHex(env.TALAAN_PEPPER, `enroll:${id}:${pin}`);
    if (!student.enrollmentPinHash || !constantTimeEqual(expected, student.enrollmentPinHash)) fail('Invalid enrollment PIN. Please contact the TALAAN administrator.');
    if (password.length < 6) fail('Password must be at least 6 characters.');
    try {
      authResult = await identityRequest(env, 'accounts:signUp', { email, password, returnSecureToken:true });
    } catch (signupError) {
      // Recover safely if Auth account creation succeeded but the Firestore link failed,
      // or if two first-time enrollment requests arrived at nearly the same time.
      if (!String(signupError.message || '').toLowerCase().includes('already exists')) throw signupError;
      authResult = await identityRequest(env, 'accounts:signInWithPassword', { email, password, returnSecureToken:true });
    }
    await fsPatch(env, 'students', id, { firebaseUid:authResult.localId, enrollmentPinHash:null, accountCreatedAt:new Date().toISOString() });
  } else if (mode === 'login') {
    if (!student.firebaseUid) fail('No account exists for this TALAAN ID yet. Choose Create Account first.');
    authResult = await identityRequest(env, 'accounts:signInWithPassword', { email, password, returnSecureToken:true });
    if (authResult.localId !== student.firebaseUid) fail('Student account verification failed.');
  } else fail('Invalid student authentication mode.');
  const uid = student.firebaseUid || authResult.localId;
  const talaanSid = [...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
  await fsSet(env, 'authSessions', talaanSid, {uid, role:'Student', revoked:false, createdAtMs:Date.now()});
  const customToken = await createCustomToken(env, uid, { role:'Student', studentId:id, name:student.name, section:student.section, yearLevel:String(student.yearLevel), position:'Student', talaanSid });
  return { success:true, message:mode==='create'?'Student account created successfully.':'Student login successful.', customToken, session:sanitizeSession({role:'Student',studentId:id,name:student.name,section:student.section,yearLevel:String(student.yearLevel),position:'Student'}) };
}
function studentAuthEmail(id) {
  return `talaan-${id.toLowerCase()}@students.ssg-talaan.invalid`;
}
__name(studentAuthEmail, "studentAuthEmail");
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}
__name(constantTimeEqual, "constantTimeEqual");
async function getStudentRoster(env, year) {
  // v2 uses the authoritative students collection, not separately maintained
  // appMeta snapshots. This prevents stale roster displays after imports.
  const all = (await fsList(env, "students")).filter(s => s.active !== false);
  return year ? all.filter(s => String(s.yearLevel) === String(year)) : all;
}
__name(getStudentRoster, "getStudentRoster");
async function getEventStatusMaps(events, env) {
  return Promise.all(events.map(async (e) => {
    const doc = await fsGet(env, "eventStats", e.date);
    if (doc?.statuses) return doc.statuses;
    const fallback = await fsQuery(env, "attendance", "date", e.date);
    return Object.fromEntries(fallback.map((r) => [r.studentId, r.status]));
  }));
}
__name(getEventStatusMaps, "getEventStatusMaps");
function summarizeFromEventStats(studentId, maps) {
  let present = 0, absent = 0;
  for (const map of maps) {
    const status = norm(map?.[studentId]);
    if (status === "present") present++;
    else if (status === "absent") absent++;
  }
  const held = present + absent;
  return { present, absent, rate: held ? round2(present / held * 100) : 0 };
}
__name(summarizeFromEventStats, "summarizeFromEventStats");
async function updateRosterSnapshot(student, changes, env) {
  if (!student || !student.yearLevel) return;
  const docId = `studentRoster${student.yearLevel}`;
  const doc = await fsGet(env, "appMeta", docId);
  if (!doc || !Array.isArray(doc.students)) return;
  const updated = doc.students.map((x) => x.id === student.id ? { ...x, ...changes } : x);
  await fsSet(env, "appMeta", docId, { yearLevel: String(student.yearLevel), students: updated });
}
__name(updateRosterSnapshot, "updateRosterSnapshot");
async function dashboard(p, session, env) {
  const [allStudents, events] = await Promise.all([getStudentRoster(env), getEvents(env)]);
  // Dashboard aggregates are global for Admin, Secretary, and Teacher.
  // Student-level record endpoints retain their separate scope checks.
  const globalDashboard = ["Admin", "Secretary", "Teacher"].includes(session.role);
  const students = allStudents.filter((s) => s.active !== false && (globalDashboard || studentMatchesAccess(s, session)));
  const requested = parseDate(p.date || p.selectedDate || p.eventDate);
  const selectedDate = requested || latestDate(events) || "";
  let statusMap = selectedDate ? await fsGet(env, "eventStats", selectedDate) : null;
  let statuses = statusMap?.statuses || null;
  if (selectedDate && !statuses) {
    const fallback = await fsQuery(env, "attendance", "date", selectedDate);
    statuses = Object.fromEntries(fallback.map((x) => [x.studentId, x.status]));
  }
  statuses = statuses || {};
  const years = [];
  let totalStudents = 0, totalPresent = 0, totalAbsent = 0, totalNotYetHeld = 0;
  for (let y = 1; y <= 4; y++) {
    const group = students.filter((s) => String(s.yearLevel) === String(y));
    const yr = { yearLevel: String(y), label: yearLabel(y), totalStudents: group.length, present: 0, absent: 0, notYetHeld: 0, percentage: 0, rate: 0, sections: [] };
    const sections = /* @__PURE__ */ new Map();
    for (const st of group) {
      const sec = st.section || "";
      if (!sections.has(sec)) sections.set(sec, { total: 0, present: 0, absent: 0, notYetHeld: 0 });
      const ss = sections.get(sec);
      ss.total++;
      const status = norm(statuses[st.id]);
      if (status === "present") {
        yr.present++;
        ss.present++;
      } else if (status === "absent") {
        yr.absent++;
        ss.absent++;
      } else if (status === "not yet held" || !status) {
        yr.notYetHeld++;
        ss.notYetHeld++;
      }
    }
    const held2 = yr.present + yr.absent;
    yr.percentage = held2 ? round2(yr.present / held2 * 100) : 0;
    yr.rate = yr.percentage;
    yr.sections = [...sections.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([section, x]) => {
      const h = x.present + x.absent;
      const r = h ? round2(x.present / h * 100) : 0;
      return { section, totalStudents: x.total, present: x.present, absent: x.absent, notYetHeld: x.notYetHeld, percentage: r, rate: r };
    });
    totalStudents += yr.totalStudents;
    totalPresent += yr.present;
    totalAbsent += yr.absent;
    totalNotYetHeld += yr.notYetHeld;
    years.push(yr);
  }
  const held = totalPresent + totalAbsent;
  const ranked = years.filter((y) => y.present + y.absent > 0);
  const selectedEvent = events.find((e) => e.date === selectedDate);
  const result = { success: true, selectedDate, selectedHeader: selectedDate ? dateLabel(selectedDate) : "", dashboard: { totalStudents, present: totalPresent, absent: totalAbsent, notYetHeldCount: totalNotYetHeld, attendanceRate: held ? round2(totalPresent / held * 100) : 0, years, highestAttendance: ranked.length ? pickYear(ranked.reduce((a, b) => b.percentage > a.percentage ? b : a)) : null, lowestAttendance: ranked.length ? pickYear(ranked.reduce((a, b) => b.percentage < a.percentage ? b : a)) : null, event: selectedEvent?.event || "", notYetHeld: totalNotYetHeld > 0 }, settings: session.role === "Secretary" ? await settingsMatrix(env, events) : [], events: events.slice().sort((a, b) => b.date.localeCompare(a.date)).map((e) => ({ ...e, row: e.row })), upcomingEvents: await fsList(env, "upcomingEvents"), attendanceSheets: [] };
  if (session.role !== "Secretary") {
    result.settings = [];
    result.attendanceSheets = [];
  }
  result.session = sanitizeSession(session);
  return result;
}
__name(dashboard, "dashboard");
function pickYear(y) {
  return { yearLevel: y.yearLevel, label: y.label, percentage: y.percentage };
}
__name(pickYear, "pickYear");
function latestDate(events) {
  return events.reduce((m, e) => e.date > m ? e.date : m, "");
}
__name(latestDate, "latestDate");
async function getEvents(env) {
  const rows = await fsList(env, "events");
  return rows.sort((a, b) => a.order - b.order).map((e) => ({ ...e, row: e.order + 2, date: e.date, event: e.event, cutoff: e.cutoff || "", status: e.status || "", type: e.type || "" }));
}
__name(getEvents, "getEvents");
async function settingsMatrix(env, events) {
  const rows = await getEvents(env);
  return [["Date", "Cut-off", "Event", "Status", "TYPE"], ...rows.map((e) => [dateLabel(e.date), e.cutoff, e.event, e.status, e.type])];
}
__name(settingsMatrix, "settingsMatrix");
async function attendance(p, session, env) {
  const req = clean(p.sheet || p.year || p.yearLevel || "Attendance1");
  let year = (req.match(/[1-4]/) || ["1"])[0];
  if (!["Secretary", "Admin", "Teacher", "Class Sec"].includes(session.role) || (session.role === "Class Sec" && session.yearLevel !== "ALL" && String(session.yearLevel) !== year)) fail("You are not authorized to view this year level attendance.");
  const [students, events] = await Promise.all([getStudentRoster(env, year), getEvents(env)]);
  const visible = students.filter((s) => s.active !== false && studentMatchesAccess(s, session)).sort((a, b) => a.name.localeCompare(b.name));
  const statusMaps = await getEventStatusMaps(events, env);
  const data = [["NAME", "SECTION", ...events.map((e) => dateLabel(e.date))]];
  for (const st of visible) data.push([st.name, st.section, ...events.map((e, i) => statusMaps[i]?.[st.id] || "Not Yet Held")]);
  return { success: true, sheet: `Attendance${year}`, data };
}
__name(attendance, "attendance");
async function warnings(session, env) {
  const [students, events] = await Promise.all([getStudentRoster(env), getEvents(env)]);
  const maps = await getEventStatusMaps(events, env);
  const out = [];
  for (const st of students) {
    if (st.active === false || !studentMatchesAccess(st, session)) continue;
    const sum = summarizeFromEventStats(st.id, maps);
    if (sum.absent < 3) continue;
    out.push({ name: st.name, section: st.section, yearLevel: String(st.yearLevel), present: sum.present, absent: sum.absent, rate: sum.rate, warning: true, warningLevel: sum.absent >= 5 ? "CRITICAL" : "WARNING" });
  }
  out.sort((a, b) => b.absent - a.absent || a.name.localeCompare(b.name));
  return { success: true, warnings: out };
}
__name(warnings, "warnings");
async function searchStudent(p, session, env) {
  const q = norm(p.query || p.name || "");
  if (!q) fail("Search name is required.");
  const [roster, events] = await Promise.all([getStudentRoster(env), getEvents(env)]);
  const students = roster.filter((s) => s.active !== false && norm(s.name).includes(q) && studentMatchesAccess(s, session));
  const maps = await getEventStatusMaps(events, env);
  const result = [];
  for (const st of students) {
    const sum = summarizeFromEventStats(st.id, maps);
    result.push({ name: st.name, section: st.section, yearLevel: String(st.yearLevel), studentId: st.id, present: sum.present, absent: sum.absent, rate: sum.rate, warning: sum.absent >= 3, warningLevel: sum.absent >= 5 ? "CRITICAL" : sum.absent >= 3 ? "WARNING" : "NONE" });
  }
  result.sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, students: result };
}
__name(searchStudent, "searchStudent");
async function studentDirectory(session, env) {
  requireRole(session, ["Secretary", "Class Sec", "Teacher", "Admin"]);
  const students = (await fsList(env, "students")).filter((s) => s.active !== false && studentMatchesAccess(s, session)).sort((a, b) => a.name.localeCompare(b.name));
  return { success: true, students: students.map((s) => ({ name: s.name, section: s.section, yearLevel: String(s.yearLevel), studentId: s.id, accountCreated: !!s.firebaseUid, warning: false, warningLevel: "" })) };
}
__name(studentDirectory, "studentDirectory");
async function studentRecord(p, session, env) {
  if (session.role === "Student") fail("Student attendance records are available only to authorized staff accounts.");
  const students = await fsList(env, "students");
  let st = p.studentId || p.id ? await fsGet(env, "students", normCode(p.studentId || p.id)) : null;
  if (!st) st = students.find((x) => norm(x.name) === norm(p.name) && norm(x.section) === norm(p.section) && String(x.yearLevel) === String(p.yearLevel));
  if (!st) fail("Student record could not be found.");
  if (st.active === false || !studentMatchesAccess(st, session)) fail("You are not authorized to view this student record.");
  const summary = await attendanceSummary(st, env);
  const manual = await currentManual(st, session, env);
  return { success: true, profile: { role: "Student", name: st.name, section: st.section, yearLevel: String(st.yearLevel), studentId: st.id, profilePicture: st.profilePicture || "", attendance: summary, manualEdit: manual } };
}
__name(studentRecord, "studentRecord");
async function profile(session, env) {
  if (session.role !== "Student") return { success: true, profile: { role: session.role, name: session.name || session.role, yearLevel: session.yearLevel || "ALL", section: "", sectionFilter: session.sectionFilter || "" } };
  const st = await fsGet(env, "students", session.studentId);
  if (!st) fail("Student record could not be found.");
  return { success: true, profile: { role: "Student", name: st.name, section: st.section, yearLevel: String(st.yearLevel), studentId: st.id, attendance: await attendanceSummary(st, env) } };
}
__name(profile, "profile");
async function attendanceSummary(st, env) {
  const [records, events, logs] = await Promise.all([fsQuery(env, "attendance", "studentId", st.id), getEvents(env), fsQuery(env, "attendanceLogs", "studentId", st.id)]);
  const logMap = /* @__PURE__ */ new Map();
  logs.filter((l) => !l.manual && !l.manualCorrection && clean(l.scanTime)).sort((a, b) => Number(a.logOrder || 0) - Number(b.logOrder || 0)).forEach((l) => {
    if (!logMap.has(l.date)) logMap.set(l.date, l);
  });
  const eventMap = new Map(events.map((e) => [e.date, e]));
  let present = 0, absent = 0;
  const out = [];
  for (const r of records.sort((a, b) => a.date.localeCompare(b.date))) {
    if (r.date > todayManila()) continue;
    const status = norm(r.status);
    if (status !== "present" && status !== "absent") continue;
    if (status === "present") present++;
    else absent++;
    const e = eventMap.get(r.date) || {};
    const l = logMap.get(r.date) || {};
    const time = r.manualCorrection ? "" : l.scanTime || r.scanTime || "";
    out.push({ date: r.date, dateLabel: dateLabel(r.date), event: e.event || r.eventName || "", eventType: e.type || r.eventType || "", time, status: status === "present" ? "Present" : "Absent" });
  }
  const held = present + absent;
  return { present, absent, rate: held ? round2(present / held * 100) : 0, warning: absent >= 3, warningLevel: absent >= 3 ? absent <= 5 ? "3-5 ABSENCES" : "6+ ABSENCES" : "NONE", records: out };
}
__name(attendanceSummary, "attendanceSummary");
async function currentManual(st, session, env) {
  const today = todayManila();
  if (!["Secretary", "Class Sec"].includes(session.role) || !studentMatchesAccess(st, session)) return { available: false, editable: false, events: [], reason: "Manual attendance correction is limited to the Secretary and assigned Class Secretary." };
  const events = (await getEvents(env)).filter((e) => parseDate(e.date) === e.date && e.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  if (!events.length) return { available: false, editable: false, events: [], reason: "No eligible event dates are available." };
  const records = await fsQuery(env, "attendance", "studentId", st.id);
  const statusByDate = new Map(records.map((r) => [r.date, r.status]));
  const options = events.map((e) => ({ date: e.date, dateLabel: dateLabel(e.date), event: e.event || "", eventType: e.type || "", status: statusByDate.get(e.date) || "Not Yet Held" }));
  return { available: true, editable: true, events: options };
}
__name(currentManual, "currentManual");
async function accountSettings(session, env) {
  const isStudent = session.role === "Student";
  const doc = isStudent ? await fsGet(env, "students", session.studentId) : await fsGet(env, "staffAccounts", session.accountId);
  if (!doc) fail("Account record could not be found.");
  return { success: true, settings: { role: session.role, name: doc.name || session.name || "", position: doc.position || session.position || "", profilePicture: doc.profilePicture || "", nameParts: parseNameParts(doc.name || session.name || ""), teacherScopes: session.role === "Teacher" ? (doc.teacherScopes || []) : [], availableTeacherScopes: session.role === "Teacher" ? [...new Map((await getStudentRoster(env)).map(x => [`${x.yearLevel}:${norm(x.section)}`, {yearLevel:String(x.yearLevel),section:String(x.section)}])).values()].sort((a,b)=>a.yearLevel.localeCompare(b.yearLevel)||a.section.localeCompare(b.section)) : [] } };
}
__name(accountSettings, "accountSettings");
function parseNameParts(name) {
  const a = clean(name).split(/\s+/);
  return { firstName: a[0] || "", middleName: a.length > 2 ? a.slice(1, -1).join(" ") : "", lastName: a.length > 1 ? a[a.length - 1] : "" };
}
__name(parseNameParts, "parseNameParts");
async function updateAccountSettings(p, session, env) {
  const isStudent = session.role === "Student";
  const col = isStudent ? "students" : "staffAccounts";
  const id = isStudent ? session.studentId : session.accountId;
  const doc = await fsGet(env, col, id);
  if (!doc) fail("Account record could not be found.");
  const changes = {};
  const name = clean(p.name);
  // Student identity is managed by authorized Edit Records staff only.
  // A direct student self-rename would bypass the roster revision and
  // attendance-history synchronization safeguards.
  if (isStudent && name && name !== clean(doc.name)) fail('Student name changes must be requested through Edit Records.');
  if (!isStudent && name) changes.name = name;
  if (p.profilePicture !== void 0) {
    const pic = String(p.profilePicture || "");
    if (pic.length > 5e5) fail("Profile picture is too large. Please use a smaller image.");
    if (pic && !/^data:image\/(png|jpeg|webp);base64,/i.test(pic)) fail("Unsupported profile picture format.");
    changes.profilePicture = pic;
  }
  if (session.role === 'Teacher' && p.teacherScopes !== undefined) {
    if (!Array.isArray(p.teacherScopes) || p.teacherScopes.length > 50) fail('Invalid teacher section selection.');
    changes.teacherScopes = p.teacherScopes.map(x => ({yearLevel:String(x.yearLevel), section:clean(x.section)}));
    if (changes.teacherScopes.some(x => !/^[1-4]$/.test(x.yearLevel) || !/^[a-z0-9 -]{1,40}$/i.test(x.section))) fail('Invalid year level or section.');
    const roster = await getStudentRoster(env);
    const allowed = new Set(roster.map(x => `${x.yearLevel}:${norm(x.section)}`));
    if (changes.teacherScopes.some(x => !allowed.has(`${x.yearLevel}:${norm(x.section)}`))) fail('Choose an existing section.');
  }
  await fsPatch(env, col, id, changes);
  return { success: true, session: sanitizeSession({ ...session, name: name || session.name, teacherScopes: changes.teacherScopes || session.teacherScopes }), profilePicture: changes.profilePicture !== void 0 ? changes.profilePicture : doc.profilePicture || "" };
}
__name(updateAccountSettings, "updateAccountSettings");
async function changePassword(p, session, env) {
  if (session.role !== "Student") fail("Password changes are available for student accounts.");
  const st = await fsGet(env, "students", session.studentId);
  if (!st?.firebaseUid) fail("Student account could not be found.");
  const current = String(p.currentPassword || ""), next = String(p.newPassword || "");
  if (!current || !next) fail("Current and new password are required.");
  if (next.length < 6) fail("New password must be at least 6 characters.");
  const auth = await identityRequest(env, "accounts:signInWithPassword", { email: studentAuthEmail(st.id), password: current, returnSecureToken: true });
  if (auth.localId !== st.firebaseUid) fail("Current password is incorrect.");
  await identityRequest(env, "accounts:update", { idToken: auth.idToken, password: next, returnSecureToken: true });
  return { success: true, message: "Password changed successfully." };
}
__name(changePassword, "changePassword");
async function refreshCutoffSchedule(env) {
  const events = await getEvents(env);
  const open = events.filter((e) => norm(e.status) !== "closed" && cutoffClock(e.cutoff)).map((e) => ({ date: e.date, cutoff: e.cutoff, status: e.status || "Scheduled" }));
  await fsSet(env, "appMeta", "cutoffSchedule", { events: open, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
}
__name(refreshCutoffSchedule, "refreshCutoffSchedule");
async function updateEvent(p, session, env) {
  const row = Number(p.row);
  const events = await getEvents(env);
  const ev = events.find((e) => Number(e.row) === row);
  if (!ev) fail("Invalid settings row.");
  const newDate = parseDate(p.date || ev.date);
  if (!newDate) fail("Invalid event date.");
  const cutoff = clean(p.cutoff || p.cutOff || p.time || ev.cutoff);
  const event = clean(p.event || ev.event);
  const status = clean(p.status || ev.status);
  const type = normalizeType(p.type || p.eventType || "Physical") || "Physical";
  if (newDate !== ev.date) {
    const conflict = await fsGet(env, "events", newDate);
    if (conflict) fail("An event already exists on the selected date. Resolve the date conflict first.");
    const records = await fsQuery(env, "attendance", "date", ev.date);
    const moved = records.map((r) => ({ collection: "attendance", id: `${newDate}_${r.studentId}`, data: { ...r, date: newDate, eventId: newDate, eventName: event, eventType: type } }));
    const oldStats = await fsGet(env, "eventStats", ev.date);
    const statuses = oldStats?.statuses || Object.fromEntries(records.map((r) => [r.studentId, r.status]));
    await fsBatchDelete(env, records.map((r) => ({ collection: "attendance", id: r.id })));
    await fsBatchSet(env, moved);
    await fsDelete(env, "eventStats", ev.date);
    await fsSet(env, "eventStats", newDate, { date: newDate, statuses });
  }
  await fsDelete(env, "events", ev.date);
  await fsSet(env, "events", newDate, { date: newDate, event, eventName: event, cutoff, status, type, order: ev.order });
  await syncCutoffForEvent(newDate, env);
  await refreshCutoffSchedule(env);
  return { success: true, message: "Settings updated successfully.", row, event: { event, date: newDate, cutoff, status, type } };
}
__name(updateEvent, "updateEvent");
async function addEvent(p, session, env) {
  const event = clean(p.event || p.name), date = parseDate(p.date), cutoff = clean(p.cutoff || p.cutOff || p.time), status = clean(p.status || "Scheduled"), type = normalizeType(p.type || p.eventType || "Physical") || "Physical";
  if (!event) fail("Event name is required.");
  if (!date) fail("Valid event date is required.");
  if (await fsGet(env, "events", date)) fail("An event already exists on this date.");
  const students = await fsList(env, "students");
  const events = await getEvents(env);
  const order = events.reduce((m, e) => Math.max(m, e.order), -1) + 1;
  await fsSet(env, "events", date, { date, event, eventName: event, cutoff, status, type, order });
  const writes = students.map((st) => ({ collection: "attendance", id: `${date}_${st.id}`, data: { studentId: st.id, studentName: st.name, section: st.section, yearLevel: String(st.yearLevel), date, eventId: date, status: "Not Yet Held", eventName: event, eventType: type, scanTime: "" } }));
  writes.push({ collection: "eventStats", id: date, data: { date, statuses: Object.fromEntries(students.map((st) => [st.id, "Not Yet Held"])) } });
  await fsBatchSet(env, writes);
  await syncCutoffForEvent(date, env);
  await refreshCutoffSchedule(env);
  return { success: true, message: "Event added successfully.", event: { event, date: dateLabel(date), cutoff, status, type } };
}
__name(addEvent, "addEvent");
async function deleteEvent(p, session, env) {
  const row = Number(p.row);
  const events = await getEvents(env);
  const ev = events.find((e) => Number(e.row) === row);
  if (!ev) fail("Event row not found.");
  const records = await fsQuery(env, "attendance", "date", ev.date);
  await fsBatchDelete(env, records.map((r) => ({ collection: "attendance", id: r.id })));
  await fsDelete(env, "eventStats", ev.date);
  await fsDelete(env, "events", ev.date);
  await refreshCutoffSchedule(env);
  return { success: true, message: "Event deleted successfully.", event: ev.event, date: ev.date };
}
__name(deleteEvent, "deleteEvent");
async function syncCutoffForEvent(date, env) {
  const ev = await fsGet(env, "events", date);
  if (!ev) return;
  const cutoff = cutoffClock(ev.cutoff);
  if (!cutoff) return;
  if (norm(ev.status) === "closed" || date < todayManila() || date === todayManila() && manilaClock().slice(0, 5) >= cutoff) {
    const rows = await fsQuery(env, "attendance", "date", date);
    const pending = rows.filter((r) => ["not yet held", "pending", ""].includes(norm(r.status)));
    const pendingIds = new Set(pending.map((r) => r.studentId));
    const statuses = Object.fromEntries(rows.map((r) => [r.studentId, pendingIds.has(r.studentId) ? "Absent" : r.status || "Not Yet Held"]));
    const writes = pending.map((r) => ({ collection: "attendance", id: r.id, data: { ...r, status: "Absent" } }));
    writes.push({ collection: "eventStats", id: date, data: { date, statuses } });
    await fsBatchSet(env, writes);
    if (norm(ev.status) !== "closed") await fsPatch(env, "events", date, { status: "Closed" });
    await refreshCutoffSchedule(env);
  }
}
__name(syncCutoffForEvent, "syncCutoffForEvent");
async function runCutoffAutomation(env) {
  let schedule = await fsGet(env, "appMeta", "cutoffSchedule");
  if (!schedule) {
    await refreshCutoffSchedule(env);
    schedule = await fsGet(env, "appMeta", "cutoffSchedule");
  }
  const today = todayManila(), clock = manilaClock().slice(0, 5);
  for (const ev of schedule?.events || []) {
    const cutoff = cutoffClock(ev.cutoff);
    if (!cutoff) continue;
    if (ev.date < today || ev.date === today && clock >= cutoff) await syncCutoffForEvent(ev.date, env);
  }
}
__name(runCutoffAutomation, "runCutoffAutomation");
async function recordAttendance(p, session, env) {
  const requestId = clean(p.requestId || p.request_id);
  if (requestId) {
    const reqId = await shaHex(requestId);
    const cached = await fsGet(env, "scanRequests", reqId);
    if (cached?.response) return cached.response;
  }
  const qr = clean(p.qrText || p.qr || p.value);
  if (!qr) fail("QR data is empty.");
  let id = normCode(qr);
  let st = await fsGet(env, "students", id);
  if (!st) {
    let name = qr;
    try {
      const o = JSON.parse(qr);
      name = o.name || o.studentName || o.student || qr;
    } catch (_) {
    }
    const m = qr.match(/(?:name|studentName|student)\s*[:=]\s*([^|;,]+)/i);
    if (m) name = m[1];
    const all = await fsList(env, "students");
    st = all.find((x) => norm(x.name) === norm(name));
  }
  if (!st || st.active === false) fail("Student TALAAN ID or QR code was not found or is inactive.");
  let date = parseDate(p.date || p.selectedDate || p.eventDate) || todayManila();
  const ev = await fsGet(env, "events", date);
  if (!ev) fail("No event is scheduled for the selected date.");
  const cutoff = cutoffClock(ev.cutoff);
  const status = ev.status === "Closed" || date < todayManila() || cutoff && date === todayManila() && manilaClock().slice(0, 5) >= cutoff ? "Absent" : "Present";
  const now = /* @__PURE__ */ new Date();
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(now);
  const scanDate = todayManila();
  const rec = { studentId: st.id, studentName: st.name, section: st.section, yearLevel: String(st.yearLevel), date, eventId: date, status, eventName: ev.event, eventType: ev.type || "", scanTime: time, scanDate };
  const response = { success: true, decision: status === "Absent" ? "ABSENT" : "PRESENT", message: "Attendance recorded successfully.", student: st.name, section: st.section, yearLevel: String(st.yearLevel), date: dateLabel(date), status, event: ev.event, cutoff: ev.cutoff || "" };
  const logId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const writes = [
    { collection: "attendance", id: `${date}_${st.id}`, data: rec },
    { collection: "eventStats", id: date, data: { statuses: { [st.id]: status } }, updateMask: [`statuses.${st.id}`] }
  ];
  let requestDocId = "";
  if (requestId) {
    requestDocId = await shaHex(requestId);
    writes.push({ collection: "scanRequests", id: requestDocId, data: { response, createdAt: (/* @__PURE__ */ new Date()).toISOString() }, currentDocument: { exists: false } });
  }
  try {
    await fsBatchSet(env, writes);
  } catch (writeError) {
    if (requestDocId) {
      readCache.delete(`scanRequests:doc:${requestDocId}`);
      const cached = await fsGet(env, "scanRequests", requestDocId);
      if (cached?.response) return cached.response;
    }
    throw writeError;
  }
  try {
    await fsSet(env, "attendanceLogs", logId, { ...rec, id: logId, logOrder: Date.now(), scanTime: time });
  } catch (logError) {
    console.error("Attendance scan log warning", logError?.message || logError);
  }
  return response;
}
__name(recordAttendance, "recordAttendance");
async function updateStudentAttendance(p, session, env) {
  requireRole(session, ["Secretary", "Class Sec"]);
  const id = normCode(p.studentId || p.id);
  const students = await fsList(env, "students");
  const st = id ? await fsGet(env, "students", id) : students.find((x) => norm(x.name) === norm(p.name) && norm(x.section) === norm(p.section) && String(x.yearLevel) === String(p.yearLevel));
  if (!st || st.active === false) fail("Student record could not be found or is inactive.");
  if (!studentMatchesAccess(st, session)) fail("Not authorized for this student.");
  const status = norm(p.status) === "present" ? "Present" : norm(p.status) === "absent" ? "Absent" : "";
  if (!status) fail("Attendance status must be Present or Absent.");
  const date = clean(p.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || parseDate(date) !== date || date > todayManila()) fail("Choose a valid event date that is not in the future.");
  const ev = await fsGet(env, "events", date);
  if (!ev) fail("The selected date is not an event date.");
  const reason = clean(p.reason);
  if (reason.length > 500) fail("Reason must be 500 characters or fewer.");
  const recId = `${date}_${st.id}`;
  const previousDoc = await fsRequest(env, `attendance/${encodeURIComponent(recId)}`);
  const old = previousDoc ? decodeFields(previousDoc.fields || {}) : null;
  const previousStatus = old?.status || "Not Yet Held";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = { ...old || {}, studentId: st.id, studentName: st.name, section: st.section, yearLevel: String(st.yearLevel), date, eventId: date, eventName: ev.event, eventType: ev.type || "", status, scanTime: "", manualCorrection: true, manualUpdatedAt: now };
  const logId = `manual_${crypto.randomUUID()}`;
  const audit = { id: logId, action: "manual_attendance_correction", manual: true, manualCorrection: true, studentId: st.id, studentName: st.name, section: st.section, yearLevel: String(st.yearLevel), date, scanDate: date, eventName: ev.event, eventType: ev.type || "", previousStatus, status, newStatus: status, scanTime: "", reason, actorAccountId: session.accountId || "", actorName: session.name || "", actorRole: session.role, createdAt: now, logOrder: Date.now() };
  await fsBatchSet(env, [
    { collection: "attendance", id: recId, data: updated },
    { collection: "eventStats", id: date, data: { statuses: { [st.id]: status } }, updateMask: [`statuses.${st.id}`] },
    { collection: "attendanceLogs", id: logId, data: audit, currentDocument: { exists: false } }
  ]);
  return { success: true, message: `${st.name} attendance changed to ${status}.`, status, event: ev.event, date, profile: (await studentRecord({ studentId: st.id }, session, env)).profile };
}
__name(updateStudentAttendance, "updateStudentAttendance");
async function verifyBearer(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) fail("Please log in again.");
  const parts = token.split(".");
  if (parts.length !== 3) fail("Invalid authentication token.");
  const header = JSON.parse(b64decode(parts[0]));
  const payload = JSON.parse(b64decode(parts[1]));
  if (header.alg !== "RS256" || !header.kid) fail("Invalid authentication token.");
  if (payload.aud !== env.FIREBASE_PROJECT_ID || payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` || !payload.sub || payload.sub.length > 128 || payload.exp * 1e3 < Date.now() || payload.iat * 1e3 > Date.now() + 6e4 || !payload.auth_time || (Number(payload.auth_time) + 30 * 86400) * 1e3 < Date.now() || payload.firebase?.sign_in_provider !== "custom") fail("Your session has expired. Please log in again.");
  const keys = await getJwks();
  const jwk = keys.keys.find((k) => k.kid === header.kid);
  if (!jwk) fail("Authentication key not recognized.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) fail("Invalid authentication token.");
  return payload;
}
__name(verifyBearer, "verifyBearer");
async function getJwks() {
  if (jwksCache && Date.now() - jwksFetchedAt < 36e5) return jwksCache;
  const r = await fetch(FIREBASE_JWKS);
  if (!r.ok) throw new Error("Could not verify Firebase authentication.");
  jwksCache = await r.json();
  jwksFetchedAt = Date.now();
  return jwksCache;
}
__name(getJwks, "getJwks");
function b64decode(s) {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}
__name(b64decode, "b64decode");
function b64urlBytes(s) {
  const raw = b64decode(s);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
__name(b64urlBytes, "b64urlBytes");
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
__name(b64url, "b64url");
async function createCustomToken(env, uid, claims) {
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1e3);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ iss: sa.client_email, sub: sa.client_email, aud: CUSTOM_TOKEN_AUD, iat: now, exp: now + 3600, uid, claims })));
  const input = `${header}.${payload}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return `${input}.${b64url(new Uint8Array(sig))}`;
}
__name(createCustomToken, "createCustomToken");
async function importPrivateKey(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
__name(importPrivateKey, "importPrivateKey");
function serviceAccount(env) {
  try {
    return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (_) {
    throw new Error("Firebase service account secret is not configured.");
  }
}
__name(serviceAccount, "serviceAccount");
async function identityRequest(env, method, body) {
  const url = `${FIREBASE_IDENTITY}/${method}?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) fail(identityError(data));
  return data;
}
__name(identityRequest, "identityRequest");
function identityError(d) {
  const m = d?.error?.message || "";
  if (m.includes("EMAIL_EXISTS")) return "This student account already exists. Please use Log In.";
  if (m.includes("INVALID_PASSWORD") || m.includes("INVALID_LOGIN_CREDENTIALS") || m.includes("EMAIL_NOT_FOUND")) return "Incorrect student TALAAN ID or password.";
  if (m.includes("WEAK_PASSWORD")) return "Password must be at least 6 characters.";
  return "Student authentication could not be completed. Please try again or contact the administrator.";
}
__name(identityError, "identityError");
async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
async function shaHex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(shaHex, "shaHex");
// TALAAN v2 backend extensions: staging candidate, never deploy to production untested.
function v2Staff(s) { requireRole(s, ['Secretary','Admin','Class Sec','Teacher']); }
function v2Fields(p) {
  const name = clean(p.name), section = clean(p.section), yearLevel = String(p.yearLevel || '');
  if (!name || name.length > 160 || !/^[1-4]$/.test(yearLevel) || !/^[a-z0-9 -]{1,40}$/i.test(section)) fail('Provide a valid student name, year level and section.');
  return {name, section, yearLevel};
}
// All v2 roster mutations contend on one Firestore document. A failed
// precondition aborts the ENTIRE commit (including attendance writes).
async function v2RosterLock(env) {
  const raw=await fsRequest(env,'appMeta/v2RosterRevision');
  return raw ? {revision:decodeFields(raw.fields||{}).revision||'',updateTime:raw.updateTime} : {revision:'',updateTime:null};
}
function v2RosterLockWrite(lock) {
  return {collection:'appMeta',id:'v2RosterRevision',data:{revision:crypto.randomUUID(),updatedAt:new Date().toISOString()},currentDocument:lock.updateTime?{updateTime:lock.updateTime}:{exists:false}};
}
// Return an enrollment PIN only once to the authorized staff member; store only
// its keyed digest in Firestore. New v2 students can then create their accounts.
function v2NewEnrollmentPin() {
  const bytes=crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
async function v2EnrollmentHash(env,id,pin) {
  return hmacHex(env.TALAAN_PEPPER,`enroll:${id}:${pin}`);
}
async function v2StudentCreate(p,s,env) {
  v2Staff(s); const fields=v2Fields(p);
  if (!studentMatchesAccess(fields,s)) fail('Not authorized for this section.');
  const id='TLN'+crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase();
  const now=new Date().toISOString();
  const enrollmentPin=v2NewEnrollmentPin();
  const enrollmentPinHash=await v2EnrollmentHash(env,id,enrollmentPin);
  const lock=await v2RosterLock(env);
  await fsCommitAtomic(env,[{collection:'students',id,data:{...fields,id,active:true,createdAt:now,enrollmentPinHash},currentDocument:{exists:false}},v2RosterLockWrite(lock)]);
  return {success:true,studentId:id,qrText:id,enrollmentPin};
}
// Bypass the legacy in-memory query cache for safety-critical metadata edits.
// Reads are fetched directly from Firestore before version-checked commits.
async function v2FreshAttendance(env, studentId) {
  const token=await firestoreAccessToken(env);
  const structuredQuery={from:[{collectionId:'attendance'}],where:{fieldFilter:{field:{fieldPath:'studentId'},op:'EQUAL',value:encodeValue(studentId)}}};
  const r=await fetch(`${fsBase(env)}:runQuery`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({structuredQuery})});
  const data=await r.json().catch(()=>[]);
  if(!r.ok || !Array.isArray(data)) fail('Unable to verify current attendance records. Please retry.');
  return data.filter(x=>x.document).map(x=>({id:x.document.name.split('/').pop(),...decodeFields(x.document.fields||{})}));
}
async function v2StudentUpdate(p,s,env) {
  v2Staff(s);
  const id=normCode(p.studentId);
  const raw=await fsRequest(env,`students/${encodeURIComponent(id)}`);
  if(!raw) fail('Student not found or not authorized.');
  const st={id,...decodeFields(raw.fields||{})};
  if(!studentMatchesAccess(st,s)) fail('Student not found or not authorized.');
  if(st.active===false) fail('Inactive students cannot be modified without reactivation.');
  const fields=v2Fields(p);
  if(!studentMatchesAccess(fields,s)) fail('Not authorized for the destination section.');
  const now=new Date().toISOString();
  const writes=[{collection:'students',id,data:{...st,...fields,id,updatedAt:now},currentDocument:{updateTime:raw.updateTime}}];
  const records=await v2FreshAttendance(env,id);
  // Read each current document and use its updateTime to prevent overwriting a
  // concurrent QR scan or manual correction. Commit all writes atomically.
  for(const r of records) {
    const current=await fsRequest(env,`attendance/${encodeURIComponent(r.id)}`);
    if(!current) fail('An attendance record changed. Please retry the student edit.');
    const old=decodeFields(current.fields||{});
    writes.push({collection:'attendance',id:r.id,data:{...old,studentName:fields.name,section:fields.section,yearLevel:fields.yearLevel},currentDocument:{updateTime:current.updateTime}});
  }
  if(writes.length>350) fail('This student has too many attendance records for a safe single update. No changes were made.');
  const lock=await v2RosterLock(env);
  writes.push(v2RosterLockWrite(lock));
  await fsCommitAtomic(env,writes);
  return {success:true,studentId:id};
}
async function v2StudentDelete(p,s,env) {
  v2Staff(s); const id=normCode(p.studentId),st=await fsGet(env,'students',id);
  if (!st || !studentMatchesAccess(st,s)) fail('Student not found or not authorized.');
  if (st.active === false) fail('Student is already inactive.');
  // Preserve attendance history and Auth identity; deactivate to avoid orphaned records.
  const raw=await fsRequest(env,`students/${encodeURIComponent(id)}`);
  const lock=await v2RosterLock(env);
  await fsCommitAtomic(env,[{collection:'students',id,data:{...decodeFields(raw.fields||{}),active:false,deactivatedAt:new Date().toISOString()},currentDocument:{updateTime:raw.updateTime}},v2RosterLockWrite(lock)]);
  return {success:true,deactivated:true,studentId:id};
}
async function v2FreshStudents(env) {
  // No in-process read cache for import previews or confirmation checks.
  let token = null, out = [];
  do {
    const q = new URLSearchParams({pageSize:'1000'});
    if (token) q.set('pageToken',token);
    const data = await fsRequest(env, `students?${q}`);
    if (!data) break;
    for (const d of data.documents || []) out.push({id:d.name.split('/').pop(), ...decodeFields(d.fields || {})});
    token = data.nextPageToken || null;
  } while (token);
  return out;
}
function v2ImportRows(p) {
  if (!Array.isArray(p.rows) || p.rows.length === 0 || p.rows.length > 500) fail('Upload a valid non-empty roster of up to 500 rows per preview.');
  return p.rows.map(row => ({...v2Fields(row), studentId:normCode(row.studentId || row.id)}));
}
function v2IdentityAmbiguity(row, activeStudents) {
  // Names are not unique identifiers. An un-IDed row with a name already
  // present anywhere in the active roster must be resolved by TALAAN ID.
  if (row.studentId) return false;
  return activeStudents.some(st => norm(st.name) === norm(row.name));
}
async function v2RosterPreview(p,s,env) {
  v2Staff(s);
  const rows=v2ImportRows(p);
  if(rows.some(x=>!studentMatchesAccess(x,s))) fail('Roster contains a section outside your access.');
  const allActive=(await v2FreshStudents(env)).filter(x=>x.active!==false);
  const existing=allActive.filter(x=>studentMatchesAccess(x,s));
  const byId=new Map(existing.map(x=>[normCode(x.id),x]));
  const allKeys=new Set(allActive.map(x=>`${norm(x.name)}|${norm(x.section)}|${String(x.yearLevel)}`));
  const key=x=>`${norm(x.name)}|${norm(x.section)}|${x.yearLevel}`;
  const byKey=new Map();
  for(const st of existing) { const k=key(st); byKey.set(k,[...(byKey.get(k)||[]),st]); }
  const incomingIds=new Set(), incomingKeys=new Set(), matchedIds=new Set();
  const incomingNameCounts=new Map();
  for(const row of rows) incomingNameCounts.set(norm(row.name),(incomingNameCounts.get(norm(row.name))||0)+1);
  const additions=[], changes=[], unchanged=[], ambiguous=[];
  for(const row of rows) {
    const k=key(row);
    if(!row.studentId && incomingNameCounts.get(norm(row.name))>1) {
      ambiguous.push({row,reason:'More than one uploaded row has this name. Supply unique TALAAN IDs to disambiguate.'});
      continue;
    }
    if(incomingKeys.has(k)) fail('Duplicate student rows in upload.');
    incomingKeys.add(k);
    if(row.studentId) {
      if(incomingIds.has(row.studentId)) fail('Duplicate TALAAN IDs in upload.');
      incomingIds.add(row.studentId);
      const st=byId.get(row.studentId);
      if(!st) { ambiguous.push({row,reason:'TALAAN ID is not an active record within your authorized scope.'}); continue; }
      if(matchedIds.has(st.id)) fail('One student is matched more than once.');
      matchedIds.add(st.id);
      if(key(st)===k) unchanged.push({studentId:st.id,...row});
      else changes.push({studentId:st.id,before:{name:st.name,section:st.section,yearLevel:String(st.yearLevel)},after:{name:row.name,section:row.section,yearLevel:row.yearLevel}});
      continue;
    }
    const matches=byKey.get(k)||[];
    if(matches.length>1) { ambiguous.push({row,reason:'More than one existing student has these details; provide a TALAAN ID.'}); continue; }
    if(matches.length===1) {
      const st=matches[0];
      if(matchedIds.has(st.id)) fail('One student is matched more than once.');
      matchedIds.add(st.id); unchanged.push({studentId:st.id,...row});
    } else if(allKeys.has(k) || v2IdentityAmbiguity(row,allActive)) {
      ambiguous.push({row,reason:'An active student has the same name. Provide the existing TALAAN ID or resolve the identity before importing.'});
    } else additions.push(row);
  }
  const missing=existing.filter(x=>!matchedIds.has(x.id)).map(x=>({studentId:x.id,name:x.name,section:x.section,yearLevel:String(x.yearLevel)}));
  // Preview is bound to the authenticated staff account, roster contents and current database state.
  const rosterLock=await v2RosterLock(env);
  const state=existing.map(x=>({id:x.id,name:x.name,section:x.section,yearLevel:String(x.yearLevel),active:x.active!==false})).sort((a,b)=>a.id.localeCompare(b.id));
  const fingerprint=await hmacHex(env.TALAAN_PEPPER,JSON.stringify({accountId:s.accountId,role:s.role,rows,state,rosterRevision:rosterLock.revision}));
  return {success:true,previewOnly:true,additions,changes,missing,unchangedCount:unchanged.length,ambiguous,requiresConfirmation:true,canApply:ambiguous.length===0,confirmationToken:fingerprint,message:'Preview only; missing students will remain unchanged unless separately managed. No records were changed.'};
}
async function v2RosterApply(p,s,env) {
  v2Staff(s);
  if (p.confirm !== true || !/^[a-f0-9]{64}$/.test(clean(p.confirmationToken))) fail('Review the roster preview and explicitly confirm before applying.');
  const preview=await v2RosterPreview({rows:p.rows},s,env);
  if (!preview.canApply || preview.ambiguous.length) fail('Resolve ambiguous matches before applying.');
  if (!constantTimeEqual(preview.confirmationToken,clean(p.confirmationToken))) fail('The roster or your access has changed. Generate a fresh preview.');
  // Missing students are intentionally preserved, not silently deleted.
  // Keep each apply in one atomic Firestore commit; reject oversized operations.
  const writes=[];
  const now=new Date().toISOString();
  // Never derive identity from a name: distinct people can share all fields.
  // The shared roster revision ensures competing v2 imports cannot both commit
  // from the same preview, even though each uses a fresh random student ID.
  const additions=await Promise.all(preview.additions.map(async row=>{
    const id='TLN'+crypto.randomUUID().replace(/-/g,'').slice(0,20).toUpperCase();
    const enrollmentPin=v2NewEnrollmentPin();
    return {id,row,enrollmentPin,enrollmentPinHash:await v2EnrollmentHash(env,id,enrollmentPin)};
  }));
  for(const {id,row,enrollmentPinHash} of additions) writes.push({collection:'students',id,data:{id,name:row.name,section:row.section,yearLevel:row.yearLevel,active:true,createdAt:now,enrollmentPinHash},currentDocument:{exists:false}});
  for(const change of preview.changes) {
    const original=await fsRequest(env,`students/${encodeURIComponent(change.studentId)}`);
    if(!original) fail('A student record changed. Generate a new preview.');
    const current=decodeFields(original.fields||{});
    if(current.active===false || norm(current.name)!==norm(change.before.name) || norm(current.section)!==norm(change.before.section) || String(current.yearLevel)!==change.before.yearLevel) fail('A student record changed. Generate a new preview.');
    writes.push({collection:'students',id:change.studentId,data:{...current,...change.after,id:change.studentId,updatedAt:now},currentDocument:{updateTime:original.updateTime}});
    const records=await v2FreshAttendance(env,change.studentId);
    for(const r of records) {
      const raw=await fsRequest(env,`attendance/${encodeURIComponent(r.id)}`);
      if(!raw) fail('An attendance record changed. Generate a new preview.');
      const old=decodeFields(raw.fields||{});
      writes.push({collection:'attendance',id:r.id,data:{...old,studentName:change.after.name,section:change.after.section,yearLevel:change.after.yearLevel},currentDocument:{updateTime:raw.updateTime}});
    }
  }
  // Do not partially apply large uploads. Firestore commit is atomic within its limits.
  if(writes.length>349) fail('This roster change exceeds the safe single-commit limit. Split the import into smaller batches and preview again.');
  if(!writes.length) return {success:true,added:0,updated:0,missingPreserved:preview.missing.length,message:'No changes to apply.'};
  const lock=await v2RosterLock(env);
  // Recheck revision immediately before committing; the commit precondition
  // catches another v2 writer that wins after this read.
  const checked=await v2RosterPreview({rows:p.rows},s,env);
  if(!constantTimeEqual(checked.confirmationToken,clean(p.confirmationToken))) fail('Roster changed during import. Preview again.');
  writes.push(v2RosterLockWrite(lock));
  await fsCommitAtomic(env,writes);
  // All v2 roster readers now use the students collection; no secondary
  // snapshot rebuild is required after the atomic commit.
  return {success:true,added:additions.length,updated:preview.changes.length,missingPreserved:preview.missing.length,newStudentCredentials:additions.map(({id,row,enrollmentPin})=>({studentId:id,name:row.name,enrollmentPin}))};
}
async function fsCommitAtomic(env,writes) {
  const token=await firestoreAccessToken(env);
  const payload=writes.map(w=>({update:{name:firestoreDocumentName(env,w.collection,w.id),fields:encodeFields(w.data)},currentDocument:w.currentDocument}));
  const r=await fetch(`${fsBase(env)}:commit`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({writes:payload})});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||'Roster application failed; no changes were committed.');}
  for(const col of new Set(writes.map(w=>w.collection))) invalidateCollection(col);
}
async function v2Activities(s,env) {
  if(s.role==='Student' || ['Secretary','Admin','Teacher','Class Sec'].includes(s.role)) return {success:true,activities:(await fsList(env,'v2Activities')).sort((a,b)=>a.date.localeCompare(b.date))};
  fail('Not authorized.');
}
async function v2ActivityAdd(p,s,env) {
  requireRole(s,['Secretary','Admin']);
  const title=clean(p.title), date=parseDate(p.date), time=clean(p.time),location=clean(p.location);
  if(!title || title.length>160 || !date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !location || location.length>200) fail('Provide valid title, date, 24-hour time, and location.');
  const id=crypto.randomUUID(); await fsBatchSet(env,[{collection:'v2Activities',id,data:{title,date,time,location,createdAt:new Date().toISOString()},currentDocument:{exists:false}}]);
  return {success:true,id};
}
async function v2ActivityDelete(p,s,env) {
  requireRole(s,['Secretary','Admin']); const id=clean(p.id);
  if(!/^[a-f0-9-]{36}$/.test(id) || !(await fsGet(env,'v2Activities',id))) fail('Activity not found.');
  await fsDelete(env,'v2Activities',id); return {success:true};
}
async function v2ExportData(p,s,env) {
  v2Staff(s); const kind=norm(p.kind);
  if(!['attendance','warnings','records'].includes(kind)) fail('Invalid report.');
  const years=Array.isArray(p.years)?p.years.map(String):[], sections=Array.isArray(p.sections)?p.sections.map(norm):[], dates=Array.isArray(p.dates)?p.dates:[];
  if(years.some(x=>!/^[1-4]$/.test(x)) || dates.some(x=>parseDate(x)!==x) || sections.length>100 || dates.length>150) fail('Invalid report filters.');
  const students=(await fsList(env,'students')).filter(x=>x.active!==false && studentMatchesAccess(x,s) && (!years.length || years.includes(String(x.yearLevel))) && (!sections.length || sections.includes(norm(x.section))));
  const events=(await getEvents(env)).filter(e=>!dates.length || dates.includes(e.date));
  const maps=await getEventStatusMaps(events,env);
  const rows=students.map(st=>{const statuses=events.map((e,i)=>maps[i]?.[st.id]||'Not Yet Held');const absent=statuses.filter(x=>norm(x)==='absent').length;return {studentId:st.id,name:st.name,section:st.section,yearLevel:String(st.yearLevel),statuses,absent};}).filter(x=>kind!=='warnings'||x.absent>=3);
  return {success:true,kind,events:events.map(e=>({date:e.date,title:e.event})),rows};
}
function fsBase(env) {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}
__name(fsBase, "fsBase");
async function firestoreAccessToken(env) {
  if (serviceTokenCache && serviceTokenCache.expires > Date.now() + 6e4) return serviceTokenCache.token;
  const sa = serviceAccount(env);
  const now = Math.floor(Date.now() / 1e3);
  const h = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const p = b64url(new TextEncoder().encode(JSON.stringify({ iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600, scope: FIRESTORE_SCOPE })));
  const input = `${h}.${p}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  const assertion = `${input}.${b64url(new Uint8Array(sig))}`;
  const form = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await r.json();
  if (!r.ok) throw new Error("Unable to obtain Firestore access token.");
  serviceTokenCache = { token: data.access_token, expires: Date.now() + Number(data.expires_in || 3600) * 1e3 };
  return data.access_token;
}
__name(firestoreAccessToken, "firestoreAccessToken");
async function fsRequest(env, path, opts = {}) {
  const token = await firestoreAccessToken(env);
  const r = await fetch(`${fsBase(env)}/${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts.headers || {} } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(data?.error?.message || `Firestore request failed (${r.status}).`);
  }
  return data;
}
__name(fsRequest, "fsRequest");
function cacheRead(key, loader) {
  const now = Date.now(), hit = readCache.get(key);
  if (hit && hit.expires > now) return Promise.resolve(hit.value);
  return Promise.resolve().then(loader).then((value) => {
    readCache.set(key, { value, expires: Date.now() + READ_CACHE_MS });
    if (readCache.size > 1500) {
      for (const [k, v] of readCache) if (v.expires <= Date.now()) readCache.delete(k);
      while (readCache.size > 1500) readCache.delete(readCache.keys().next().value);
    }
    return value;
  });
}
__name(cacheRead, "cacheRead");
function invalidateCollection(col) {
  for (const k of readCache.keys()) if (k.startsWith(`${col}:`)) readCache.delete(k);
}
__name(invalidateCollection, "invalidateCollection");
async function fsGet(env, col, id) {
  return cacheRead(`${col}:doc:${id}`, async () => {
    const d = await fsRequest(env, `${col}/${encodeURIComponent(id)}`);
    return d ? { id: d.name.split("/").pop(), ...decodeFields(d.fields || {}) } : null;
  });
}
__name(fsGet, "fsGet");
async function fsSet(env, col, id, obj) {
  const fields = encodeFields(obj);
  const d = await fsRequest(env, `${col}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ fields }) });
  invalidateCollection(col);
  return d ? { id: d.name.split("/").pop(), ...decodeFields(d.fields || {}) } : null;
}
__name(fsSet, "fsSet");
async function fsPatch(env, col, id, obj) {
  const old = await fsGet(env, col, id);
  if (!old) fail("Record not found.");
  const { id: docId, ...data } = old;
  return fsSet(env, col, id, { ...data, ...obj });
}
__name(fsPatch, "fsPatch");
async function fsDelete(env, col, id) {
  const token = await firestoreAccessToken(env);
  const r = await fetch(`${fsBase(env)}/${col}/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok && r.status !== 404) throw new Error("Unable to delete Firestore record.");
  invalidateCollection(col);
}
__name(fsDelete, "fsDelete");
async function fsList(env, col) {
  return cacheRead(`${col}:list`, async () => {
    let token = null, out = [];
    do {
      const q = new URLSearchParams({ pageSize: "1000" });
      if (token) q.set("pageToken", token);
      const data = await fsRequest(env, `${col}?${q}`);
      if (!data) break;
      for (const d of data.documents || []) out.push({ id: d.name.split("/").pop(), ...decodeFields(d.fields || {}) });
      token = data.nextPageToken || null;
    } while (token);
    return out;
  });
}
__name(fsList, "fsList");
async function fsQuery(env, col, field, value) {
  return cacheRead(`${col}:query:${field}:${String(value)}`, async () => {
    const token = await firestoreAccessToken(env);
    const structuredQuery = { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: encodeValue(value) } } };
    const r = await fetch(`${fsBase(env)}:runQuery`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery }) });
    const data = await r.json().catch(() => []);
    if (!r.ok) throw new Error("Firestore query failed.");
    return (data || []).filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), ...decodeFields(x.document.fields || {}) }));
  });
}
__name(fsQuery, "fsQuery");
function firestoreDocumentName(env, col, id) {
  return `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${col}/${encodeURIComponent(id)}`;
}
__name(firestoreDocumentName, "firestoreDocumentName");
async function fsBatchSet(env, writes) {
  const token = await firestoreAccessToken(env);
  for (let i = 0; i < writes.length; i += 400) {
    const chunk = writes.slice(i, i + 400).map((w) => {
      const x = { update: { name: firestoreDocumentName(env, w.collection, w.id), fields: encodeFields(w.data) } };
      if (w.updateMask) x.updateMask = { fieldPaths: w.updateMask };
      if (w.currentDocument) x.currentDocument = w.currentDocument;
      return x;
    });
    const r = await fetch(`${fsBase(env)}:commit`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ writes: chunk }) });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e?.error?.message || "Could not save all attendance records.");
    }
  }
  for (const c of new Set(writes.map((w) => w.collection))) invalidateCollection(c);
}
__name(fsBatchSet, "fsBatchSet");
async function fsBatchDelete(env, items) {
  const token = await firestoreAccessToken(env);
  for (let i = 0; i < items.length; i += 400) {
    const chunk = items.slice(i, i + 400).map((w) => ({ delete: firestoreDocumentName(env, w.collection, w.id) }));
    const r = await fetch(`${fsBase(env)}:commit`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ writes: chunk }) });
    if (!r.ok) throw new Error("Could not delete attendance records.");
  }
  for (const c of new Set(items.map((w) => w.collection))) invalidateCollection(c);
}
__name(fsBatchDelete, "fsBatchDelete");
function encodeFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = encodeValue(v);
  return out;
}
__name(encodeFields, "encodeFields");
function encodeValue(v) {
  if (v === null || v === void 0) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}
__name(encodeValue, "encodeValue");
function decodeFields(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) o[k] = decodeValue(v);
  return o;
}
__name(decodeFields, "decodeFields");
function decodeValue(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields);
  return null;
}
__name(decodeValue, "decodeValue");
export {
  index_staging_default as default
};
//# sourceMappingURL=index.staging.js.map
