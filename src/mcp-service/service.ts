import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';

import {handleDatabaseQuery} from './tools/database.tool';
import {handleFileRead} from './tools/file.tool';
import {handleWeatherQuery} from './tools/weather.tool';


const server = new McpServer({
  name:'Example MCP Service',
  description:'An example MCP service',
  version:'1.0.0',
});

// 工具1 查询数据库
server.registerTool(
  'queryDatabase',
  {
    description:'Query the database for users based on name and role and limit',
    inputSchema:z.object({
      name:z.string().optional(),
      role:z.enum(['user','admin','guest']).optional(),
      limit:z.number().optional().default(10),
    }),
  },
  async (args) => {
    try {
      const res = await handleDatabaseQuery(args);
      return {content:[{type:'text',text:res}]};  
    } catch (error:any) {
      console.error('Error querying database:', error);
      return {content:[{type:'text',text:error.message || 'Error querying database'}]};
    }
  }
)

// 工具2 读文件的工具
server.registerTool(
  'readFile',
  {
    description:'Read the contents of a file given its path',
    inputSchema:z.object({
      filePath:z.string().describe('The path to the file to read'),
    }),
  },
  async (args) => {
    const {filePath} = args
    try {
      const res = handleFileRead({operation:'read',filePath});
      return {content:[{type:'text',text:res}]};  
    } catch (error:any) {
      console.error('Error reading file:', error);
      return {content:[{type:'text',text:error.message || 'Error reading file'}]};
    }
  }
)

// 工具3 天气查询
server.registerTool(
  'queryWeather',
  {
    description:'Query the weather for a given location',
    inputSchema:z.object({
      location:z.string().describe('The location to query the weather for'),
    }),
  },
  async (args) => {
    const {location} = args
    try {
      const res = handleWeatherQuery({location});
      return {content:[{type:'text',text:res}]};  
    } catch (error:any) {
      console.error('Error querying weather:', error);
      return {content:[{type:'text',text:error.message || 'Error querying weather'}]};
    }
  }
)

async function startServer() {
  try {
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    console.log('MCP server started');
  } catch (error:any) {
    console.error('Error starting MCP server:', error);
  }
}

startServer().catch;