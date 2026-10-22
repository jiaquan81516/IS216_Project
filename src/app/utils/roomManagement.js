import { roomView } from "./roomHelpers";
import { isDuplicate } from "./mapHelpers";

// Apply edits before de-duplication so deleting a bundled listing stays deleted.
export function applyRoomOverrides(rooms, overrides) {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  // Remove shadowed seed/duplicate entries using the original location, even
  // when an administrator later renames or moves the winning listing.
  for (const override of overrides) {
    const original = rooms.find((room) => room.id === override.id);
    if (!original) continue;
    for (const room of rooms) {
      if (room.id !== original.id && isDuplicate(original, room)) byId.delete(room.id);
    }
  }
  for (const override of overrides) {
    if (override.deleted) byId.delete(override.id);
    else byId.set(override.id, {
      ...byId.get(override.id),
      ...roomView(override.id, override),
    });
  }
  return [...byId.values()];
}
