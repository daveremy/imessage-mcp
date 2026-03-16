import { execFile } from 'child_process';

const SEND_TIMEOUT_MS = 15_000;

export function sendMessage(chatGuid: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const safeText = JSON.stringify(text);
    const safeGuid = JSON.stringify(chatGuid);

    const script = `
      var app = Application("Messages");
      var chat = app.chats.byId(${safeGuid});
      app.send(${safeText}, {to: chat});
    `;

    execFile('osascript', ['-l', 'JavaScript', '-e', script], { timeout: SEND_TIMEOUT_MS }, (err, _stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || err.message;
        reject(new Error(`Failed to send message: ${msg}`));
      } else {
        resolve();
      }
    });
  });
}
