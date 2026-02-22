require("dotenv").config();

const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { ApolloGateway, IntrospectAndCompose } = require("@apollo/gateway");
const { startUsersSubgraph } = require("./subgraphs/usersSubgraph");
const { startProductsSubgraph } = require("./subgraphs/productsSubgraph");

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT || 4000);
const USERS_SUBGRAPH_PORT = Number(process.env.USERS_SUBGRAPH_PORT || 4001);
const PRODUCTS_SUBGRAPH_PORT = Number(process.env.PRODUCTS_SUBGRAPH_PORT || 4002);
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || "./demo.sqlite";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "demo_graphql";

async function start() {
  const usersSubgraph = await startUsersSubgraph({
    port: USERS_SUBGRAPH_PORT,
    sqliteDbPath: SQLITE_DB_PATH
  });
  const productsSubgraph = await startProductsSubgraph({
    port: PRODUCTS_SUBGRAPH_PORT,
    mongodbUri: MONGODB_URI,
    mongodbDbName: MONGODB_DB_NAME
  });

  const gateway = new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: usersSubgraph.name, url: usersSubgraph.url },
        { name: productsSubgraph.name, url: productsSubgraph.url }
      ]
    })
  });

  const gatewayServer = new ApolloServer({ gateway });
  const { url: gatewayUrl } = await startStandaloneServer(gatewayServer, {
    listen: { port: GATEWAY_PORT }
  });

  console.log(`Users subgraph ready at ${usersSubgraph.url}`);
  console.log(`Products subgraph ready at ${productsSubgraph.url}`);
  console.log(`Federated GraphQL gateway ready at ${gatewayUrl}`);

  const shutdown = async () => {
    await gatewayServer.stop();
    await Promise.all([usersSubgraph.stop(), productsSubgraph.stop()]);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Failed to start federation demo:", error);
  process.exit(1);
});
