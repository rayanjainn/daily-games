# feat/email-channel

Phone, tablet and desktop, light and dark.

| Capture             | What it shows                                                              |
| ------------------- | -------------------------------------------------------------------------- |
| `email-unconfirmed` | After adding an address: "Not confirmed", resend, change, remove, toast     |
| `email-confirmed`   | Confirmed address, and "Also email me" switched on in Reminders            |
| `email-verify-page` | The confirmation page for a link that doesn't work                         |

Checked: links are single use and die when the address changes; email reminders can't be turned
on before confirming; an address can belong to one account only (case-insensitive); axe passes
on the confirmation page (`email.spec.ts`).
