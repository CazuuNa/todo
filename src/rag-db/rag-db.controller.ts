import { Body, Controller, Post, Get, Delete } from '@nestjs/common';
import { RagDbService } from './rag-db.service';

@Controller('rag-db')
export class RagDbController {
  constructor(private readonly ragService: RagDbService) {}

  @Post('load')
  loadDocuments(@Body() body: { documents: {id: string,content: string,source?: string,title?: string,category?: string}[] }) {
    return this.ragService.loadDocuments(body.documents);
  }

  @Get('status')
  getStatus() {
    return this.ragService.getStatus();
  }

  // 纯向量查询，不通过大模型，直接看检索结果
  @Post('search')
  search(@Body() body: { query: string, topK?: number }) {
    return this.ragService.search(body.query,body.topK);
  }

  @Post('query')
  query(@Body() body: { question: string, topK?: number }) {
    return this.ragService.query(body.question,body.topK);
  }

  // @Delete('clear')
  // clear() {
  //   return this.ragService.clear();
  // }
}
