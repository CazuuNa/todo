import { Injectable } from '@nestjs/common';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../config';
import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';
import {
  ChatPromptTemplate,
  PromptTemplate,
  FewShotPromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

@Injectable()
export class RagService {
  private llm = new ChatOllama({
    model: config.ollama.chatModel,
    temperature: config.ollama.temperature,
    baseUrl: config.ollama.host,
    think: false, // 关闭思考模式
    numPredict: 512, // 生成文本的最大 token 值 512 比较合理的值，可根据需求调整
  });

  // 向量化模型：把文本转成数字向量（用于比较相似度）
  private embeddings = new OllamaEmbeddings({
    model: config.ollama.embedModel,
    baseUrl: config.ollama.host,
  });

  // 内存向量库 （null 表示未初始化）
  private vectorStore: MemoryVectorStore | null = null;
  // 文档数量
  private docCount = 0;

  async loadDocuments(
    documents: {
      id: string;
      content: string;
      source?: string;
      title?: string;
      category?: string;
    }[],
  ) {
    // 文本拆分器：把文档内容拆分成多个段落
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      // 分隔符优先级：从上到下依次尝试 第一优先：段落分隔符 第二优先：换行 第三优先：句号 第四优先：感叹号 第五优先：问号 最后强制按字符数截断
      separators: ['\n\n', '\n', '.', '！', '？', ' ', ''],
    });

    // 把所有文档的段落都添加到一个数组中
    const allDocs: Document[] = [];
    for (const doc of documents) {
      const chunks = await textSplitter.createDocuments(
        [doc.content],
        [
          {
            source: doc?.source || doc.id,
            title: doc?.title || doc.id,
            category: doc?.category || doc.id,
            docId: doc.id,
          },
        ],
      );

      allDocs.push(...chunks);
    }

    // 内部调用 memoryVectorStore 初始化向量库 转成向量
    // fromDocuments 方法：批量向量化所有文档块，存入向量库
    this.vectorStore = await MemoryVectorStore.fromDocuments(
      allDocs,
      this.embeddings,
    );
    this.docCount = documents.length;

    return {
      success: true,
      originalDocs: documents.length,
      totalChunk: allDocs.length,
      message: `成功加载 ${documents.length} 个文档，共 ${allDocs.length} 个段落`,
    };
  }

  getStatus() {
    return {
      success: true,
      loaded: !!this.vectorStore,
      docCount: this.docCount,
      message: this.vectorStore
        ? `已加载 ${this.docCount} 个文档`
        : `当前未加载任何文档`,
    };
  }

  async search(query: string, topK = 3) {
    if (!this.vectorStore) {
      return {
        success: false,
        message: '请先加载文档',
      };
    }
    // similaritySearchWithScore
    // 1 把 query 向量化， 调用 embedding.embedQuery 方法
    // 2 和向量库里面的所有文档 向量计算 余弦相似度
    // 3 按照相似度排序 返回前 topK 个文档
    // similaritySearch和similaritySearchVectorWithScore的区别：
    //1.similaritySearchVectorWithScore返回每个文档的向量表示
    //2.similaritySearch返回每个文档的文本内容

    const results = await this.vectorStore.similaritySearchWithScore(
      query,
      topK,
    );
    return {
      query,
      results: results.map(([doc, score]) => ({
        content: doc.pageContent,
        source: doc.metadata.source,
        title: doc.metadata.title,
        category: doc.metadata.category,
        score,
      })),
    };
    // return this.vectorStore.similaritySearch(query, topK);
  }

  // 真正的rag 实现问答功能
  async query(question: string, topK = 3) {
    
    if (!this.vectorStore) {
      return {
        success: false,
        message: '请先加载文档',
      };
    }
    // 1. 检索相关文档块
    const retrieved = await this.vectorStore.similaritySearchWithScore(
      question,
      topK,
    );

    if (retrieved.length === 0) {
      return {
        success: false,
        message: '未检索到相关文档',
      };
    }

    // 2. 把检索结果拼接成 字符串
    // 【1】 把第一块内容 \n\n[2] 第二块内容
    // 编号 方便模型在回答引入
    const context = retrieved.map(([doc],i) => `[${i+1}] ${doc.pageContent}`).join('\n\n');

    // 3. RAG Prompt 严格限制模型只能参考资料检索结果
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system", `你是一个专业的知识库回答助手，严格基于参考资料回答，
        规则：
        1.只根据参考资料内容回答，不能自己编造内容。
        2.如果参考资料没有回答，只能回答“不知道”。
        3.回答时，要引用参考资料中的内容，不能自己编造内容。
参考资料：{context}`
      ],
      [
        "human", question
      ]
    ])

    // 4. 调用模型回答
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const answer = await chain.invoke({context,question});
    return {
      question,
      answer,
      sources:retrieved.map(([doc,score]) =>({
        content: doc.pageContent,
        source: doc.metadata.source,
        title: doc.metadata.title,
        category: doc.metadata.category,
        score,
      }))
    }
  }

  async clear() {
    this.vectorStore = null;
    this.docCount = 0;
    return {
      success: true,
      message: '已清空向量库',
    };
  }
}
