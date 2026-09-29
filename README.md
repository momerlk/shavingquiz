# shavingquiz

Two-tap audience quiz and five-minute Gillette presentation for LUMS SS100.

Audience: https://gilletterazor.netlify.app
Presenter: https://gilletterazor.netlify.app/presenter

Run locally with `npm install && npm start`. Open `/presenter` for the QR code and controls; the PIN prints in the terminal. The presenter controls the shared timer.

The quiz is designed to take about 20 seconds. It asks where shaving happens (including “I don't shave”) and what confidence means. All genders can answer. Answers are not sent to the server; the result is the team's fixed finding: 91% of respondents shave in their room or washroom.

Set `PRESENTER_PIN` to keep a stable PIN. Only the presentation timer uses the server in this flow.
