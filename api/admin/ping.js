import { requireAdmin } from "../_lib/auth.js"; // adjust to your real path

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req);
    res.status(200).json({ ok: true, uid: admin.uid });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}