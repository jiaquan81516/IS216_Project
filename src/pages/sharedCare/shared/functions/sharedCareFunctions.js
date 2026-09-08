export function findCaregiverById(caregivers, id) {
  return (
    caregivers.find((caregiver) => String(caregiver.id) === String(id)) ?? null
  );
}
