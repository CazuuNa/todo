import { Injectable } from '@nestjs/common';
import { ChatOllama} from '@langchain/ollama'
import {HumanMessage, SystemMessage} from '@langchain/core/messages'
import type { Response } from 'express';
import {StringOutputParser} from '@langchain/core/output_parsers' // 字符串输出解析器


import { config } from '../config';

@Injectable()
export class ModelsService {
  // 创建 chatOllama 实例
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think:false, // 关闭思考模式
    numPredict:512, // 预测次数
  })
  async baseChat(message) {
    const response = await this.llm.invoke([
      new HumanMessage(message)
    ])
    console.log('base chat',response)
    return {
      question: message,
      answer: response.content,
      usage: response.usage_metadata, // token使用情况
    }
  }

  // systemMessage 设定模型的角色和行为，HumanMessage 用户输入
  async chatSystem(system:string, message:string) {
    const response = await this.llm.invoke([
      new SystemMessage(system), // 可选系统消息，角色和行为
      new HumanMessage(message)
    ])
    return {
      system, // 系统消息，角色和行为
      question: message, // 用户输入的消息
      answer: response.content, // 模型回答
      usage: response.usage_metadata, // token使用情况
    }
  }

  async chatStream(message:string,res:Response) {
    // 设置响应头，告诉客户端是一个流
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const stream = await this.llm.stream([
      new HumanMessage(message)
    ])
    let answer = ''
    for await (const chunk of stream) {
      console.log('Receive chunk',chunk)
      answer += chunk.content
    }
    res.write(`data: ${answer}\n\n`)
    res.end()
    // return {
    //   question: message,
    //   answer,
    // }
  }

  // pipeline 组合多个模型一起使用的示例，先用一个模型生成提示词，再用另外一个模型根据提示词生成回答
  async chatParser(message:string) {
    // prompt 模板 包含一个占位符 {input}，用于替换用户输入的消息
    // llm 
    // parser 解析器，用于从模型的输出中提取结构化数据，这里我们用一个简单的正则表达式解析器，提取出回答中的关键词
    const chain = await this.llm.pipe(new StringOutputParser())
    const answer = await chain.invoke([
      new HumanMessage(message)
    ])
    // answer 是一个字符串，包含模型回答的关键词,不再需要 response.content 中提取
    return {
      question: message,
      answer,
    }
  }
}
