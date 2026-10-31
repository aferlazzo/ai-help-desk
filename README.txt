AI HELP DESK — QUICK START

ABOUT

AI Help Desk provides friendly technology explanations, how-to help, screenshot descriptions, and one-question-at-a-time troubleshooting. Ollama runs the AI on the Windows host PC. Android uses the PC through the same trusted home Wi-Fi; it is not a standalone or offline Android AI app.

Open “About & How to Use” at the top of the app for the full usage guide.

EVERYDAY USE

Type a question and tap Start once. For troubleshooting follow-ups, use the answer box and Send. To start a new topic, replace the text in the main question box and tap Start.

For an image description, choose Add screenshot, attach a PNG/JPG/WebP up to 5 MB, replace any old question with “Describe this screenshot,” and tap Start. Attaching an image alone does not start analysis. Remove the attachment before starting an unrelated question.

Keep the page open while processing. The elapsed timer is not an estimate of time remaining; local AI may take a minute or several minutes. Cancel stops waiting and asks the AI to stop. Images can be misread, so verify important text and details. Reloading clears the visible conversation; restarting the app ends sessions.

PC STARTUP

Double-click “AI Help Desk.cmd” to start the app.

Optional: right-click “Install-Desktop-Shortcut.ps1” and choose “Run with PowerShell” to add AI Help Desk to the Windows desktop.

The launcher checks Node.js, Ollama, and the required local AI models. If a model is missing, it offers to download it. Starting the launcher again opens the existing app only if it is the same version in the same folder. If an older copy is occupying the port, it reports the conflict instead of opening the wrong copy. Save your work and restart Windows to clear older running copies, then launch from your chosen working folder.

To stop or restart the app, right-click the corresponding PowerShell file and choose “Run with PowerShell”:

  Stop-AI-Help-Desk.ps1
  Restart-AI-Help-Desk.ps1

Logs are written to the run folder. Screenshots and questions are processed locally by Ollama.

ANDROID ON YOUR HOME WI-FI

1. Double-click “Enable Android Access.cmd” and approve the Windows administrator prompt. This permits port 4173 only on Private networks and only from the local subnet.
2. Restart AI Help Desk.
3. Open run\android-url.txt on the PC.
4. Open that private link on the Android device while both devices are connected to the same home Wi-Fi.
5. In Chrome on Android, use “Add to Home screen” if you want an app-style shortcut.

Keep the private link private: it contains the access key for this Help Desk. To close the firewall opening later, double-click “Disable Android Access.cmd”.

PRIVACY AND LIMITATIONS

Questions and images are processed on the host PC, not by cloud AI. The home-network link uses HTTP and is not encrypted. Use only trusted home Wi-Fi, never expose port 4173 through your router, and do not submit passwords or verification codes. System Health reports on the Windows PC, not Android. AI output is not a guarantee that a message or action is safe.
