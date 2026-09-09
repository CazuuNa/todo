import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config';
// AIMessage 表示AI消息类型，用于存储AI生成的消息
// HumanMessage 表示用户消息类型，用于存储用户输入的消息
// SystemMessage 表示系统消息类型，用于存储系统提示
// BaseMessage 表示基础消息类型，主要用于存储消息的内容
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import type { Response } from 'express';

@Injectable()
export class MemoryService {
  // 创建 chatOllama 实例
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think: false, // 关闭思考模式
    numPredict: 512, // 预测次数
  });

  // 为什么都要用private？
  // 因为会话消息是私有的，不应该被外部访问
  // 所以用private来保护会话消息
  private sessions = new Map<string, BaseMessage[]>(); // 会话存储，键为会话ID，值为会话消息

  private systemMessage = new SystemMessage(
    '你是一个智能助手，能记住对话历史，根据上下文准确的回答',
  );
  // 获取或创建会话消息
  // 如果会话不存在，创建一个空数组
  // 如果会话存在，返回会话消息
  private getOrCreate(sessionId: string): BaseMessage[] {
    let history = this.sessions.get(sessionId);

    if (!history) {
      history = [this.systemMessage];
      this.sessions.set(sessionId, history);
    }

    return history;
  }

  async chat(sessionId: string, message: string) {
    const history = this.getOrCreate(sessionId);
    // 把用户消息添加到会话消息中
    history.push(new HumanMessage(message));
    // 把完整的历史会话消息传递给模型，获取AI回复
    const response = await this.llm.invoke(history);

    // 把模型的回复也加入历史会话消息中·
    history.push(response);
    return {
      sessionId,
      message,
      reply: response.content,
      turns: Math.floor(history.length / 2),
    };
  }

  async getHistory(sessionId: string) {
    // return this.sessions.get(sessionId);
    // 查看会话消息
    const history = this.sessions.get(sessionId);
    if (!history) {
      return { sessionId, exists: false, messages: [] };
    }
    // 过滤出用户消息和AI消息
    const messages = history
      .filter((msg) => !(msg instanceof SystemMessage)) // 过滤出用户消息和AI消息
      .map((m, i) => ({
        index: i + 1,
        role: m instanceof HumanMessage ? 'user' : 'assistant',
        content: m.content,
      })); // 映射为对象数组，包含索引、角色和内容
    return {
      sessionId,
      exists: true,
      turns: Math.floor(history.length / 2),
      messages,
    };
  }

  // 清除会话消息
  async clearSession(sessionId: string) {
    // 检查会话是否存在
    if (!this.sessions.has(sessionId)) {
      return { sessionId, exists: false };
    }
    // 清除会话消息
    this.sessions.set(sessionId, [this.systemMessage]); // 重置会话消息为系统提示，清除所有用户消息和AI消息 不需要直接写成 this.sessions.delete(sessionId); 这样会删除会话，而不是重置
    return { sessionId, exists: true, message: '会话已清除' };
  }
  // 列出所有会话ID
  async listSessions() {
    const sessions = Array.from(this.sessions.entries()).map(
      ([id, history]) => ({
        sessionId: id,
        turns: Math.floor(history.length / 2), // 计算轮数，每个用户消息和AI消息算一轮
      }),
    );
    return {
      total: sessions.length,
      sessions,
    };
  }

  // 多轮对话 sse 流式输出
  async chatStream(sessionId: string, message: string, res: Response) {
    // 先要设置请求头
    res.setHeader('Content-Type', 'text/event-stream'); // 设置响应头为事件流
    res.setHeader('Connection', 'keep-alive'); // 保持连接，避免客户端关闭连接
    res.setHeader('Cache-Control', 'no-cache'); // 禁用缓存，确保客户端获取最新数据
    res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有来源访问

    const history = this.getOrCreate(sessionId);
    // 把用户消息添加到会话消息中
    history.push(new HumanMessage(message));

    // 初始化空字符串，用于存储完整回复
    let fullReply = '';

    // 把完整的历史会话消息传递给模型，获取AI回复
    const stream = await this.llm.stream(history);

    // 遍历流，将每个块添加到完整回复中
    for await (const chunk of stream) {
      // 检查是否有内容
      if (chunk.content) {
        const text = String(chunk.content); // 转换为字符串
        fullReply += text; // 累加到完整回复中
        res.write(`data: ${JSON.stringify({ reply: fullReply })}\n\n`);
      }
    }

    // 流结束后把完整回复存入历史
    history.push(new AIMessage(fullReply));
    res.write(
      `data: ${JSON.stringify({ text: '[done]', turns: Math.floor(history.length / 2) })}\n\n`,
    ); // 发送完整回复
    res.end(); // 结束响应
  }
}
