// Seed: `supportTickets` — the member support inbox (Prompt 05 §4.3).
//
// Four tickets covering every TICKET_STATUS. One comes from a signed-out
// visitor, so `userId` is absent and the contact details on the ticket are the
// only way to reply — which is exactly why `name` and `email` are stored on
// the ticket rather than read from the account.

import { TICKET_STATUS } from '../../src/constants/statuses.js'
import { addDays, compact, daysAgo, seqId } from '../seed-utils.js'
import { ADMIN_ID, buyerId, creatorId } from './users.js'

const TICKET_SOURCE = [
  {
    name: 'Ruth Kalu',
    email: 'ruth@harborlanecafe.test',
    subject: 'Usage rights before I post my first brief',
    body: 'I run a small cafe and want to commission photos for our website and a local print ad. Do I need to choose full commercial rights for print, or is the website option enough? I would rather get this right in the brief than sort it out afterwards.',
    status: TICKET_STATUS.OPEN,
    createdDaysAgo: 2,
    replies: [],
  },
  {
    userId: buyerId('craftware'),
    name: 'Owen Bailey',
    email: 'owen.bailey@craftwaretools.test',
    subject: 'Can our dispute be held open while we wait for a part?',
    body: 'We have an open dispute about a missing demonstration film. The part needed to film it is on back order and we would rather wait for the film than take a refund. Can the case stay open for another two weeks?',
    status: TICKET_STATUS.PENDING,
    createdDaysAgo: 11,
    replies: [
      {
        byId: ADMIN_ID.MAYA,
        afterDays: 1,
        body: 'Yes — a case can stay open while both parties are working towards delivery, and the payment stays held in escrow the whole time. Could you confirm the expected date for the part so I can note it on the case?',
      },
    ],
  },
  {
    userId: creatorId('mateo'),
    name: 'Mateo Rossi',
    email: 'mateo@rossieventfilm.test',
    subject: 'Re-submitting a portfolio item after changes were requested',
    body: 'One of my venue films came back with changes requested. I have re-graded it and fixed the aspect ratio. Do I upload it as a new item or update the existing one so the review history stays together?',
    status: TICKET_STATUS.RESOLVED,
    createdDaysAgo: 10,
    replies: [
      {
        byId: ADMIN_ID.PRIYA,
        afterDays: 0.5,
        body: 'Update the existing item and send it back for review — that keeps the whole history on one record, and the reviewer can see what changed. Uploading a new item starts the review from scratch and loses that context.',
      },
      {
        byId: creatorId('mateo'),
        afterDays: 1,
        body: 'Perfect, updated and re-submitted. Thanks for the quick answer.',
      },
    ],
  },
  {
    userId: creatorId('chloe'),
    name: 'Chloe Dubois',
    email: 'chloe@duboisbeautystudio.test',
    subject: 'Appealing my account suspension',
    body: 'My account was suspended over a licensing question on a backdrop I used. I have the commercial licence for it and can send the receipt. Could someone review this so I can get back to work?',
    status: TICKET_STATUS.CLOSED,
    createdDaysAgo: 27,
    replies: [
      {
        byId: ADMIN_ID.MAYA,
        afterDays: 2,
        body: 'Thank you for sending the licence. The suspension covers two separate matters — the licensing question and an unresolved order that was refunded in full — so the review stays open while we work through both. I have added your documentation to the case.',
      },
      {
        byId: ADMIN_ID.MAYA,
        afterDays: 6,
        body: 'Closing this ticket so everything stays on the account review itself. You will hear directly from the reviewing team, and your balance and payout details are unaffected in the meantime.',
      },
    ],
  },
]

export const supportTickets = TICKET_SOURCE.map((source, index) => {
  const createdAt = daysAgo(source.createdDaysAgo, 10, 5)
  return compact({
    id: seqId('tkt', index + 1),
    name: source.name,
    email: source.email,
    userId: source.userId,
    subject: source.subject,
    body: source.body,
    status: source.status,
    replies: source.replies.map((reply) => ({
      byId: reply.byId,
      body: reply.body,
      at: addDays(createdAt, reply.afterDays),
    })),
    createdAt,
  })
})
