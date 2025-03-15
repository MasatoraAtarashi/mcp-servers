#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Type definitions for tool arguments
interface ListChannelsArgs {
  limit?: number;
  cursor?: string;
}

interface GetChannelHistoryArgs {
  channel_id: string;
  limit?: number;
}

interface GetThreadRepliesArgs {
  channel_id: string;
  thread_ts: string;
}

interface GetUsersArgs {
  cursor?: string;
  limit?: number;
}

interface GetUserProfileArgs {
  user_id: string;
}

interface SearchMessagesArgs {
  query: string;
  channels?: string[];
  limit?: number;
}

interface GetContextArgs {
  channel_id: string;
  message_ts: string;
  context_size?: number;
}

class SlackClient {
  private botHeaders: { Authorization: string; "Content-Type": string };
  private teamId: string;

  constructor(botToken: string, teamId: string) {
    this.botHeaders = {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    };
    this.teamId = teamId;
  }

  async getChannels(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      types: "public_channel",
      exclude_archived: "true",
      limit: Math.min(limit, 200).toString(),
      team_id: this.teamId,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `https://slack.com/api/conversations.list?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async getChannelHistory(
    channel_id: string,
    limit: number = 10,
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      limit: limit.toString(),
    });

    const response = await fetch(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async getThreadReplies(channel_id: string, thread_ts: string): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      ts: thread_ts,
    });

    const response = await fetch(
      `https://slack.com/api/conversations.replies?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async getUsers(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      limit: Math.min(limit, 200).toString(),
      team_id: this.teamId,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(`https://slack.com/api/users.list?${params}`, {
      headers: this.botHeaders,
    });

    return response.json();
  }

