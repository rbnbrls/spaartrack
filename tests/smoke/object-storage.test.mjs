import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";

const enabled = process.env.STACK_SMOKE === "1";
const endpoint = process.env.S3_ENDPOINT || "http://localhost:19000";
const accessKey = process.env.S3_ACCESS_KEY || "spaartrack";
const secretKey = process.env.S3_SECRET_KEY || "change-me-local-only";
const bucket = process.env.S3_BUCKET || "spaartrack-local";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding = "buffer") {
  return createHmac("sha256", key).update(value).digest(encoding);
}

async function signedRequest(method, path, body = "") {
  const url = new URL(path, endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const date = amzDate.slice(0, 8);
  const payloadHash = hash(body);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `${method}\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/us-east-1/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), "us-east-1"), "s3"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  return fetch(url, {
    method,
    body: body || undefined,
    headers: {
      host: url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  });
}

test("US-0101-D: local object storage supports synthetic upload and download", { skip: !enabled }, async () => {
  const objectPath = `/${bucket}/us-0101-smoke.txt`;
  const payload = "synthetic-local-fixture\n";
  const bucketResponse = await signedRequest("PUT", `/${bucket}`);
  assert.ok([200, 204, 409].includes(bucketResponse.status), `bucket setup failed: ${bucketResponse.status}`);

  const upload = await signedRequest("PUT", objectPath, payload);
  assert.equal(upload.status, 200);
  const download = await signedRequest("GET", objectPath);
  assert.equal(download.status, 200);
  assert.equal(await download.text(), payload);
});
