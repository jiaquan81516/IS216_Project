// Fixed lists for the Return to work page. These are choices and prompts, not sample records:
// nothing here is added to the plan until the user adds it.

export const TASK_GROUPS = Object.freeze([
  { value: "childcare", label: "Childcare" },
  { value: "work", label: "Work" },
  { value: "home", label: "Home" },
  { value: "pumping", label: "Pumping" },
  { value: "wellbeing", label: "Wellbeing" },
]);

export const SUGGESTED_TASKS = Object.freeze([
  { title: "Talk to your manager about flexible work", group: "work" },
  { title: "Choose childcare and book a trial", group: "childcare" },
  { title: "Plan the morning handover", group: "home" },
  { title: "Find a pumping room near work", group: "pumping" },
  { title: "Pack pump, parts and storage bags", group: "pumping" },
  { title: "Agree who does night duty in the first week back", group: "wellbeing" },
]);

// Areas for the Responsibilities tab. `task` is the title used by "Make a task".
export const RESPONSIBILITY_AREAS = Object.freeze([
  { key: "morning-routine", title: "Morning routine", description: "Getting baby and everyone else ready.", group: "home", task: "Plan the morning routine" },
  { key: "dropoff", title: "Childcare drop-off", description: "Taking baby to childcare before work.", group: "childcare", task: "Plan childcare drop-off" },
  { key: "pickup", title: "Childcare pick-up", description: "Collecting baby at the end of the day.", group: "childcare", task: "Plan childcare pick-up" },
  { key: "sick-days", title: "Sick days and appointments", description: "Staying home or taking baby to the doctor.", group: "childcare", task: "Plan for sick days and appointments" },
  { key: "night-wakeups", title: "Night wake-ups", description: "Who gets up when baby wakes.", group: "wellbeing", task: "Plan night wake-ups" },
  { key: "meals", title: "Meals and groceries", description: "Cooking, shopping and planning meals.", group: "home", task: "Plan meals and groceries" },
  { key: "pumping-supplies", title: "Pumping and feeding supplies", description: "Washing parts, restocking bags and bottles.", group: "pumping", task: "Sort pumping and feeding supplies" },
  { key: "chores", title: "Household chores", description: "Laundry, cleaning and tidying.", group: "home", task: "Split household chores" },
]);

export const PUMPING_ITEMS = Object.freeze([
  { key: "talk-workplace", label: "Talk to your workplace about pumping breaks" },
  { key: "find-room", label: "Find a pumping room near work" },
  { key: "pack-pump", label: "Pack the pump, parts and cooler bag" },
  { key: "plan-storage", label: "Plan how you will store and carry milk" },
  { key: "practice-day", label: "Do one practice day at home" },
]);

export const PUMPING_SESSIONS = Object.freeze([2, 3, 4]);

export const PUMPING_TIMES = Object.freeze([
  { value: "morning", label: "Morning" },
  { value: "midday", label: "Midday" },
  { value: "afternoon", label: "Afternoon" },
]);
