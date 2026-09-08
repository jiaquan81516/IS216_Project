export async function getFeedings() {
  return [];
}
export async function addFeeding(feeding) {
  return feeding;
}
export async function updateFeeding(id, feeding) {
  return { id, ...feeding };
}
export async function deleteFeeding() {}
