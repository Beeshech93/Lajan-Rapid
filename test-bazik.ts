import { loadStoredCreds, bazikAuthenticate } from "./src/lib/bazik.server.ts";

async function run() {
  const auth = await bazikAuthenticate(true);
  console.log("Auth result:", auth);
}
run();
