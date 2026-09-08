import { Controller, Post, Body, Res } from '@nestjs/common';
import { ModelsService } from './models.service';
import type { Response } from 'express';


@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService:ModelsService) {}
  @Post('chat')
  baseChat(@Body() body:{message:string}) {
    return this.modelsService.baseChat(body.message)
  }

  @Post('chatSystem')
  chatSystem(@Body() {system, message}:{system:string, message:string}) {
    return this.modelsService.chatSystem(system, message)
  }

  @Post('chat-stream')
  ChatStream(@Body() body:{message:string},@Res() res:Response) {
    return this.modelsService.chatStream(body.message,res)
  }

  @Post('chat-parser')
  chatParser(@Body() body:{message:string}) {
    return this.modelsService.chatParser(body.message)
  }
}
