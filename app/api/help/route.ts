type Message = { role: 'helper' | 'user'; text: string };
type Answer = 'yes' | 'no' | 'unknown';

const Q = {
  printerQueue: 'When you try to print, does the print job appear in the print queue on your device?',
  printerSelected: 'In the print window, is the intended printer selected?',
  printerStatus: 'Does the queued print job show Paused, Offline, or an error?',
  internetScope: 'Are all devices unable to use the internet, or only this device?',
  internetWifi: 'Does this device show that it is connected to your usual Wi-Fi network?',
  internetGateway: 'Does your modem or gateway show a red or warning light?',
  websiteOthers: 'Can you open other websites on this device?',
  websiteDevice: 'Can another device open that same website?',
  emailScope: 'Can you receive new email, even though sending is not working?',
  emailWeb: 'Can you sign in and use the email account on its official website?',
  emailError: 'Does the email app show a specific error message?',
  tasksAccount: 'Are you signed in to the same Google account that previously contained the tasks?',
  tasksWeb: 'Do the missing tasks appear at tasks.google.com?',
  tasksList: 'In Google Tasks, is a different task list selected?',
  messagesScope: 'Are new text messages missing from only one person, or from everyone?',
  messagesBlocked: 'In Google Messages, is that person listed under Spam & blocked?',
  messagesSend: 'Can you send a text message successfully?',
} as const;

function validMessage(item: unknown): item is Message {
  return Boolean(item && typeof item === 'object' && 'role' in item && 'text' in item &&
    (item.role === 'helper' || item.role === 'user') && typeof item.text === 'string');
}

