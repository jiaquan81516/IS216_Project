export function findResourceById(resources, id) {
  return (
    resources.find((resource) => String(resource.id) === String(id)) ?? null
  );
}
