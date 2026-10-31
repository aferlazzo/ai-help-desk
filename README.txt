AI HELP DESK — QUICK START

Double-click “AI Help Desk.cmd” to start the app.

Optional: right-click “Install-Desktop-Shortcut.ps1” and choose “Run with PowerShell” to add AI Help Desk to the Windows desktop.

The launcher checks Node.js, Ollama, and the required local AI models. If a model is missing, it offers to download it. Starting the launcher again while AI Help Desk is already running simply opens the existing app.

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
