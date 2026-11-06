import fs from "node:fs";
import path from "node:path";

const root = path.resolve("contracts");
const out = path.join(root, "out");
const artifacts = path.join(root, "artifacts");

const files = [
  ["Latch.sol", "Latch"],
  ["RescueAccount.sol", "RescueAccount"],
  ["DLCAccount.sol", "DLCAccount"],
  ["QuoteBook.sol", "QuoteBook"],
  ["TestToken.sol", "TestToken"],
];

fs.mkdirSync(artifacts, { recursive: true });

for (const [file, name] of files) {
  const artifactPath = path.join(out, file, `${name}.json`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode?.object ?? artifact.bytecode;
  if (typeof bytecode !== "string" || bytecode === "0x") {
    throw new Error(`${artifactPath} has no creation bytecode`);
  }
  const output = {
    contractName: name,
    abi: artifact.abi,
    bytecode,
  };
  fs.writeFileSync(path.join(artifacts, `${name}.json`), JSON.stringify(output, null, 2) + "\n");
  console.log(`wrote contracts/artifacts/${name}.json`);
}
