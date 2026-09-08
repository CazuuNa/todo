import { Injectable } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { ChatPromptTemplate, PromptTemplate, FewShotPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { config } from '../config';

@Injectable()
export class PromptsService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think: false, // 关闭思考模式
    numPredict: 512, // 生成文本的最大 token 值 512 比较合理的值，可根据需求调整
  });
  // 多消息对话模板
  async translate(text: string, targetLanguage: string) {
    // 调用第三方翻译 API Google Translate API
    // 下面是一个模拟翻译结果，实际应用中替换成API 调用结果
    // return `Translated text: ${text} to ${targetLanguage}`
    
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个专业的翻译'],
      ['user', `Translate ${text} to ${targetLanguage}`],
    ]);
    // pipe 把 prompt llm parser 串联起来
    // prompt.invoke({text,targetLanguage}) 会把用户输入的文本和目标语言替换到模板中，生成一个完整的消息，然后传入 llm 进行处理，通过 StringOutputParser 解析模型回答为字符串
    // 最后返回解析后的字符串作为翻译结果
    const chian = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const response = await chian.invoke({
      text,
      targetLanguage,
    })
    return {
      originalText: text,
      targetLanguage,
      translatedText: response,
    }
  }

  async summarize(text: string, maxWords: number) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个专业的摘要器'],
      ['user', `请将以下文本摘要为 ${maxWords} 个单词：${text}`],
    ]);
    const chian = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const response = await chian.invoke({
      text,
      maxWords,
    })
    return {
      originalText: text,
      maxWords,
      summarizedText: response,
    }
  }

  async classify(text: string) {

    // 数组例子
    const ex = [
      {text:'我非常喜欢这个产品',label:'积极'},
      {text:'我非常不喜欢这个产品',label:'消极'},
      {text:'这个产品一般般',label:'中性'},
      {text:'我可太喜欢这个产品了',label:'积极'},
    ]

    const examplePrompt = PromptTemplate.fromTemplate('输入：{text}\n输出: {label}')
    const fewShotPrompt = new FewShotPromptTemplate({
      examples:ex,
      examplePrompt,
      prefix:'请根据以下示例分类以下文本为积极或消极或中性：',
      suffix:'输入：{text}\n输出:',
      inputVariables:['text'],
    })


    const formattedPrompt = await fewShotPrompt.format({text:text})
    const res = await this.llm.invoke(formattedPrompt)
    return {
      text,label:res,
    }


    // const prompt = ChatPromptTemplate.fromMessages([
    //   ['system', '你是一个专业的分类器'],
    //   ['user', `请将以下文本分类为正面、负面或中性：${text}`],
    // ]);
    // const chian = prompt.pipe(this.llm).pipe(new StringOutputParser())
    // const response = await chian.invoke({
    //   text,
    // })
    // return {
    //   originalText: text,
    //   classification: response,
    // }
  }

  async codeReview(code: string,language: string) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个专业的代码审查器,帮助用户找出代码中的错误和改进建议'],
      ['user', `请审查以下{language} 代码，并指出其中错误和改进意见：\n{code}`],
    ]);
    const chian = prompt.pipe(this.llm).pipe(new StringOutputParser())
    const response = await chian.invoke({
      code,
      language,
    })
    return {
      code,
      language,
      review: response,
    }
  }
}
