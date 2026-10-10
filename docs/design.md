# Design handoff: Prototype B (Preline)

Figma: https://www.figma.com/design/EQ8l3puqd2k146elsbasST?node-id=102-22161
All frames are 1440 wide. Mobile (390) is not designed yet.

## Pages, Figma node IDs and suggested routes
| Page | Node ID | Route |
|---|---|---|
| Landing | 88:108669 | / |
| Sign up | 91:368 | /signup |
| Sign in | 101:2014 | /signin |
| Google hand-off | 101:2068 | /signin/google |
| About you | 91:435 | /setup/about |
| Your baby | 91:605 | /setup/baby |
| Invite your partner | 91:821 | /setup/partner |
| Nights and alerts | 101:1753 | /setup/nights |
| Partner joins (Mei) | 101:1953 | /join/:code |
| Home | 96:639 | /home |
| Care log | 83:267 | /care-log |
| Add entry | 98:1775 | /care-log/new |
| Handover (send) | 98:110129 | /handover |
| Handover received | 98:110288 | /handover/received |
| Sleep rotation | 97:724 | /rota |
| Calendar | 97:946 | /calendar |
| Check-in (private) | 99:1439 | /check-in |
| Help, Right now | 100:1586 | /help |
| Help, Reading | 100:1775 | /help/reading |
| Guide | 100:1930 | /help/guide/:topic |
| Return to work | 99:1607 | /return-to-work |
| Pumping rooms | 98:818 | /pumping-rooms |
| Room detail | 98:1319 | /pumping-rooms/:id |
| Add or update a room | 98:1571 | /pumping-rooms/new |

## Click flow (also wired in Figma as prototype links)
- Landing: Create your household -> Sign up; Sign in -> Sign in.
- Sign up and Sign in: Continue with Google -> Google hand-off. Returning parent -> Home. New account -> About you -> Your baby -> Invite -> Nights -> Home.
- Mei: Partner joins -> Google -> Home.
- Header nav on every app page: Home, Care log, Sleep rotation, Calendar, Resources (opens Help).
- Home: Add to care log -> Add entry; swap buttons -> Sleep rotation; Start your check-in -> Check-in; handover link -> Handover; Return to work card -> Return to work.
- Care log: Hand over -> Handover -> Handover received (Mei) -> Home. Add entry -> Add entry -> Care log.
- Help: Right now / Reading tabs, Guide, Check-in. Return to work -> Pumping rooms -> Room detail -> Add room.

## Suggested build order
1. App shell: header nav, layout, tokens in main.css, auth guard (sign in already done on dev/jq/signin).
2. Onboarding flow and household creation in Firestore (two users linked by an invite code).
3. Home and Care log (shared entries, "seen by" state), Add entry.
4. Sleep rotation, then Handover (needs on-call state), then Calendar sync.
5. Check-in (private per user, enforce in Firestore rules).
6. Help, Return to work, Pumping rooms.
7. FCM push (feed reminders, handover alerts) and the 390px mobile layouts.

## Data notes
Household has two members. Care log entries are shared. Check-ins, confidence rating and private reminders are per user and must never be readable by the partner (Firestore rules, not just UI).

## Open items
Sample copy to review: role descriptions, Sign up privacy line, Invite subtitle. Verify helpline numbers, doctor thresholds, mall details. Not designed yet: Settings, linked partner screen, bell menu, mobile layouts.
