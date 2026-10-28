// POST /api/rooms/notify   { roomId }
//
// Tells the parent who suggested a pumping room that an administrator did not accept it, with a
// web push through Firebase Cloud Messaging. Only an administrator may call it, and the caller
// only says WHICH room. The function reads the room itself, so it can check the room really is
// rejected, that this caller rejected it, and that it happened a moment ago. The text comes
// from the stored room, never from the request.
//
// Skips quietly (answers 200 with sent: 0) when the parent has push off, is in quiet hours or
// has no device registered. Dead device tokens are deleted as FCM reports them.
import { db, hasAdminConfig, messaging, notConfigured } from "../_lib/admin.js";
import { isAdmin, requireUser } from "../_lib/auth.js";
import { guardLimit } from "../_lib/rateLimit.js";
import { allowMethod, fail, logLine, ok, readBody } from "../_lib/respond.js";
import { buildPush, isDeadToken, isFresh, isQuietNow } from "../_lib/push.js";

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
  if (user.admin !== true && !isAdmin(user.uid)) {
    return fail(res, 403, "auth/forbidden", "Only an administrator can send this.");
  }

  const { roomId } = readBody(req);
  if (!idOk(roomId)) return fail(res, 400, "push/bad-request", "Say which room.");
  if (!(await guardLimit(res, user.uid, "pushNotify"))) return;

  try {
    const snap = await db.collection("pumpingRooms").doc(roomId).get();
    const room = snap.exists ? snap.data() : null;
    if (!room) return fail(res, 404, "push/not-found", "That room is not there any more.");
    if (room.approval !== "rejected" || room.reviewedBy !== user.uid) {
      return fail(res, 403, "push/not-yours", "You can only announce a rejection you made.");
    }
    if (!isFresh(room.reviewedAt)) return ok(res, { sent: 0, skipped: "old" });
    if (!idOk(room.createdBy)) return ok(res, { sent: 0, skipped: "no-owner" });

    const [owner, devices] = await Promise.all([
      db.collection("users").doc(room.createdBy).get(),
      db.collection("users").doc(room.createdBy).collection("devices").get(),
    ]);
    const notifications = owner.data()?.settings?.notifications;
    if (notifications?.push !== true) return ok(res, { sent: 0, skipped: "push-off" });
    if (isQuietNow(notifications.quietHours)) return ok(res, { sent: 0, skipped: "quiet-hours" });

    const targets = devices.docs
      .map((doc) => ({ ref: doc.ref, token: doc.data()?.fcmToken }))
      .filter((item) => typeof item.token === "string" && item.token);
    if (!targets.length) return ok(res, { sent: 0, skipped: "no-devices" });

    const push = buildPush({ type: "room", title: room.name, note: room.reviewNote });
    const result = await messaging.sendEachForMulticast({
      tokens: targets.map((item) => item.token),
      data: push,
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    });

    let dead = 0;
    await Promise.all(
      result.responses.map((response, index) => {
        if (response.success || !isDeadToken(response.error?.code)) return null;
        dead += 1;
        return targets[index].ref.delete().catch(() => null);
      }),
    );
    logLine("room notify", { sent: result.successCount, failed: result.failureCount, dead });
    return ok(res, { sent: result.successCount, failed: result.failureCount });
  } catch (cause) {
    console.error("[room notify]", cause?.code, cause?.message);
    return fail(res, 500, cause?.code || "push/failed", "We could not send that notification.");
  }
}
