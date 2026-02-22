const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { buildSubgraphSchema } = require("@apollo/subgraph");
const gql = require("graphql-tag");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

async function initSqlDb(sqliteDbPath) {
  const db = await open({
    filename: sqliteDbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
  `);

  const existing = await db.get("SELECT COUNT(*) AS count FROM users;");
  if (!existing || existing.count === 0) {
    await db.run(
      "INSERT INTO users (name, email) VALUES (?, ?), (?, ?), (?, ?);",
      "Ava Chen",
      "ava@example.com",
      "Leo Park",
      "leo@example.com",
      "Mia Gomez",
      "mia@example.com"
    );
  }

  return db;
}

async function startUsersSubgraph({ port, sqliteDbPath }) {
  const sqlDb = await initSqlDb(sqliteDbPath);

  const typeDefs = gql`
    extend schema
      @link(
        url: "https://specs.apollo.dev/federation/v2.3"
        import: ["@key"]
      )

    type User @key(fields: "id") {
      id: ID!
      name: String!
      email: String!
    }

    type Query {
      users: [User!]!
      user(id: ID!): User
    }
  `;

  const resolvers = {
    Query: {
      users: async () => {
        return sqlDb.all("SELECT id, name, email FROM users ORDER BY id;");
      },
      user: async (_, { id }) => {
        return sqlDb.get("SELECT id, name, email FROM users WHERE id = ?;", Number(id));
      }
    },
    User: {
      __resolveReference: async (reference) => {
        return sqlDb.get(
          "SELECT id, name, email FROM users WHERE id = ?;",
          Number(reference.id)
        );
      }
    }
  };

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }])
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port }
  });

  return {
    name: "users",
    url,
    stop: async () => {
      await server.stop();
      await sqlDb.close();
    }
  };
}

module.exports = { startUsersSubgraph };
