import { Injectable, OnModuleInit,OnModuleDestroy } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

@Injectable()
export class McpClientService implements OnModuleInit,OnModuleDestroy {
  private client!: Client; // MCP客户端实例
  private transport!: StdioClientTransport; // MCP服务器传输实例

  constructor() {
    // 初始化MCP客户端
    this.client = new Client({
      name: 'MCP Client',
      description: 'A client for interacting with MCP services',
      version: '1.0.0',
    });

    // stido 模式 适用于与独立的MCP服务器进行通信 子进程模式 适用于在同意进程内运行MCP服务
    this.transport = new StdioClientTransport({
      command: 'ts-node',
      args: ['src/mcp-service/service.ts'],
      env: { ...process.env } as Record<string, string>,
    });
  }
  async onModuleInit() {
    await this.client.connect(this.transport);
    console.log('MCP Server connected');
  }

  async listTools() {
    const response = await this.client.listTools(); // listTools 方法是异步的，返回一个 Promise 对象 这个是客户端client 调用服务器server 的方法
    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  // 调用具体方法执行MCP服务任务
  async callTool(toolName: string, args: Record<string, any>) {
    // callTool 方法是异步的，返回一个 Promise 对象 这个是客户端client 调用服务器server 的方法
    const response = await this.client.callTool({
      name: toolName,
      arguments: args,
    });
    // mcp 响应里面的 content 是一个数组，每个元素都是一个对象，对象的 type 是 text 或 image，包含了工具调用结果
    // const content = response?.content?.find(item => item.type === 'text')?.text || 'No text content';
    return { toolName, isError: response.isError, content: response };
  }
  async onModuleDestroy() {
    await this.client.close();
    console.log('MCP Server closed');
  }
}
