AI Help Desk 2.0 — Working Version with System Health Dashboard

NEW
The home screen now includes System Health.

It reads basic Windows information and shows:
- PC manufacturer/model, CPU, memory, BIOS
- Windows edition/version/build
- pending Windows restart and available software updates
- disk free space, with low-space warnings
- current Wi-Fi network name and signal
- detected sound device and device status
- installed/connected printer names and default printer
- Windows Security status
- default email client and Outlook profile name
- Windows devices/peripherals reporting a problem

PRIVACY
The dashboard does not display email passwords, Wi-Fi passwords, product keys,
browser passwords, or other credentials.

CURRENT SOUND LIMITATION
Windows' basic management interfaces do not consistently expose the current
speaker mute/volume state. This version reports the sound device and health
without guessing. Exact mute/volume detection can be added with a small signed
Windows helper in the next iteration.

RUN
node ai-help-desk-2-working-with-system-health.js

It opens:
http://127.0.0.1:4173
