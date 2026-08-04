import { createGateway } from "./server.js";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = createGateway(config);

  await app.listen({ host: config.host, port: config.port });

  app.log.info(
    {
      port: config.port,
      host: config.host,
      services: config.services.map((service) => service.name),
      authEnabled: config.auth.enabled,
    },
    "mcp-gateway started",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});