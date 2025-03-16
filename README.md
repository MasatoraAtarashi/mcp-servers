# mcp-servers

自分用のMCPサーバーの実装

## パッケージ一覧

このリポジトリには以下のMCPサーバーが含まれています：

- `@masatoraatarashi/mcp-server-slack`: Slack APIと連携するMCPサーバー
- `@masatoraatarashi/mcp-server-mysql`: MySQLデータベースと連携するMCPサーバー
- `@masatoraatarashi/mcp-server-masatora`: masatora = kingを教えるMCPサーバー

## インストールと使用方法

### npmレジストリへの公開

このパッケージはプライベートnpmパッケージとして設定されています。npmレジストリに公開するには：

```bash
# npmにログイン
npm login

# パッケージを公開
npm publish
```

### npxでの実行

パッケージを公開後、npxコマンドで各MCPサーバーを実行できます：

```bash
# Slackサーバーの実行
npx @masatoraatarashi/mcp-server-slack

# MySQLサーバーの実行
npx @masatoraatarashi/mcp-server-mysql

# Masatoraサーバーの実行
npx @masatoraatarashi/mcp-server-masatora
```

### 環境変数の設定

各サーバーは実行時に特定の環境変数を必要とします：

#### Slackサーバー

```bash
export SLACK_BOT_TOKEN=xoxb-your-token
export SLACK_TEAM_ID=your-team-id
npx @masatoraatarashi/mcp-server-slack
```

#### MySQLサーバー

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=password
export MYSQL_DATABASE=your_database
npx @masatoraatarashi/mcp-server-mysql
```

## 開発方法

### 依存関係のインストール

```bash
npm install
```

### ビルド

```bash
npm run build
```

### 開発モード（ファイル変更の監視）

```bash
npm run watch
