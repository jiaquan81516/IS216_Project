export function isRequired(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}
