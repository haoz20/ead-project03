# Federated GraphQL SQL + MongoDB Demo

This demo uses Apollo Federation with:
- `users` subgraph backed by SQLite (SQL)
- `products` subgraph backed by MongoDB (NoSQL)
- gateway that composes both subgraphs

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env
   ```
3. Ensure MongoDB is running at `MONGODB_URI`.
4. Start the server:
   ```bash
   npm start
   ```

Endpoints:
- Gateway: `http://localhost:4000/`
- Users subgraph: `http://localhost:4001/`
- Products subgraph: `http://localhost:4002/`

## Single Query Demo

Run this query against the gateway to fetch both SQL and NoSQL data in one request:

```graphql
query GetUsersAndProducts {
  users {
    id
    name
    email
  }
  products {
    id
    name
    price
    inStock
  }
}
```