  async getUserProfile(user_id: string): Promise<any> {
    const params = new URLSearchParams({
      user: user_id,
      include_labels: "true",
    });

    const response = await fetch(
      `https://slack.com/api/users.profile.get?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async searchMessages(
    query: string,
    channels?: string[],
    limit: number = 20,
  ): Promise<any> {
    const params = new URLSearchParams({
      query,
      count: Math.min(limit, 100).toString(),
      sort: "timestamp",
      sort_dir: "desc",
    });

    if (channels && channels.length > 0) {
      // Slack API expects comma-separated channel IDs
      params.append("channel", channels.join(","));
    }

    const response = await fetch(
      `https://slack.com/api/search.messages?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  // 特定のメッセージの前後のコンテキストを取得する関数
  async getMessageContext(
    channel_id: string,
    message_ts: string,
    context_size: number = 5,
  ): Promise<any> {
    try {
      // まず、チャンネルの履歴を取得
      const historyResponse = await this.getChannelHistory(
        channel_id,
        context_size * 2 + 1,
      );

      if (!historyResponse.ok) {
        throw new Error(
          `Failed to get channel history: ${historyResponse.error}`,
        );
      }

      // メッセージのインデックスを見つける
      const messages = historyResponse.messages;
      const messageIndex = messages.findIndex(
        (msg: any) => msg.ts === message_ts,
      );

      if (messageIndex === -1) {
        // より多くのメッセージを取得して再試行
        const extendedHistoryResponse = await this.getChannelHistory(
          channel_id,
          100,
        );
        
        if (!extendedHistoryResponse.ok) {
          throw new Error(
            `Failed to get extended channel history: ${extendedHistoryResponse.error}`,
          );
        }
        
        const extendedMessages = extendedHistoryResponse.messages;
        const extendedMessageIndex = extendedMessages.findIndex(
          (msg: any) => msg.ts === message_ts,
        );
        
        if (extendedMessageIndex === -1) {
          throw new Error(`Message with timestamp ${message_ts} not found`);
        }
        
        // 前後のコンテキストを取得
        const startIndex = Math.max(0, extendedMessageIndex - context_size);
        const endIndex = Math.min(
          extendedMessages.length - 1,
          extendedMessageIndex + context_size,
        );
        
        return {
          ok: true,
          context: extendedMessages.slice(startIndex, endIndex + 1),
          target_message_index: extendedMessageIndex - startIndex,
        };
      }

      // 前後のコンテキストを取得
      const startIndex = Math.max(0, messageIndex - context_size);
      const endIndex = Math.min(
        messages.length - 1,
        messageIndex + context_size,
      );

      return {
        ok: true,
        context: messages.slice(startIndex, endIndex + 1),
        target_message_index: messageIndex - startIndex,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // スレッドのメッセージとその親メッセージを含むコンテキストを取得
  async getThreadContext(
    channel_id: string,
    thread_ts: string,
  ): Promise<any> {
    try {
      // スレッドの返信を取得
      const threadResponse = await this.getThreadReplies(channel_id, thread_ts);

      if (!threadResponse.ok) {
        throw new Error(`Failed to get thread replies: ${threadResponse.error}`);
      }

      // スレッドの親メッセージのコンテキストを取得
      const contextResponse = await this.getMessageContext(
        channel_id,
        thread_ts,
        2,
      );

      if (!contextResponse.ok) {
        throw new Error(
          `Failed to get message context: ${contextResponse.error}`,
        );
      }

      return {
        ok: true,
        thread_messages: threadResponse.messages,
        parent_context: contextResponse.context,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

async function main() {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const teamId = process.env.SLACK_TEAM_ID;

  if (!botToken || !teamId) {
    console.error(
      "Please set SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables",
    );
    process.exit(1);
  }

  console.error("Starting Slack MCP Server...");
  const server = new Server(
    {
      name: "Slack MCP Server",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  const slackClient = new SlackClient(botToken, teamId);

  // リソーステンプレートの定義
  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async () => ({
      resourceTemplates: [
        {
          uriTemplate: "slack://channel/{channel_id}/history",
          name: "Channel History",
          description: "Get the message history of a specific Slack channel",
          mimeType: "application/json",
        },
        {
          uriTemplate: "slack://thread/{channel_id}/{thread_ts}",
          name: "Thread Messages",
          description: "Get all messages in a specific thread",
          mimeType: "application/json",
        },
        {
          uriTemplate: "slack://user/{user_id}/profile",
          name: "User Profile",
          description: "Get detailed profile information for a specific user",
          mimeType: "application/json",
        },
      ],
    }),
  );

  // リソースの定義
  server.setRequestHandler(
    ListResourcesRequestSchema,
    async () => ({
      resources: [
        {
          uri: "slack://channels",
          name: "Slack Channels",
          description: "List of all public channels in the workspace",
          mimeType: "application/json",
        },
        {
          uri: "slack://users",
          name: "Slack Users",
          description: "List of all users in the workspace",
          mimeType: "application/json",
        },
      ],
    }),
  );

  // リソースの読み取り処理
  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      try {
        // チャンネル一覧の取得
        if (request.params.uri === "slack://channels") {
          const response = await slackClient.getChannels();
          return {
            contents: [
              {
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        }
        
        // ユーザー一覧の取得
        if (request.params.uri === "slack://users") {
          const response = await slackClient.getUsers();
          return {
            contents: [
              {
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        }
        
        // チャンネル履歴の取得
        const channelHistoryMatch = request.params.uri.match(
          /^slack:\/\/channel\/([^\/]+)\/history$/
        );
        if (channelHistoryMatch) {
          const channelId = channelHistoryMatch[1];
          const response = await slackClient.getChannelHistory(channelId);
          return {
            contents: [
              {
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        }
        
        // スレッドの取得
        const threadMatch = request.params.uri.match(
          /^slack:\/\/thread\/([^\/]+)\/([^\/]+)$/
        );
        if (threadMatch) {
          const channelId = threadMatch[1];
          const threadTs = threadMatch[2];
          const response = await slackClient.getThreadReplies(channelId, threadTs);
          return {
            contents: [
              {
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        }
        
        // ユーザープロフィールの取得
        const userProfileMatch = request.params.uri.match(
          /^slack:\/\/user\/([^\/]+)\/profile$/
        );
        if (userProfileMatch) {
          const userId = userProfileMatch[1];
          const response = await slackClient.getUserProfile(userId);
          return {
            contents: [
              {
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify(response, null, 2),
              },
            ],
          };
        }
        
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown resource URI: ${request.params.uri}`
        );
      } catch (error) {
        console.error("Error reading resource:", error);
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  // ツールの定義
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "slack_list_channels",
          description: "List public channels in the workspace with pagination",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description:
                  "Maximum number of channels to return (default 100, max 200)",
                default: 100,
              },
              cursor: {
                type: "string",
                description: "Pagination cursor for next page of results",
              },
            },
          },
        },
        {
          name: "slack_get_channel_history",
          description: "Get recent messages from a channel",
          inputSchema: {
            type: "object",
            properties: {
              channel_id: {
                type: "string",
                description: "The ID of the channel",
              },
              limit: {
                type: "number",
                description: "Number of messages to retrieve (default 10)",
                default: 10,
              },
            },
            required: ["channel_id"],
          },
        },
        {
          name: "slack_get_thread_replies",
          description: "Get all replies in a message thread",
          inputSchema: {
            type: "object",
            properties: {
              channel_id: {
                type: "string",
                description: "The ID of the channel containing the thread",
              },
              thread_ts: {
                type: "string",
                description: "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it.",
              },
            },
            required: ["channel_id", "thread_ts"],
          },
        },
        {
          name: "slack_get_users",
          description:
            "Get a list of all users in the workspace with their basic profile information",
          inputSchema: {
            type: "object",
            properties: {
              cursor: {
                type: "string",
                description: "Pagination cursor for next page of results",
              },
              limit: {
                type: "number",
                description: "Maximum number of users to return (default 100, max 200)",
                default: 100,
              },
            },
          },
        },
        {
          name: "slack_get_user_profile",
          description: "Get detailed profile information for a specific user",
          inputSchema: {
            type: "object",
            properties: {
              user_id: {
                type: "string",
                description: "The ID of the user",
              },
            },
            required: ["user_id"],
          },
        },
        {
          name: "slack_search_messages",
          description: "Search for messages in channels",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query string",
              },
              channels: {
                type: "array",
                items: {
                  type: "string",
                },
                description: "Optional list of channel IDs to search in. If not provided, searches all accessible channels.",
              },
              limit: {
                type: "number",
                description: "Maximum number of results to return (default 20, max 100)",
                default: 20,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "slack_get_message_context",
          description: "Get context around a specific message (messages before and after)",
          inputSchema: {
            type: "object",
            properties: {
              channel_id: {
                type: "string",
                description: "The ID of the channel containing the message",
              },
              message_ts: {
                type: "string",
                description: "The timestamp of the message to get context for",
              },
              context_size: {
                type: "number",
                description: "Number of messages to include before and after the target message (default 5)",
                default: 5,
              },
            },
            required: ["channel_id", "message_ts"],
          },
        },
        {
          name: "slack_get_thread_context",
          description: "Get a thread's messages and context around the parent message",
          inputSchema: {
            type: "object",
            properties: {
              channel_id: {
                type: "string",
                description: "The ID of the channel containing the thread",
              },
              thread_ts: {
                type: "string",
                description: "The timestamp of the parent message",
              },
            },
            required: ["channel_id", "thread_ts"],
          },
        },
      ],
    };
  });

  // ツールの実行処理
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      console.error("Received CallToolRequest:", request);
      try {
        if (!request.params.arguments) {
          throw new Error("No arguments provided");
        }

        switch (request.params.name) {
          case "slack_list_channels": {
            const args = request.params
              .arguments as unknown as ListChannelsArgs;
            const response = await slackClient.getChannels(
              args.limit,
              args.cursor,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          case "slack_get_channel_history": {
            const args = request.params
              .arguments as unknown as GetChannelHistoryArgs;
            if (!args.channel_id) {
              throw new Error("Missing required argument: channel_id");
            }
            const response = await slackClient.getChannelHistory(
              args.channel_id,
              args.limit,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          case "slack_get_thread_replies": {
            const args = request.params
              .arguments as unknown as GetThreadRepliesArgs;
            if (!args.channel_id || !args.thread_ts) {
              throw new Error(
                "Missing required arguments: channel_id and thread_ts",
              );
            }
            const response = await slackClient.getThreadReplies(
              args.channel_id,
              args.thread_ts,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          case "slack_get_users": {
            const args = request.params.arguments as unknown as GetUsersArgs;
            const response = await slackClient.getUsers(
              args.limit,
              args.cursor,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          case "slack_get_user_profile": {
            const args = request.params
              .arguments as unknown as GetUserProfileArgs;
            if (!args.user_id) {
              throw new Error("Missing required argument: user_id");
            }
            const response = await slackClient.getUserProfile(args.user_id);
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          case "slack_search_messages": {
            const args = request.params.arguments as unknown as SearchMessagesArgs;
            if (!args.query) {
              throw new Error("Missing required argument: query");
            }
            const response = await slackClient.searchMessages(
              args.query,
              args.channels,
              args.limit,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          case "slack_get_message_context": {
            const args = request.params.arguments as unknown as GetContextArgs;
            if (!args.channel_id || !args.message_ts) {
              throw new Error(
                "Missing required arguments: channel_id and message_ts",
              );
            }
            const response = await slackClient.getMessageContext(
              args.channel_id,
              args.message_ts,
              args.context_size,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          case "slack_get_thread_context": {
            const args = request.params.arguments as unknown as GetThreadRepliesArgs;
            if (!args.channel_id || !args.thread_ts) {
              throw new Error(
                "Missing required arguments: channel_id and thread_ts",
              );
            }
            const response = await slackClient.getThreadContext(
              args.channel_id,
              args.thread_ts,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        console.error("Error executing tool:", error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // エラーハンドリング
  server.onerror = (error) => console.error('[MCP Error]', error);

  // サーバーの起動
  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await server.connect(transport);

  console.error("Slack MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
