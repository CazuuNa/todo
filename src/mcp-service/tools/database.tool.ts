// 查询数据库工具

import { Pool } from 'pg';
import 'dotenv/config';

//mpc server 独立进程，需要初始化数据库链接

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 查询数据库工具
export async function handleDatabaseQuery(args: {
  name?: string;
  role?: string;
  limit?: number;
}): Promise<string> {
  const { name, role, limit = 10 } = args; // 解构赋值，获取参数中的name、role、limit
  const conditions: string[] = []; // 定义一个空数组，用于存储查询条件
  if (name) conditions.push(`name LIKE '%${name}%'`); // 如果name存在，添加查询条件，包含name 模糊查询
  if (role) conditions.push(`role = '${role}'`); // 如果role存在，添加查询条件，等于role
  const query = `SELECT id, name, role From users ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''} LIMIT ${limit}`;
  const result = await pool.query(query);
  const users = result.rows;
  if (users.length === 0) return '没有查询到用户'; // 如果查询结果为空，返回提示信息
  const userList = users
    .map((user) => `ID:${user.id}, Name:${user.name}, Role:${user.role}`)
    .join('\n'); // 提取用户信息，用换行分隔
  return `Found ${users.length} users:\n${userList}`; // 返回查询结果的用户列表
}
