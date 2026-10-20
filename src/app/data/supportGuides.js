import { ROUTES } from "@/app/routes";

// Support page content: in-the-moment tools, the "more than tired" check and the guides.
// General guidance only, written from the sources listed on each guide. Not medical advice.
// Before the demo: check every figure and link against its source, and the numbers in support.js.

const guideLink = (id) => ({ path: ROUTES.SUPPORT, query: { guide: id } });

// For the hardest five minutes. Short, numbered, no reading required.
export const RIGHT_NOW = Object.freeze([
  {
    id: "crying",
    label: "The crying will not stop and I am at my limit",
    steps: [
      "Check the basics once: fed, clean nappy, not too hot or cold.",
      "If you feel yourself losing it, lay the baby on their back in the cot and leave the room. A crying baby in a safe cot is safe.",
      "Take ten minutes. Breathe out slowly, drink some water, call your partner or someone you trust.",
      "Go back when you feel calmer. However angry you feel, never shake a baby.",
    ],
    note: "Crying often builds from about two weeks, peaks around six to eight weeks and eases by three to four months. It is not a sign you are doing it wrong.",
    link: { label: "Baby will not settle", to: { path: ROUTES.SUPPORT, query: { tab: "baby" } } },
  },
  {
    id: "spiral",
    label: "My head will not switch off",
    steps: [
      "Put both feet on the floor. Breathe in for four, out for six, five times.",
      "Name five things you can see. It pulls your attention back into the room.",
      "Write the worry down as one question you can ask someone tomorrow. Then put the paper down.",
      "If the thought is about the baby getting hurt, it may be an intrusive thought. They are common and they pass.",
    ],
    link: { label: "Read: Scary thoughts you did not ask for", to: guideLink("scary-thoughts") },
  },
  {
    id: "snapping",
    label: "I am about to snap at my partner",
    steps: [
      "Say \"I need ten minutes, I will come back\" and leave the room. Saying when you will come back is what makes it a pause, not storming off.",
      "Eat or drink something. Hunger and exhaustion make everything sharper.",
      "Ask yourself what you actually need. It is usually sleep, a hand, or to be heard.",
      "Go back and ask for that one thing.",
    ],
    link: { label: "Read: Arguing more since the baby", to: guideLink("us") },
  },
  {
    id: "cant-sleep",
    label: "I cannot sleep, even though I could",
    steps: [
      "After about twenty minutes awake, get up. Lying there trying makes it harder.",
      "Keep the light low and the phone away. Do something dull, like folding clothes.",
      "Go back to bed when you feel sleepy. Lying still with your eyes closed is still some rest.",
      "If this happens most nights, tell a doctor. Not sleeping when you have the chance is worth mentioning.",
    ],
    link: { label: "Take the check below", check: true },
  },
]);

// The check. Questions 1 and 2 are urgent on their own; 3 to 5 point to a doctor this week.
export const CHECK_QUESTIONS = Object.freeze([
  {
    id: "harm",
    urgent: true,
    me: "Have you had thoughts of harming yourself or the baby, or felt you cannot keep yourself safe?",
    partner: "Have they talked about harming themselves or the baby, or about not wanting to be here?",
  },
  {
    id: "psychosis",
    urgent: true,
    me: "Have you felt confused, seen or heard things others do not, or gone days without sleep and still felt wired?",
    partner: "Have they seemed confused or suspicious, seen or heard things, or gone days without sleep and still seemed wired?",
  },
  {
    id: "two-weeks",
    me: "Has low mood, worry or irritability been there most days for more than two weeks?",
    partner: "Have they seemed low, anxious or irritable most days for more than two weeks?",
  },
  {
    id: "sleep",
    me: "Do you struggle to sleep even when the baby is asleep and someone else is on duty?",
    partner: "Do they struggle to sleep even when the baby is asleep and you are on duty?",
  },
  {
    id: "coping",
    me: "Is it getting in the way of eating, looking after yourself or the baby, or enjoying anything at all?",
    partner: "Is it getting in the way of them eating, looking after themselves or the baby, or enjoying anything at all?",
  },
]);

