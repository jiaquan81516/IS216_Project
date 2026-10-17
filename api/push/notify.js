// POST /api/push/notify   { householdId, type: "chat" | "task" | "feeling" | "heavy", id }
//
// Sends a web push to the caller's partner. The caller only says WHICH document is new. The
// function reads that document itself, so it can check that the caller really wrote it, that
// it is fresh, and that it is meant for the partner, then builds the notification from the
// stored data. A body cannot make it send anything the database does not already hold.
//
// Skips quietly (answers 200 with sent: 0) when the partner has push off, is in quiet hours,
// or has no device registered. Dead device tokens are deleted as FCM reports them.
import { db, hasAdminConfig, messaging, notConfigured } from "../_lib/admin.js";
import { requireUser } from "../_lib/auth.js";
import { guardLimit } from "../_lib/rateLimit.js";
import { allowMethod, fail, logLine, ok, readBody } from "../_lib/respond.js";
import { HEAVY_NIGHT_LOGS, buildPush, countNightLogs, isDeadToken, isFresh, isQuietNow, millisOf, nightKey, todayIso } from "../_lib/push.js";

const TYPES = ["chat", "task", "feeling", "heavy"];
const idOk = (value) => typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/");

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  if (!hasAdminConfig()) {
    const error = notConfigured();
    return fail(res, 500, error.code, error.message);
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (error) {
    return fail(res, 401, error.code || "auth/invalid-token", error.message);
  }

  const { householdId, type, id } = readBody(req);
  if (!idOk(householdId) || !idOk(id) || !TYPES.includes(type)) {
    return fail(res, 400, "push/bad-request", "Say which household, which kind and which item.");
  }
  if (!(await guardLimit(res, user.uid, "pushNotify"))) return;

  try {
    const household = await db.collection("households").doc(householdId).get();
    const memberIds = household.exists ? household.data()?.memberIds : null;
    if (!Array.isArray(memberIds) || !memberIds.includes(user.uid)) {
      return fail(res, 403, "push/not-a-member", "You are not part of that household.");
    }
    const partnerUid = memberIds.find((uid) => uid !== user.uid);
    if (!partnerUid) return ok(res, { sent: 0, skipped: "no-partner" });

    const household$ = db.collection("households").doc(householdId);
    const collectionOf = { chat: "chat", task: "tasks", feeling: "feelings", heavy: "entries" };
    const source = await household$.collection(collectionOf[type]).doc(id).get();
    const data = source.exists ? source.data() : null;
    if (!data) return fail(res, 404, "push/not-found", "That item is not there any more.");

    // Some pushes are sent once per day or night. The marker is written after a send.
    let markKey = "";
    let nightCount = 0;
    if (type === "chat") {
      if (data.from !== user.uid) return fail(res, 403, "push/not-yours", "You can only announce your own messages.");
      if (!isFresh(data.createdAt)) return ok(res, { sent: 0, skipped: "old" });
    } else if (type === "task") {
      if (data.owner !== partnerUid || data.done) return ok(res, { sent: 0, skipped: "not-for-partner" });
      if (!isFresh(data.updatedAt)) return ok(res, { sent: 0, skipped: "old" });
    } else if (type === "feeling") {
      if (id !== user.uid) return fail(res, 403, "push/not-yours", "You can only announce your own feeling.");
      if (data.level !== "hard" || data.date !== todayIso()) return ok(res, { sent: 0, skipped: "not-hard-today" });
      if (!isFresh(data.updatedAt)) return ok(res, { sent: 0, skipped: "old" });
      markKey = data.date;
    } else {
      if (data.by !== user.uid) return fail(res, 403, "push/not-yours", "You can only announce your own logs.");
      if (!isFresh(data.createdAt)) return ok(res, { sent: 0, skipped: "old" });
      const recent = await household$.collection("entries").orderBy("at", "desc").limit(60).get();
      nightCount = countNightLogs(
        recent.docs.map((doc) => ({ by: doc.data()?.by, at: millisOf(doc.data()?.at) })),
        user.uid,
      );
      if (nightCount < HEAVY_NIGHT_LOGS) return ok(res, { sent: 0, skipped: "not-heavy" });
      markKey = nightKey();
    }
    const markRef = markKey ? household$.collection("pushState").doc(`${type}-${user.uid}`) : null;
    if (markRef && (await markRef.get()).data()?.key === markKey) return ok(res, { sent: 0, skipped: "already-sent" });

    const [partner, member, devices] = await Promise.all([
      db.collection("users").doc(partnerUid).get(),
      db.collection("households").doc(householdId).collection("members").doc(user.uid).get(),
      db.collection("users").doc(partnerUid).collection("devices").get(),
    ]);
    const notifications = partner.data()?.settings?.notifications;
    if (notifications?.push !== true) return ok(res, { sent: 0, skipped: "push-off" });
    if (isQuietNow(notifications.quietHours)) return ok(res, { sent: 0, skipped: "quiet-hours" });

    const targets = devices.docs
      .map((doc) => ({ ref: doc.ref, token: doc.data()?.fcmToken }))
      .filter((item) => typeof item.token === "string" && item.token);
    if (!targets.length) return ok(res, { sent: 0, skipped: "no-devices" });

    const push = buildPush({
      type,
      senderName: member.data()?.displayName,
      kind: data.kind,
      title: data.title,
      due: data.due,
      count: nightCount,
    });
    const result = await messaging.sendEachForMulticast({
      tokens: targets.map((item) => item.token),
      data: push,
      webpush: { headers: { Urgency: "high", TTL: "3600" } },
    });

    let dead = 0;
    await Promise.all(
      result.responses.map((response, index) => {
        if (response.success || !isDeadToken(response.error?.code)) return null;
        dead += 1;
        return targets[index].ref.delete().catch(() => null);
      }),
    );
    if (markRef && result.successCount > 0) await markRef.set({ key: markKey, sentAt: new Date() }).catch(() => null);
    logLine("push notify", { type, sent: result.successCount, failed: result.failureCount, dead });
    return ok(res, { sent: result.successCount, failed: result.failureCount });
  } catch (cause) {
    console.error("[push notify]", cause?.code, cause?.message);
    return fail(res, 500, cause?.code || "push/failed", "We could not send that notification.");
  }
}