function answer(text: string): Answer {
  const value = text.toLowerCase();
  if (/\b(no|nope|not|doesn'?t|does not|isn'?t|is not|cannot|can'?t)\b/.test(value)) return 'no';
  if (/\b(yes|yeah|yep|it does|it is|connected|appears|shows)\b/.test(value)) return 'yes';
  return 'unknown';
}

function mentions(text: string, words: string[]) {
  const value = text.toLowerCase();
  return words.some((word) => value.includes(word));
}

function mentionsWebsite(text: string) {
  return mentions(text, ['website', 'web site', 'site', 'webpage', 'web page', 'browser']) ||
    /\b(?:https?:\/\/|www\.)?[^\s.]+\.(?:com|org|net|edu|gov|io|co|us)\b/i.test(text);
}

function clarify(question: string) {
  return `Please answer with the closest choice you see: ${question}`;
}

function originalQuestion(text: string | undefined) {
  const prefix = 'Please answer with the closest choice you see: ';
  return text?.startsWith(prefix) ? text.slice(prefix.length) : text;
}

function nextReply(messages: Message[]) {
  const latest = messages.filter((message) => message.role === 'user').at(-1)?.text.trim() || '';
  const previous = originalQuestion([...messages].reverse().find((message) => message.role === 'helper')?.text);

  if (!previous || !Object.values(Q).includes(previous as never)) {
    if (mentions(latest, ['google messages', 'conversation', 'text message', 'message']) && mentions(latest, ['unread', 'looks unread'])) {
      return 'In Google Messages, touch and hold the conversation. Tap More (the three dots), then tap Mark as unread.';
    }
    if (mentions(latest, ['printer', 'print'])) return Q.printerQueue;
    if (mentionsWebsite(latest) && mentions(latest, ['can\'t', 'cannot', 'unable', 'won\'t', 'not reach', 'not open', 'down'])) return Q.websiteOthers;
    if (mentions(latest, ['internet', 'wi-fi', 'wifi', 'online', 'connection'])) return Q.internetScope;
    if (mentions(latest, ['email', 'gmail', 'outlook', 'mail'])) return Q.emailScope;
    if (mentions(latest, ['google task', 'tasks missing', 'missing tasks'])) return Q.tasksAccount;
    if (mentions(latest, ['text', 'texts', 'sms', 'google messages', 'message from', 'messages from'])) return Q.messagesScope;
    return 'ESCALATE: This problem is not in the guided help library yet. Please use the device or service provider’s official support channel.';
  }

  const result = answer(latest);
  switch (previous) {
    case Q.printerQueue:
      return result === 'yes' ? Q.printerStatus : result === 'no' ? Q.printerSelected : clarify(Q.printerQueue);
    case Q.printerSelected:
      return result === 'no' ? 'Select the intended printer in the print window, then try printing again.' :
        result === 'yes' ? 'ESCALATE: The print job is not reaching a correctly selected printer. The next steps depend on the device and printer connection.' : clarify(Q.printerSelected);
    case Q.printerStatus:
      return result === 'yes' ? 'Open the queued job, clear Paused or Offline if shown, then try printing again.' :
        result === 'no' ? 'ESCALATE: The job reaches the queue without a visible status error. The printer connection needs device-specific checking.' : clarify(Q.printerStatus);

    case Q.internetScope:
      if (mentions(latest, ['all', 'every'])) return Q.internetGateway;
      if (mentions(latest, ['only', 'one', 'this device', 'just'])) return Q.internetWifi;
      return clarify(Q.internetScope);
    case Q.internetWifi:
      return result === 'no' ? 'Connect the device to your usual Wi-Fi network, then try opening a website again.' :
        result === 'yes' ? 'Turn Wi-Fi off on this device, wait ten seconds, turn it back on, and try again.' : clarify(Q.internetWifi);
    case Q.internetGateway:
      return result === 'yes' ? 'Restart the modem or gateway once, allow up to ten minutes for it to reconnect, then test the internet again.' :
        result === 'no' ? 'ESCALATE: All devices are affected without a gateway warning. Contact the internet provider to check the service connection.' : clarify(Q.internetGateway);
    case Q.websiteOthers:
      return result === 'yes' ? Q.websiteDevice : result === 'no' ? Q.internetScope : clarify(Q.websiteOthers);
    case Q.websiteDevice:
      return result === 'yes' ? 'The website is working, so the problem is limited to this device or browser. Open the website in a private or incognito window and try again.' :
        result === 'no' ? 'The website may be temporarily unavailable. Wait a few minutes, then check the website’s official status or support page.' : clarify(Q.websiteDevice);

    case Q.emailScope:
      return result === 'yes' ? Q.emailError : result === 'no' ? Q.emailWeb : clarify(Q.emailScope);
    case Q.emailWeb:
      return result === 'yes' ? 'The account works, so the problem is limited to the email app. Confirm the password and recovery information before removing and re-adding the account.' :
        result === 'no' ? 'Use the email provider’s official account-recovery page. Do not share your password or verification code.' : clarify(Q.emailWeb);
    case Q.emailError:
      return result === 'yes' || latest.length > 8 ? 'ESCALATE: Record the exact error message and contact the email provider’s official support channel.' :
        'Send a small test message to yourself. If it fails, record the exact error shown.';

    case Q.tasksAccount:
      return result === 'no' ? 'Switch to the Google account that originally contained the tasks, then check Google Tasks again.' :
        result === 'yes' ? Q.tasksWeb : clarify(Q.tasksAccount);
    case Q.tasksWeb:
      return result === 'yes' ? 'The tasks are safe in the account. Refresh or update the Google Tasks app, then reopen it.' :
        result === 'no' ? Q.tasksList : clarify(Q.tasksWeb);
    case Q.tasksList:
      return result === 'yes' ? 'Select each task list in turn; the missing tasks may be stored in another list.' :
        result === 'no' ? 'ESCALATE: The tasks are absent from the account and its lists. Use Google’s official support and recovery options.' : clarify(Q.tasksList);

    case Q.messagesScope:
      if (mentions(latest, ['only', 'one', 'person', 'someone', 'just'])) return Q.messagesBlocked;
      if (mentions(latest, ['all', 'everyone', 'everybody', 'anyone'])) return Q.messagesSend;
      return clarify(Q.messagesScope);
    case Q.messagesBlocked:
      return result === 'yes' ? 'Open Spam & blocked, select the conversation, and tap Unblock. Ask the person to send one new test message.' :
        result === 'no' ? 'Ask that person to send one new test message. If it still does not arrive, contact your mobile carrier and give them the sender’s number and the time of the test.' : clarify(Q.messagesBlocked);
    case Q.messagesSend:
      return result === 'yes' ? 'Restart the phone once, then ask someone to send one new test message. If it does not arrive, contact your mobile carrier.' :
        result === 'no' ? 'Check that Airplane mode is off and that the phone shows a mobile signal, then try sending one text again.' : clarify(Q.messagesSend);
    default:
      return 'ESCALATE: This guided path cannot determine the next safe step.';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { messages?: unknown };
    if (!Array.isArray(body.messages)) return Response.json({ error: 'Please describe the problem.' }, { status: 400 });
    const messages = body.messages.filter(validMessage);
    const latest = messages.at(-1);
    if (!latest || latest.role !== 'user' || !latest.text.trim()) return Response.json({ error: 'Please describe the problem.' }, { status: 400 });
    return Response.json({ reply: nextReply(messages) });
  } catch (error) {
    console.error('AI Help Desk error', error);
    return Response.json({ error: 'AI Help Desk could not respond. Please try again.' }, { status: 500 });
  }
}
