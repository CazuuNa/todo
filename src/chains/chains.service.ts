import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  RunnableSequence,
  RunnablePassthrough,
} from '@langchain/core/runnables';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config';

@Injectable()
export class ChainsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think: false, // 关闭思考模式
    numPredict: 512, // 生成文本的最大 token 值 512 比较合理的值，可根据需求调整
  });
  // 多步执行，每一步的输出都可以作为下一步的输入，适合需要分布处理的复杂任务
  // 文章润色例子，第一步对文章进行分析，提取文章的主题、风格、存在的问题等关键信息，
  // 第二步根据第一步分析结果对文章进行润色，改进文章的表达结构、用词等方面，使文章更加流畅、清晰。
  async polish(article: string) {
    const analysPrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个专业的文章分析器,只输出问题列表，不要其他的内容'],
      ['human', `分析这篇文章存在的问题：{article}`],
    ]);
    const polishPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        '你是一个专业的文章润色器,根据输出的问题列表对文章进行润色，改进文章的表达、结构、用词等方面，使文章更加流畅、清晰。',
      ],
      ['human', `根据以下分析结果润色这篇文章：{analysis},文章内容：{article}`],
    ]);
    // 第一条 chain article -> 分析 analysPrompt -> analysis 字符串
    const analysisChain = analysPrompt
      .pipe(this.llm)
      .pipe(new StringOutputParser());
    // 第一步骤 chain 保留 article 原文， + 调用 analysisChain 分析文章，获取 analysis 字符串
    // 第二步骤 chain analysis 字符串 + article 字符串 -> 润色后的文章字符串 polishChain
    // RunnableSequence 用于串联多个 Runnable 对象，实现链式调用, 每个 Runnable 对象的输出都可以作为下一个 Runnable 对象的输入
    // RunnablePassthrough 用于保留输入，直接返回输入值
    const fullChain = RunnableSequence.from([
      {
        article: new RunnablePassthrough(), // 保留 article 原文
        analysis: analysisChain, // 调用 analysisChain 分析文章，获取 analysis 字符串
      },
      polishPrompt.pipe(this.llm).pipe(new StringOutputParser()), // 调用 polishPrompt 润色文章，获取润色后的文章字符串
    ]);
    const polishChain = await fullChain.invoke({ article });
    return {
      originalArticle: article,
      polishedArticle: polishChain,
    };
    // return `${article},经过链式调用处理过的`;
  }

  // 顺序链 调用 ，博客生成例子，（关键词 -- 大纲---文章--seo标题）
  async generateBlog(keywords: string, style: string) {
    // 三条 chain 顺序执行 上一步输出传给下一步 关键词 =》 大纲 =》 文章 =》 seo标题
    const outlinePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个专业的博客大纲生成器,根据关键词生成博客大纲'],
      ['human', `根据关键词生成博客大纲，关键词：{keywords},风格：{style}`],
    ])
      .pipe(this.llm)
      .pipe(new StringOutputParser());
    const articlePrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个专业的博客文章生成器,根据大纲生成博客文章'],
      ['human', `根据大纲生成博客文章，大纲：{outline},风格：{style}`],
    ])
      .pipe(this.llm)
      .pipe(new StringOutputParser());

    const seoPrompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个专业的博客seo标题生成器,根据文章生成3个博客标题'],
      ['human', `根据文章生成3个博客标题，文章：{article},风格：{style}`],
    ])
      .pipe(this.llm)
      .pipe(new StringOutputParser());

    const outLine = await outlinePrompt.invoke({ keywords, style });
    const article = await articlePrompt.invoke({ outline: outLine, style });
    const seo = await seoPrompt.invoke({ article, style });

    return {
      keywords,
      outLine,
      article,
      seo,
    };
  }

  // 条件的分支链，智能路由例子
  // 用户输入一个问题，，模型根据问题内容和类型来判断调用哪个功能模块进行回答，比如 翻译，总结，分类等
  async smartRouter(question: string) {
    // return question;
    // 第一步分类
    const routerPrompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `分析用户的问题，只输出分类标签：
        技术问题-TECH
        退款问题-REFUND
        订单问题-ORDER
        投诉建议-COMPLINT
        其他-OTHER`,
      ],
      ['human', `用户问题：{question}`],
    ])
      .pipe(this.llm)
      .pipe(new StringOutputParser());
    const category = await routerPrompt.invoke({ question });
    // 第二步根据分类结果调用不同处理模块
    const systemMap: Record<string, string> = {
      TECH: '你是一个专业的技术问题回答器,根据用户的问题，回答技术问题',
      REFUND: '你是一个专业的退款问题回答器,根据用户的问题，回答退款问题',
      ORDER: '你是一个专业的订单问题回答器,根据用户的问题，回答订单问题',
      COMPLINT: '你是一个专业的投诉建议回答器,根据用户的问题，回答投诉建议',
      OTHER: '你是一个专业的其他问题回答器,根据用户的问题，回答其他问题',
    };
    // const label = await routerPrompt.invoke({ question });
    const systemMessage = systemMap[category] || systemMap['OTHER'];
    // 第三步 把系统角色信息和用户问题一起给到大模型，让模型根据不同的角色信息来生成不同的回答内容
    const answerPrompt = ChatPromptTemplate.fromMessages([
      ['system', systemMessage],
      ['human', `用户问题：{question}`],
    ])
      .pipe(this.llm)
      .pipe(new StringOutputParser());
    const answer = await answerPrompt.invoke({ question });
    return {
      question,
      category,
      answer,
    };
  }
}
