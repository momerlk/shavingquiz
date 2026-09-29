# shavingquiz

Three-tap audience poll and five-minute Gillette presentation for LUMS SS100.

Run locally with `npm install && npm start`. Open `/presenter` for the QR code and controls; the PIN prints in the terminal. Audience answers stay on the server, and the presenter controls the shared timer.

The poll is designed to take about 20 seconds. It asks where shaving happens (including “I don't shave”), how the Khokha scene looks, and what confidence means. All genders can answer. The 90% figure in the presenter notes comes from the team's separate research, not the live poll.

Set `PRESENTER_PIN` to keep a stable PIN. Set `DATA_FILE` to change the vote file location. On ephemeral hosts, answers reset when the server instance is replaced; for this live presentation, keep one instance and leave audience polling active.
