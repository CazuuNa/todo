import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config';
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

@Injectable()
export class McpAgentService implements OnModuleInit, OnModuleDestroy {
  //MultiServerMCPClient 是一个适配器，允许我们在 langchain 中使用 MCP 协议与多个服务器进行通信
  // 它提供 一个统一的接口，让我们可以调用不同服务器上的工具，不需要关心底层通信细节
  private mcpClient!: MultiServerMCPClient;
  // 从mcp服务器获取工具列表函数，返回一个包含工具信息的数组，每个工具信息包含工具名称、工具描述、工具参数等
  private mcpTools: any[] = [];
  constructor() {}
  // 创建 ChatOllama 实例
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think: false, // 关闭思考模式
    numPredict: 512, // 生成文本的最大 token 值 512 比较合理的值，可根据需求调整
  });

  async onModuleInit() {
    this.mcpClient = new MultiServerMCPClient({
      mcpServers: {
        'local-tools': {
          transport: 'stdio',
          command: 'ts-node',
          args: ['src/mcp-service/service.ts'],
        },
        // 还可以添加其他服务器连接配置 ，例如 remote-tools
        // 'remote-tools':{
        //   transport:'http',
        //   url:'http://localhost:3000/mcp-tools'
        // }
      },
    });
    // 把所有的 mcp server 上的工具转成 langchain 中的工具格式  存储到 this.mcpTools 中
    console.log(this.mcpClient);
    this.mcpTools = await this.mcpClient.getTools(); // getTools 方法是异步的，返回一个 Promise 对象 这个是客户端client 调用服务器server 的方法
    console.log(this.mcpTools);
    console.log('MCP Agent Server initialized');
  }
  async onModuleDestroy() {
    // console.log('OnModuleDestroy');
    await this.mcpClient.close();
    console.log('MCP Agent Server closed');
  }

  listTools() {
    return this.mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      args: tool.args,
    }));
  }

  async callTool(message: string) {
    // 调用工具
    if (this.mcpTools.length === 0) {
      return 'MCP Agent Server not initialized';
    }

    const llmWithTools = this.llm.bindTools(this.mcpTools);
    const toolMap = Object.fromEntries(
      this.mcpTools.map((tool) => [tool.name, tool]),
    );

    // 消息历史  agent 每一轮都能看到 完整的对话 + 工具调用结果
    const messages: any[] = [
      // 设定系统角色，告诉模型他是一个专业的智能客服助手,你可以查询用户数据，读取文件项目，写入文件，查询天气
      new SystemMessage({
        content: `你是一个专业的智能客服助手,你可以查询用户数据，读取文件项目，写入文件，查询天气
        - queryDatabase: 查询用户数据,输入参数:用户ID,输出一个字符串,包含用户信息
        - readFile: 读取文件项目,输入参数:文件路径,输出一个字符串,包含文件内容
        - queryWeather: 查询天气,输入参数:城市名称,输出一个字符串,包含天气信息
        根据用户的问题，选择合适的工具调用，用中文回答用户的问题。
        `,
      }),
      new HumanMessage({
        content: message,
      }),
    ];

    // 记录一下每个步骤执行的过程(用于前端展示，调试)
    const steps: any[] = [];
    let roundCount = 0;
    // 定义一个递归，用于处理模型的回复和工具调用
    while (roundCount < 6) {
      // 最多处理5轮,防止无限循环调用工具
      roundCount++;

      console.log(`agent 演示--- 第${roundCount}轮 消息历史:`, messages);
      const response = await llmWithTools.invoke(messages);
      messages.push(response);
      // tool_calls 模型回答的特殊字段
      // 表示模型在这一轮调用了哪些工具以及调用的参数
      // 可以根据这个信息来调用对应的工具函数，获取工具的输出结果，然后把结果返回给模型，让模型继续生成回答
      // 如果有了大难，退出循环，返回给前端
      if (!response.tool_calls || response.tool_calls.length === 0) {
        steps.push(`[最终回答] 模型回答 ${response.content}`);
        break;
      }

      // 遍历 tool_calls 字段，调用对应的工具函数，获取工具的输出结果
      for (const toolCall of response.tool_calls) {
        steps.push(
          `[工具调用] 模型调用工具： ${toolCall.name} 输入参数 ${JSON.stringify(toolCall.args)}`,
        );
        console.log(
          `[工具调用] 模型调用工具： ${toolCall.name} 输入参数 ${toolCall.args}`,
        );

        const toolFunc = toolMap[toolCall.name];
        if (!toolFunc) {
          const errorMsg = `工具 ${toolCall.name} 不存在,无法调用`;
          steps.push(`[错误] ${errorMsg}`);
          messages.push(
            new ToolMessage({
              content: errorMsg,
              tool_call_id: toolCall.id ?? '',
            }),
          ); // 错误信息写入消息历史
          continue;
        }

        // 调用工具函数，获取结果
        const toolResult = await toolFunc.invoke(toolCall.args);
        steps.push(`[工具调用结果] ${toolResult}`);
        console.log(`[工具调用结果] ${toolResult}`);

        // 把工具结果作为新的消息添加到消息历史中，让模型在下一轮回答是可以看到这个结果
        messages.push(
          new ToolMessage({
            content: String(toolResult),
            tool_call_id: toolCall.id ?? '',
          }),
        ); // 工具调用结果写入消息历史
      }
    }

    const finalResponse =
      [...messages].reverse().find((msg) => msg instanceof AIMessage) ||
      '很抱歉，我无法回答你的问题';
    return {
      message,
      totalRound: roundCount,
      response:
        finalResponse instanceof AIMessage
          ? finalResponse.content
          : finalResponse,
      steps,
    };
  }
}
