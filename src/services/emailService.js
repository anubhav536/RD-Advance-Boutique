const net = require('net');
const tls = require('tls');
const config = require('../config/env');

const CRLF = '\r\n';

const escapeHeader = (value) => String(value || '').replace(/[\r\n]+/g, ' ').trim();

const formatAddress = (address) => {
  const value = escapeHeader(address);
  const match = value.match(/<([^<>]+)>/);
  return match ? match[1].trim() : value;
};

const encodeBase64 = (value) => Buffer.from(String(value), 'utf8').toString('base64');

const createSmtpClient = ({ host, port, secure }) => new Promise((resolve, reject) => {
  const socket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });

  socket.setEncoding('utf8');
  socket.setTimeout(15000);
  socket.once(secure ? 'secureConnect' : 'connect', () => resolve(socket));
  socket.once('error', reject);
  socket.once('timeout', () => {
    socket.destroy();
    reject(new Error('SMTP connection timed out.'));
  });
});

const createReader = (socket) => {
  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk;
  });

  return () => new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const read = () => {
      const lines = buffer.split(CRLF);
      for (let index = 0; index < lines.length - 1; index += 1) {
        const line = lines[index];
        if (/^\d{3} /.test(line)) {
          const response = lines.slice(0, index + 1).join(CRLF);
          buffer = lines.slice(index + 1).join(CRLF);
          resolve(response);
          return;
        }
      }

      if (Date.now() - startedAt > 15000) {
        reject(new Error('SMTP server response timed out.'));
        return;
      }

      setTimeout(read, 25);
    };

    read();
  });
};

const assertSmtpCode = (response, acceptedCodes) => {
  const code = Number(String(response).slice(0, 3));
  if (!acceptedCodes.includes(code)) {
    throw new Error(`SMTP command failed with response: ${response}`);
  }
};

const sendCommand = async (socket, readResponse, command, acceptedCodes) => {
  socket.write(`${command}${CRLF}`);
  const response = await readResponse();
  assertSmtpCode(response, acceptedCodes);
  return response;
};

const upgradeToTls = async (socket, host, readResponse) => {
  await sendCommand(socket, readResponse, 'STARTTLS', [220]);

  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));
    secureSocket.setTimeout(15000);
    secureSocket.once('error', reject);
    secureSocket.once('timeout', () => {
      secureSocket.destroy();
      reject(new Error('SMTP TLS upgrade timed out.'));
    });
  });
};

const buildMessage = ({ to, subject, text, html }) => {
  const from = config.email.smtpFrom;
  const headers = [
    `From: ${escapeHeader(from)}`,
    `To: ${escapeHeader(to)}`,
    `Subject: ${escapeHeader(subject)}`,
    'MIME-Version: 1.0',
  ];

  if (html) {
    const boundary = `rd-reset-${Date.now()}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      '',
      `--${boundary}--`,
    ].join(CRLF);
  }

  return [
    ...headers,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
  ].join(CRLF);
};

const sendSmtpEmail = async ({ to, subject, text, html }) => {
  const smtpConfig = config.email;
  let socket = await createSmtpClient({
    host: smtpConfig.smtpHost,
    port: smtpConfig.smtpPort,
    secure: smtpConfig.smtpSecure,
  });
  let readResponse = createReader(socket);

  try {
    assertSmtpCode(await readResponse(), [220]);
    await sendCommand(socket, readResponse, `EHLO ${smtpConfig.smtpHost}`, [250]);

    if (!smtpConfig.smtpSecure) {
      socket = await upgradeToTls(socket, smtpConfig.smtpHost, readResponse);
      socket.setEncoding('utf8');
      readResponse = createReader(socket);
      await sendCommand(socket, readResponse, `EHLO ${smtpConfig.smtpHost}`, [250]);
    }

    if (smtpConfig.smtpUser && smtpConfig.smtpPass) {
      await sendCommand(socket, readResponse, 'AUTH LOGIN', [334]);
      await sendCommand(socket, readResponse, encodeBase64(smtpConfig.smtpUser), [334]);
      await sendCommand(socket, readResponse, encodeBase64(smtpConfig.smtpPass), [235]);
    }

    await sendCommand(socket, readResponse, `MAIL FROM:<${formatAddress(smtpConfig.smtpFrom)}>`, [250]);
    await sendCommand(socket, readResponse, `RCPT TO:<${formatAddress(to)}>`, [250, 251]);
    await sendCommand(socket, readResponse, 'DATA', [354]);
    socket.write(`${buildMessage({ to, subject, text, html })}${CRLF}.${CRLF}`);
    assertSmtpCode(await readResponse(), [250]);
    await sendCommand(socket, readResponse, 'QUIT', [221]);
  } finally {
    socket.end();
  }
};

const sendPasswordResetEmail = async ({ to, resetLink, expiresInMinutes }) => {
  if (!config.email.smtpHost) {
    console.info(`Admin password reset link for ${to}: ${resetLink}`);
    return { sent: false, previewLink: resetLink };
  }

  const subject = 'RD Advance Boutique admin password reset';
  const text = [
    'A password reset was requested for your RD Advance Boutique admin account.',
    '',
    `Reset your password here: ${resetLink}`,
    '',
    `This link will expire in ${expiresInMinutes} minutes. If you did not request this, ignore this email.`,
  ].join('\n');
  const safeLink = resetLink.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = `
    <p>A password reset was requested for your RD Advance Boutique admin account.</p>
    <p><a href="${safeLink}">Reset your admin password</a></p>
    <p>This link will expire in ${expiresInMinutes} minutes. If you did not request this, ignore this email.</p>
  `;

  await sendSmtpEmail({ to, subject, text, html });
  return { sent: true };
};

module.exports = {
  sendPasswordResetEmail,
};
