export function matchResources(resources, concerns) {
  return resources.filter((resource) =>
    resource.tags?.some((tag) => concerns.includes(tag)),
  );
}
