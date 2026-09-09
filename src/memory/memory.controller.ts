import { Body, Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import { MemoryService } from './memory.service';
import type { Response } from 'express';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post('chat')
  chat(@Body() body: { sessionId: string, message: string }) {
    return this.memoryService.chat(body.sessionId,body.message)
  }

  @Get('history/:sessionId')
  getHistory(@Param() body: { sessionId: string }) {
    return this.memoryService.getHistory(body.sessionId);
  }

  @Delete('session/:sessionId')
  clearSession(@Param('sessionId') sessionId: string) {
    return this.memoryService.clearSession(sessionId);
  }

  @Get('sessions')
  listSessions() {
    return this.memoryService.listSessions();
  }

  @Post('chat-stream')
  chatStream(@Body() body: { sessionId: string, message: string },@Res() res: Response) {
    this.memoryService.chatStream(body.sessionId,body.message,res)
    
  }
}
