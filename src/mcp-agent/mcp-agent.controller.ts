import { Controller, Get, Post, Body } from '@nestjs/common';
import { McpAgentService } from './mcp-agent.service';
@Controller('mcp-agent')
export class McpAgentController {
  constructor(private readonly mcpAgentService: McpAgentService) {}

  @Get('tools')
  listTools() {
    return this.mcpAgentService.listTools();
  }
  @Post('call-tool')
  callTool(@Body() body: {message: string}) {
    return this.mcpAgentService.callTool(body.message);
  }
}
