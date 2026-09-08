export function filterResources(resources, searchTerm) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return resources;
  return resources.filter((resource) =>
    resource.title?.toLowerCase().includes(query),
  );
}
