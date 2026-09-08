import { Body, Controller, Post } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';


@Controller('agents')
export class AgentsController {
  constructor(private readonly AgentsService: AgentsService) {}

  @Post('run')
  runAgent(@Body() body: { message: string }) {
    return this.AgentsService.runAgent(body.message);
  }
}
