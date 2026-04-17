#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

// Paste your Gemini API key manually.
const apiKey = "";
if (!apiKey) {
  console.error("Missing Gemini API key. Paste it directly into `apiKey`.");
  process.exit(1);
}

async function testLanguageCall() {
  const model = "gemini-2.5-pro";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ parts: [{ text: "hello how are you" }] }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`\n[${model}] LANGUAGE TEST FAILED (${res.status})`);
    console.error(text);
    return false;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(`\n[${model}] LANGUAGE TEST FAILED: non-JSON response`);
    console.error(text.slice(0, 500));
    return false;
  }

  const reply =
    json?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join("\n")
      .trim() || "";

  if (!reply) {
    console.error(`\n[${model}] LANGUAGE TEST FAILED: empty text reply`);
    console.error(JSON.stringify(json, null, 2).slice(0, 2000));
    return false;
  }

  console.log(`[${model}] LANGUAGE TEST OK -> ${reply.slice(0, 120)}`);
  return true;
}

// Same models used in newsletter UI
const models = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
];

const prompt = "Minimal flat illustration of a rocket launching at sunrise, clean background.";
const outDir = path.resolve("tmp/gemini-image-tests");

await fs.mkdir(outDir, { recursive: true });

const languageOk = await testLanguageCall();
if (!languageOk) {
  console.error("\nStopping before image tests because language auth test failed.");
  process.exit(1);
}

async function testModel(model) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`\n[${model}] FAILED (${res.status})`);
    console.error(text);
    return;
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error(`\n[${model}] FAILED: non-JSON response`);
    console.error(text.slice(0, 500));
    return;
  }

  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p?.inlineData?.data)?.inlineData;
  if (!inline?.data) {
    console.error(`\n[${model}] FAILED: no inlineData.data in response`);
    console.error(JSON.stringify(json, null, 2).slice(0, 2200));
    return;
  }

  const mime = inline.mimeType || "image/png";
  const ext = mime.includes("jpeg") ? "jpg" : "png";
  const file = path.join(outDir, `${model}.${ext}`);
  await fs.writeFile(file, Buffer.from(inline.data, "base64"));
  console.log(`[${model}] OK -> ${file}`);
}

for (const model of models) {
  try {
    await testModel(model);
  } catch (err) {
    console.error(`\n[${model}] CRASHED`);
    console.error(err);
  }
}

console.log("\nDone.");