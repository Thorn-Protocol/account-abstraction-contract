import { randomBytes } from "crypto";

function generateRandomHex(length: number): string {
  const bytes = randomBytes(Math.ceil(length / 2));
  return bytes.toString("hex").slice(0, length);
}

const length = 128;

const randomHex = generateRandomHex(length);
console.log(randomHex);
