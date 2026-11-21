// Makes a VAPID key pair for Web Push. Run once: node scripts/vapid.mjs
// Then: VAPID_PUBLIC → wrangler.toml [vars];  VAPID_PRIVATE → `npx wrangler secret put VAPID_PRIVATE` (paste the JSON line)
const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = Buffer.from(await crypto.subtle.exportKey("raw", k.publicKey)).toString("base64url");
const jwk = await crypto.subtle.exportKey("jwk", k.privateKey);
console.log("VAPID_PUBLIC  =", pub);
console.log("VAPID_PRIVATE =", JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }));