// "urgent" | "doctor" | "ordinary" | null while unanswered.
export function checkResult(answers) {
  const urgent = CHECK_QUESTIONS.filter((q) => q.urgent);
  if (urgent.some((q) => answers[q.id] === true)) return "urgent";
  if (CHECK_QUESTIONS.some((q) => answers[q.id] === undefined)) return null;
  return CHECK_QUESTIONS.some((q) => answers[q.id] === true) ? "doctor" : "ordinary";
}

export const CHECK_RESULTS = Object.freeze({
  doctor: {
    title: "Worth seeing a doctor this week",
    body: "What you described sounds like more than ordinary tiredness, and it is very treatable. A GP or polyclinic is a good first stop. It helps to say how long it has been going on and what it is getting in the way of.",
    script: {
      me: "I don't think this is just tiredness. I've felt low and on edge most days for a couple of weeks, and I can't sleep even when I get the chance.",
      partner: "I'm worried about you. You've seemed really down for a while. Could I book a doctor's appointment and come with you?",
    },
    links: [
      { label: "Add an appointment", to: ROUTES.CALENDAR },
      { label: "Read: Baby blues, or something more?", to: guideLink("more-than-tired") },
    ],
  },
  ordinary: {
    title: "This sounds like the ordinary hard part",
    body: "Nothing you tapped suggests you need a doctor right now. Protect a block of sleep, ask for one specific thing, and take this check again in a week. If anything changes, come back sooner.",
    links: [
      { label: "Read: Sleep as a team", to: guideLink("sleep") },
      { label: "Open sleep rota", to: ROUTES.ROTA },
    ],
  },
});

