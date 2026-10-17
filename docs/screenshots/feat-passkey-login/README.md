# feat/passkey-login — screenshot review

Screens: sign-in (autofill field + button), sign-in after a cancelled prompt, recovery form,
recovery with wrong phrase, "add a passkey" after a recovery sign-in. Phone, tablet and desktop;
light and dark.

Checked: error states use the danger palette with text (not color alone); the passkey button stays
the primary action at thumb height on phones; "other ways in" read as secondary; the recovery
textarea hint explains that four-letter prefixes are enough.

Found while testing (fixed in code, not visible in screenshots):

- `__Host-` cookies must be set and cleared with `Path=/` and `Secure`. The WebAuthn challenge
  cookie used `Path=/api/`, and sign-out used a bare delete, so browsers ignored both.
- A fast tap before hydration could submit forms natively and reload the page, losing what was
  typed. Submit buttons now stay disabled until React has hydrated.
- One capture hit the recovery lockout after repeated wrong attempts on the same name, which is
  the intended behavior; captures now use a fresh name.
