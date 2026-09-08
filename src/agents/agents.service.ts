import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config';
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
// import {ChatPromptTemplate,PromptTemplate,FewShotPromptTemplate} from '@langchain/core/prompts';
import { z } from 'zod';
import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';

@Injectable()
export class AgentsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think: false, // 关闭思考模式
    numPredict: 512, // 生成文本的最大 token 值 512 比较合理的值，可根据需求调整
  });

  // tool 把普通的js 函数包装成模型能识别的模型
  // name 是工具的名称（模型调用工具是会使用这个名称）
  // description 是工具的描述（告诉模型这个工具是干嘛的）
  // schema 定义了工具的输入参数（zod 格式 告诉模型调用这个工具时需要提供哪些参数，已经参数的类型和描述）

  // 工具1 查询商品库存和价格的工具，输入参数：商品名称，输出一个字符串，包含商品库存和价格信息
  private checkProductTool = tool(
    async ({ productName }: { productName: string }) => {
      const products: Record<
        string,
        { stock: number; price: number; category: string }
      > = {
        'iPhone 18': { stock: 10, price: 7999, category: '手机' },
        'iPhone 18 Pro': { stock: 5, price: 8999, category: '手机' },
        'MacBook Pro': { stock: 5, price: 1999, category: '笔记本' },
        'AirPods Pro': { stock: 20, price: 199, category: '耳机' },
        'Nike Air Max': { stock: 15, price: 199, category: '鞋子' },
        'Adidas UltraBoost': { stock: 10, price: 199, category: '鞋子' },
      };
      const product = products[productName];
      console.log(product, productName);
      if (!product) {
        return `商品 ${productName} 不存在`;
      }
      if (product.stock === 0) {
        return `商品 ${productName} 库存不足`;
      }
      return `商品 ${productName} 库存 ${product.stock} 件，价格 ${product.price} 元`;
    },
    {
      name: 'check_product',
      description:
        '查询商品库存和价格,输入参数:商品名称,输出一个字符串,包含商品库存和价格信息',
      schema: z.object({
        productName: z.string().describe('商品名称,例如: iPhone 18'),
      }),
    },
  );

  // 工具2 创建订单
  private createOrderTool = tool(
    async ({
      productName,
      quantity,
      customerName,
    }: {
      productName: string;
      quantity: number;
      customerName: string;
    }) => {
      const prices: Record<string, number> = {
        'iPhone 18': 7999,
        'iPhone 18 Pro': 8999,
        'MacBook Pro': 1999,
        'AirPods Pro': 199,
        'Nike Air Max': 199,
        'Adidas UltraBoost': 199,
      };
      const unitPrice = prices[productName] ?? 0;
      const totalPrice = unitPrice * quantity;

      if (!unitPrice) {
        return `商品 ${productName} 不存在`;
      }

      // return `创建订单,商品名称: ${productName},数量: ${quantity},客户名称: ${customerName},订单金额: ${totalPrice} 元}`;
      const orderId = `ORDER-${Date.now().toString().slice(-6)}`;
      return `订单 ${orderId} 创建成功,商品名称: ${productName},数量: ${quantity},客户名称: ${customerName},订单总金额: ${totalPrice} 元`;
    },
    {
      name: 'create_order',
      description: '创建订单,输入参数:商品名称,输出一个字符串,包含订单信息',
      schema: z.object({
        productName: z.string().describe('商品名称，例如 iPhone 18'),

        quantity: z.number().int().positive().describe('购买数量，例如 1'),

        customerName: z.string().describe('客户姓名，例如 张三'),
      }),
    },
  );

  // 工具3 查询订单状态
  private checkOrderStatusTool = tool(
    async ({ orderId }: { orderId: string }) => {
      // 模拟订单状态
      const statuses = [
        '待支付',
        '已支付',
        '待发货',
        '已发货',
        '已完成',
        '已取消',
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const extra = status === '已取消' ? `订单因库存不足被取消` : '';

      return `订单 ${orderId}的状态时 ${status} ${extra}`;
    },
    {
      name: 'check_order',
      description: '查询订单状态,输入参数:订单ID,输出一个字符串,包含订单状态',
      schema: z.object({
        orderId: z.string().describe('订单ID,例如: ORDER-123456'),
      }),
    },
  );

  // 工具4 申请退款
  private refundTool = tool(
    async ({ orderId, reason }: { orderId: string; reason: string }) => {
      // 模拟退款
      // return `订单 ${orderId} 已申请退款`;
      const refundId = `REFUND-${Date.now().toString().slice(-6)}`;
      return `成功提交退款申请,退款ID: ${refundId}，订单ID: ${orderId}，退款原因: ${reason}`;
    },
    {
      name: 'refund_tool',
      description: '申请退款,输入参数:订单ID,输出一个字符串,包含退款信息',
      schema: z.object({
        orderId: z.string().describe('订单ID,例如: ORDER-123456'),
        reason: z.string().describe('退款原因,例如: 商品描述与实际不符'),
      }),
    },
  );

  async runAgent(message: string) {
    //
    const tools = [
      this.checkProductTool,
      this.createOrderTool,
      this.checkOrderStatusTool,
      this.refundTool,
    ];
    const toolMap: Record<string, any> = {
      check_product: this.checkProductTool,
      create_order: this.createOrderTool,
      check_order: this.checkOrderStatusTool,
      refund_tool: this.refundTool,
    };

    // bindTools 方法可以把工具绑定到 llm 上，这样模型生成回答时就可以调用工具了
    // 模型会根据用户的输入和对话的上下文来判断什么适合需要调用工具，以及调用哪个工具，并且把工具的输出结果整合到最终的回答中并返回给用户
    // 注册成功 模型回复里面会包含 tool_calls 字段 告诉我们调用了哪个工具以及调用的参数
    const llmWithTools = this.llm.bindTools(tools);

    // 消息历史  agent 每一轮都能看到 完整的对话 + 工具调用结果
    const messages: any[] = [
      // 设定系统角色，告诉模型他是一个智能客服助手，能够处理订单查询，创建订单，查询订单状态，申请退款等任务
      new SystemMessage({
        content: `你是一个专业的订单助手,你可以查询商品库存信息,创建订单,查询订单状态,申请退款
        你可以使用一下工具帮助客户：
        - check_product: 查询商品库存信息，输入参数:商品名称,输出一个字符串,包含商品库存和价格信息
        - create_order: 创建订单,输入参数:商品名称,购买数量,客户名称,输出一个字符串,包含订单信息
        - check_order: 查询订单状态,输入参数:订单ID,输出一个字符串,包含订单状态
        - refund_tool: 申请退款,输入参数:订单ID,退款原因,输出一个字符串,包含退款信息
        工作原理：
        1. 先用工具获取真实信息，再给用户回复
        2. 下单前必须先查询库存，确认有货才能下单
        3.下单时要知道用户姓名，如果没有提供，要先询问用户姓名
        4.回复简介友好，使用中文
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