export const GUIDES = Object.freeze([
  {
    id: "more-than-tired",
    title: "Baby blues, or something more?",
    summary: "How to tell the ordinary hard from something a doctor can help with.",
    facts: [
      "Most mothers have a few days of tears, mood swings and worry in the first week after birth. This is the baby blues, and it usually passes within two weeks.",
      "Postnatal depression and anxiety last longer and go deeper. Around 1 in 7 mothers and about 1 in 10 fathers are affected, at any point in the first year.",
      "It does not always look like sadness. It can look like constant worry, irritability, feeling numb, or feeling like a bad parent.",
      "It is treatable, and the earlier it is mentioned, the sooner it usually lifts.",
    ],
    helps: [
      { text: "Count the days. If it has been most days for more than two weeks, it needs a doctor, not more willpower." },
      { text: "Protect one longer block of sleep. Sleep loss makes everything feel worse, and it is the easiest thing to change.", link: { label: "Open sleep rota", to: ROUTES.ROTA } },
      { text: "Tell one person exactly how it feels. Not \"fine, just tired\"." },
      { text: "Book the appointment while you feel able to. Your partner can make the call and come with you.", link: { label: "Add to calendar", to: ROUTES.CALENDAR } },
    ],
    script: "I don't think this is just tiredness any more. I've felt low and on edge most days for a couple of weeks. Can you help me book a doctor?",
    getHelp: [
      { text: "Low mood, worry or irritability most days for more than two weeks" },
      { text: "You cannot sleep even when the baby is asleep and someone else is on duty" },
      { text: "You have stopped eating properly, or cannot enjoy anything at all" },
      { text: "Thoughts of harming yourself or the baby. Get help today: call 995 if anyone is in danger, or SOS on 1767 to talk now.", urgent: true },
    ],
    sources: [
      { title: "Postnatal depression", publisher: "NHS", url: "https://www.nhs.uk/mental-health/conditions/post-natal-depression/overview/" },
      { title: "Postpartum depression", publisher: "ACOG", url: "https://www.acog.org/womens-health/faqs/postpartum-depression" },
    ],
  },
  {
    id: "scary-thoughts",
    title: "Scary thoughts you did not ask for",
    summary: "Sudden pictures of the baby getting hurt are common. What they mean, and what they do not.",
    facts: [
      "Most new parents get sudden, unwanted thoughts or pictures of the baby being hurt: dropped, drowned, smothered. Many even get thoughts of doing it themselves.",
      "These thoughts feel horrible because you do not want them. That distress shows how much you care. It does not predict what you will do.",
      "Pushing them away hard, checking, or avoiding the baby tends to make them come back more often.",
    ],
    helps: [
      { text: "Name it: \"that is an intrusive thought\". You do not have to argue with it or check anything." },
      { text: "Let it sit there while you carry on with what you were doing. It usually fades on its own." },
      { text: "Tell your partner or a doctor. Saying it out loud takes away a lot of its power, and doctors hear this often." },
      { text: "Watch for avoidance. If you have stopped bathing the baby or hidden the knives because of the thoughts, mention it to a doctor. This is very treatable." },
    ],
    script: "I keep getting horrible thoughts about the baby getting hurt. I know I won't act on them, but they frighten me. Can you just listen?",
    getHelp: [
      { text: "The thoughts take up hours of your day or stop you caring for the baby" },
      { text: "You avoid being alone with the baby because of them" },
      { text: "The thoughts feel right or reasonable rather than frightening, or come with confusion, seeing or hearing things, or days without sleep. This can be postpartum psychosis, which is an emergency. Call 995 or go to A&E.", urgent: true },
    ],
    sources: [
      { title: "Postpartum psychosis", publisher: "NHS", url: "https://www.nhs.uk/mental-health/conditions/post-partum-psychosis/" },
      { title: "Learn more about perinatal mental health", publisher: "Postpartum Support International", url: "https://postpartum.net/learn-more/" },
    ],
  },
  {
    id: "sleep",
    title: "Sleep as a team",
    summary: "Broken sleep wears mood down fastest. Two adults can protect more of it than one.",
    facts: [
      "Weeks of broken sleep lower mood, patience and the ability to cope, for both parents.",
      "One longer unbroken stretch tends to restore more than the same hours in short pieces.",
      "Lying down while still listening for the baby is not rest. The resting parent needs to be properly off duty.",
    ],
    helps: [
      { text: "Split the night into shifts so each of you gets one protected block of four to five hours.", link: { label: "Open sleep rota", to: ROUTES.ROTA } },
      { text: "The resting parent sleeps in another room with earplugs if possible. The parent on duty wakes them only for a reason you agreed beforehand." },
      { text: "If the baby only feeds from the breast, the other parent can do the nappy, burping and settling, then take the baby back." },
      { text: "Agree what can slide this week: laundry, visitors, messages." },
    ],
    script: "Can we each take a shift tonight? I'll do six to midnight, you do midnight to six, and we don't wake each other unless it's a feed.",
    getHelp: [
      { text: "You cannot sleep even when given the chance, for several nights in a row" },
      { text: "You are so tired you worry about dropping the baby or driving safely" },
      { text: "Feeding makes shifts impossible. A lactation consultant can help you plan around it." },
    ],
    sources: [
      { title: "Surviving sleep deprivation with a baby", publisher: "HealthHub Singapore", url: "https://www.healthhub.sg/well-being-and-lifestyle/pregnancy-and-infant-health/surviving-sleep-deprivation-with-a-baby" },
    ],
  },
  {
    id: "worried-about-partner",
    title: "When you are worried about your partner",
    summary: "What to look for, how to bring it up, and what not to say.",
    facts: [
      "The partner is often the first to notice, because the person struggling may not see it, or may be hiding it.",
      "Signs can be quiet: withdrawing, snapping, not eating, not sleeping when they could, calling themselves a bad parent, or seeming flat.",
      "Both parents can be affected. In dads it often shows as anger, longer hours at work, drinking more or going distant.",
    ],
    helps: [
      { text: "Pick a calm moment, not the middle of a night shift or an argument." },
      { text: "Describe what you have seen rather than naming a condition: \"You've seemed really low since the baby came\" rather than \"You're depressed\"." },
      { text: "Take something off their plate before asking anything of them. Offer to book the appointment and go with them.", link: { label: "Add to calendar", to: ROUTES.CALENDAR } },
      { text: "Keep checking in. One talk is rarely enough." },
    ],
    avoid: ["\"Everyone gets tired.\"", "\"Just think positive.\"", "\"You have so much to be happy about.\""],
    script: "I've noticed you seem really down lately and I'm worried about you. You're doing a good job with the baby. Would you let me book a doctor's appointment with you?",
    getHelp: [
      { text: "They talk about being a burden, wanting to disappear, or not being here. Get help today: SOS on 1767, any time.", urgent: true },
      { text: "They seem confused or suspicious, are not making sense, or have not slept for days. Call 995.", urgent: true },
      { text: "You are struggling too. The check on this page works for you as well." },
    ],
    sources: [
      { title: "Postnatal depression", publisher: "NHS", url: "https://www.nhs.uk/mental-health/conditions/post-natal-depression/overview/" },
      { title: "Help for dads", publisher: "Postpartum Support International", url: "https://postpartum.net/get-help/help-for-dads/" },
    ],
  },
  {
    id: "dads",
    title: "Dads struggle too",
    summary: "Pressure to provide, feeling like the spare pair of hands, and why it often shows up as anger.",
    facts: [
      "About 1 in 10 fathers have depression in the year after a birth, and the risk is higher when their partner is struggling too.",
      "In men it often looks like irritability, anger, working late, drinking or gaming more, or pulling away, rather than sadness.",
      "Many dads feel like the support act: expected to stay strong and provide, with nowhere to put their own worries.",
    ],
    helps: [
      { text: "Name the specific pressure. \"Money if my contract ends\" can be planned for. \"Everything\" cannot." },
      { text: "Own one care routine completely, like the bath or the first night shift. Closeness with the baby grows from doing, not watching.", link: { label: "Open sleep rota", to: ROUTES.ROTA } },
      { text: "Keep one thing that is yours: a run, a call with a friend, half an hour with no screen." },
      { text: "Talk to another dad. Most feel the same and assume they are the only one." },
    ],
    script: "I've been carrying a lot quietly, mostly about money and work. I don't need you to fix it. Can we sit down this week and look at it together?",
    getHelp: [
      { text: "Anger, low mood or withdrawal most days for more than two weeks" },
      { text: "Drinking more to cope" },
      { text: "Thoughts that your family would be better off without you. Get help today: SOS on 1767, any time.", urgent: true },
    ],
    sources: [{ title: "Help for dads", publisher: "Postpartum Support International", url: "https://postpartum.net/get-help/help-for-dads/" }],
  },
  {
    id: "us",
    title: "Arguing more since the baby",
    summary: "Why it happens to most couples, and how to argue less badly.",
    facts: [
      "Most couples report more conflict and feel less satisfied with the relationship in the first years after a baby. It is common, not a sign you chose wrong.",
      "Most fights at this stage are about fairness and exhaustion, not the dishes themselves.",
      "Invisible work counts: remembering appointments, ordering nappies, noticing what is running low.",
    ],
    helps: [
      { text: "Start soft. \"I'm stretched and I need help with the nights\" lands better than \"You never get up\"." },
      { text: "Make the invisible work visible. Write down every task, including the remembering, and split it out loud." },
      { text: "When it is getting heated, call a pause and say when you will come back to it." },
      { text: "Repair matters more than never fighting. \"That came out wrong\" is enough to start." },
      { text: "Leave a note in the handover that is not about logistics.", link: { label: "Open handover", to: ROUTES.HANDOVER } },
    ],
    script: "I don't want to fight about this. I'm exhausted and I think you are too. Can we look at who is doing what and make it fairer?",
    getHelp: [
      { text: "Arguments feel frightening, or anyone feels unsafe at home. Call 999 for the police if you are in danger.", urgent: true },
      { text: "Weeks of not really talking to each other" },
      { text: "Couples counselling is a normal step, not a last resort." },
    ],
    sources: [{ title: "Bringing Baby Home", publisher: "The Gottman Institute", url: "https://www.gottman.com/" }],
  },
  {
    id: "body",
    title: "Your body after birth",
    summary: "Recovery takes longer than social media suggests. What is common, and what to get checked.",
    facts: [
      "Recovery from birth takes months, not weeks, even after a straightforward birth.",
      "Bleeding, a soft tummy, sore breasts, hair loss and leaking a little when you cough or laugh are all common in the early months.",
      "Feeling like a stranger in your own body is common, and it is not vanity.",
    ],
    helps: [
      { text: "Choose comfort first: clothes that fit now, not the old ones." },
      { text: "Mute accounts that make you feel behind. Their timeline is not yours." },
      { text: "Ask about pelvic floor exercises and a women's health physiotherapist at your postnatal check.", link: { label: "Add to calendar", to: ROUTES.CALENDAR } },
      { text: "Tell your partner what helps: reassurance, space, or taking the baby so you can shower and eat." },
    ],
    script: "I'm finding it hard to feel like myself in my body. I don't need advice. I just need you to be kind about it.",
    getHelp: [
      { text: "Sudden or very heavy bleeding, a fever, or a wound that is red, swollen or smelly. See a doctor today.", urgent: true },
      { text: "Leaking or pain that is not getting better after a few months" },
      { text: "Avoiding food, mirrors or being touched, or distress that takes over your day" },
    ],
    sources: [{ title: "Postpartum recovery", publisher: "ACOG", url: "https://www.acog.org/womens-health/videos/postpartum-recovery" }],
  },
  {
    id: "back-to-work",
    title: "Going back to work",
    summary: "Guilt, logistics and pumping, and how to settle them before day one.",
    facts: [
      "Mixed feelings are normal. Relief and guilt often arrive together.",
      "The first few weeks back are usually the hardest, while everyone adjusts.",
      "Most of the stress comes from what is not decided yet: drop off, sick days, who leaves early.",
    ],
    helps: [
      { text: "Decide the plan for a sick baby before the first day, not on the morning.", link: { label: "Open return to work", to: ROUTES.RETURN_TO_WORK } },
      { text: "Do a practice run of the morning a week before." },
      { text: "If you are pumping, find a room near work and pack spare parts the night before.", link: { label: "Find a pumping room", to: ROUTES.ROOMS } },
      { text: "Make the first week lighter on purpose: no big deadlines, simple dinners." },
    ],
    script: "Before I go back, can we decide who handles sick days and who does drop off, so we're not working it out at 7 AM?",
    getHelp: [
      { text: "Dread or low mood that is still there a month after going back" },
      { text: "Panic before work or on the commute" },
      { text: "Supply or feeding worries. A lactation consultant can help." },
    ],
    sources: [{ title: "Mummy's off to work", publisher: "HealthHub Singapore", url: "https://www.healthhub.sg/well-being-and-lifestyle/pregnancy-and-infant-health/baby-mummys-off-to-work" }],
  },
  {
    id: "difficult-birth",
    title: "After a difficult birth",
    summary: "When the birth keeps replaying, for either parent.",
    facts: [
      "Many parents find parts of their birth frightening, including partners who watched it happen.",
      "Replaying it, feeling on edge, or avoiding the hospital are common in the weeks after.",
      "For most people this eases. For some it becomes post traumatic stress, which is treatable.",
    ],
    helps: [
      { text: "Ask your hospital for a birth debrief, to go through what happened and why." },
      { text: "Tell the story to someone who will listen without trying to fix it." },
      { text: "Partners: your experience counts too, even if you were not the one giving birth." },
      { text: "Notice what sets it off, like smells, places or appointments, and plan support around them." },
    ],
    script: "I keep thinking about the birth. Can I tell you what it was like for me?",
    getHelp: [
      { text: "Flashbacks or nightmares a month or more after the birth" },
      { text: "Avoiding the baby, the hospital or the idea of another pregnancy because of it" },
      { text: "Feeling numb or constantly on edge" },
    ],
    sources: [{ title: "Birth Trauma Association", publisher: "Birth Trauma Association", url: "https://www.birthtraumaassociation.org.uk/" }],
  },
]);
