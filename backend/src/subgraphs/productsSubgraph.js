const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { buildSubgraphSchema } = require("@apollo/subgraph");
const gql = require("graphql-tag");
const { MongoClient, ObjectId } = require("mongodb");

async function initMongoDb({ mongodbUri, mongodbDbName }) {
  const client = new MongoClient(mongodbUri);
  await client.connect();

  const db = client.db(mongodbDbName);
  const products = db.collection("products");

  const existing = await products.countDocuments();
  if (existing === 0) {
    await products.insertMany([
      { name: "Mechanical Keyboard", price: 89.99, inStock: true },
      { name: "4K Monitor", price: 299.0, inStock: true },
      { name: "USB-C Dock", price: 59.5, inStock: false }
    ]);
  }

  return { client, db };
}

async function startProductsSubgraph({ port, mongodbUri, mongodbDbName }) {
  const mongoState = await initMongoDb({ mongodbUri, mongodbDbName });

  const typeDefs = gql`
    extend schema
      @link(
        url: "https://specs.apollo.dev/federation/v2.3"
        import: ["@key"]
      )

    type Product @key(fields: "id") {
      id: ID!
      name: String!
      price: Float!
      inStock: Boolean!
    }

    type Query {
      products: [Product!]!
      product(id: ID!): Product
    }
  `;

  const resolvers = {
    Query: {
      products: async () => {
        const docs = await mongoState.db
          .collection("products")
          .find({})
          .sort({ _id: 1 })
          .toArray();

        return docs.map((doc) => ({
          id: doc._id.toString(),
          name: doc.name,
          price: doc.price,
          inStock: doc.inStock
        }));
      },
      product: async (_, { id }) => {
        const doc = await mongoState.db
          .collection("products")
          .findOne({ _id: new ObjectId(id) });
        if (!doc) {
          return null;
        }

        return {
          id: doc._id.toString(),
          name: doc.name,
          price: doc.price,
          inStock: doc.inStock
        };
      }
    },
    Product: {
      __resolveReference: async (reference) => {
        const doc = await mongoState.db
          .collection("products")
          .findOne({ _id: new ObjectId(reference.id) });
        if (!doc) {
          return null;
        }

        return {
          id: doc._id.toString(),
          name: doc.name,
          price: doc.price,
          inStock: doc.inStock
        };
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
    name: "products",
    url,
    stop: async () => {
      await server.stop();
      await mongoState.client.close();
    }
  };
}

module.exports = { startProductsSubgraph };
