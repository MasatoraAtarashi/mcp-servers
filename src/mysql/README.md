# MySQL MCP Server

A Model Context Protocol server that provides read-only access to MySQL databases. This server enables LLMs to inspect database schemas and execute read-only queries.

## Components

### Tools

- **query**
  - Execute read-only SQL queries against the connected database
  - Input: `sql` (string): The SQL query to execute
  - All queries are executed within a READ ONLY transaction

### Resources

The server provides schema information for each table in the database:

- **Table Schemas** (`mysql://<host>/<table>/schema`)
  - JSON schema information for each table
  - Includes column names and data types
  - Automatically discovered from database metadata

## Environment Variables

The server uses the following environment variables for database connection:

- `MYSQL_HOST`: MySQL server hostname (required)
- `MYSQL_PORT`: MySQL server port (required)
- `MYSQL_USER`: MySQL username (required)
- `MYSQL_PASSWORD`: MySQL password
- `MYSQL_DATABASE`: MySQL database name (required)

## Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

### Local Execution

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

### Using npm Package

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["@masatoraatarashi/mcp-server-mysql"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

## Building

```bash
# Install dependencies
npm install

# Build the server
npm run build
```

## Running Locally

```bash
# Set environment variables and run
MYSQL_HOST=localhost MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=your_password MYSQL_DATABASE=your_database node dist/index.js
```

## Running with npx

After publishing the package to npm, you can run it using npx:

```bash
# Set environment variables and run with npx
MYSQL_HOST=localhost MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=your_password MYSQL_DATABASE=your_database npx @masatoraatarashi/mcp-server-mysql
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License.
