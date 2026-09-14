import { Body, Controller, Get, Post } from '@nestjs/common';
import { McpClientService } from './mcp-client.service';

@Controller('mcp-client')
export class McpClientController {
  constructor(private readonly mcpClientService: McpClientService) {}
  @Get('tools')
  listTools () {
    // 获取调用MCP服务工具列表
    return this.mcpClientService.listTools();
  }

  // 调用具体方法执行MCP服务任务
  @Post('call-tool')
  callTool(@Body() body: {toolName: string, args: any[]}) {
    return this.mcpClientService.callTool(body.toolName, body.args);
  }
}
