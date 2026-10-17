import http2 from "node:http2";
import crypto from "node:crypto";

export type PushPlatform = "ios" | "android";

export type PushMessage = {
  title: string;
  body: string;
  path: string;
};

export type PushSendResult = {
  ok: boolean;
  invalidToken: boolean;
  error?: string;
};

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64url");
}

export function apnsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_PRIVATE_KEY
  );
}

export function fcmConfigured(): boolean {
  return Boolean(
    process.env.FCM_PROJECT_ID &&
      process.env.FCM_CLIENT_EMAIL &&
      process.env.FCM_PRIVATE_KEY
  );
}

export function pushPlatformsConfigured(): { ios: boolean; android: boolean } {
  return { ios: apnsConfigured(), android: fcmConfigured() };
}

function apnsJwt(): string {
  const keyId = process.env.APNS_KEY_ID ?? "";
  const teamId = process.env.APNS_TEAM_ID ?? "";
  const key = normalizePem(process.env.APNS_PRIVATE_KEY ?? "");
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(
    JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  );
  const unsigned = `${header}.${claims}`;
  const sign = crypto.createSign("SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${base64url(signature)}`;
}

function apnsHost(): string {
  const sandbox =
    process.env.APNS_USE_SANDBOX === "true" ||
    process.env.APNS_PRODUCTION === "false";
  return sandbox
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
}

async function fcmAccessToken(): Promise<string> {
  const clientEmail = process.env.FCM_CLIENT_EMAIL ?? "";
  const privateKey = normalizePem(process.env.FCM_PRIVATE_KEY ?? "");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const assertion = `${unsigned}.${base64url(sign.sign(privateKey))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || "FCM auth failed");
  }
  return payload.access_token;
}

function sendApns(
  client: http2.ClientHttp2Session,
  token: string,
  message: PushMessage,
  jwt: string
): Promise<PushSendResult> {
  const bundleId = process.env.APNS_BUNDLE_ID || "al.rutina.app";
  const body = JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: "default",
    },
    path: message.path,
  });

  return new Promise((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    const chunks: string[] = [];
    let status = 0;
    req.setEncoding("utf8");
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", (error) => {
      resolve({ ok: false, invalidToken: false, error: error.message });
    });
    req.on("end", () => {
      if (status === 200) {
        resolve({ ok: true, invalidToken: false });
        return;
      }
      const raw = chunks.join("");
      let reason = raw;
      try {
        reason = (JSON.parse(raw) as { reason?: string }).reason ?? raw;
      } catch {
        // keep raw body
      }
      const invalidToken =
        status === 410 ||
        reason === "Unregistered" ||
        reason === "BadDeviceToken";
      resolve({
        ok: false,
        invalidToken,
        error: reason || `APNs ${status}`,
      });
    });
    req.end(body);
  });
}

async function sendFcm(
  accessToken: string,
  token: string,
  message: PushMessage
): Promise<PushSendResult> {
  const projectId = process.env.FCM_PROJECT_ID ?? "";
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          data: { path: message.path },
          android: {
            priority: "HIGH",
            notification: { channel_id: "reminders", sound: "default" },
          },
        },
      }),
    }
  );
  if (response.ok) return { ok: true, invalidToken: false };
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { status?: string; message?: string };
  };
  const status = payload.error?.status ?? "";
  const invalidToken =
    response.status === 404 ||
    status === "NOT_FOUND" ||
    status === "UNREGISTERED";
  return {
    ok: false,
    invalidToken,
    error: payload.error?.message || `FCM ${response.status}`,
  };
}

export type PushSender = {
  supports: (platform: PushPlatform) => boolean;
  send: (
    platform: PushPlatform,
    token: string,
    message: PushMessage
  ) => Promise<PushSendResult>;
  close: () => void;
};

export async function createPushSender(): Promise<PushSender> {
  const ios = apnsConfigured();
  const android = fcmConfigured();
  const apnsClient = ios ? http2.connect(apnsHost()) : null;
  apnsClient?.on("error", () => undefined);
  try {
    const jwt = ios ? apnsJwt() : "";
    const fcmToken = android ? await fcmAccessToken() : "";
    return {
      supports(platform) {
        return platform === "ios" ? ios : android;
      },
      async send(platform, token, message) {
        if (platform === "ios") {
          if (!apnsClient) {
            return { ok: false, invalidToken: false, error: "APNs is not configured" };
          }
          return sendApns(apnsClient, token, message, jwt);
        }
        if (!fcmToken) {
          return { ok: false, invalidToken: false, error: "FCM is not configured" };
        }
        return sendFcm(fcmToken, token, message);
      },
      close() {
        apnsClient?.close();
      },
    };
  } catch (error) {
    apnsClient?.close();
    throw error;
  }
}
