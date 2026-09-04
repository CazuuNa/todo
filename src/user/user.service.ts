import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  async createUser(CreateUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        name: CreateUserDto.name,
        email: CreateUserDto.email ?? '',
        password: CreateUserDto.password,
        role: CreateUserDto.role ?? 'user',
      },
    });
    return { success: true, message: `用户${user.name}创建成功`, data: user };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: false,
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      message: 'success',
      data: users,
    };
  }
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: false,
      },
    });
    if (!user) {
      return { success: false, message: `用户 ${id} 不存在` };
    }
    return { success: true, data: user };
  }

  async delete(id: number) {
    try {
      const user = await this.prisma.user.delete({
        where: { id },
      });
      return { success: true, message: `用户${user.name}删除成功` };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          message: `用户 ${id} 不存在`,
          cause: error,
        });
      }
      throw error;
    }
  }

  async update(id: number, user: UpdateUserDto) {
    try {
      const updateUser = await this.prisma.user.update({
        where: { id },
        data: {
          name: user.name ?? '',
          email: user.email ?? '',
          role: user.role ?? 'user',
        },
      });
      return { success: true, message: `用户${updateUser.name}更新成功`, data: updateUser };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          message: `用户 ${id} 不存在`,
          cause: error,
        });
      }
      throw error;
    }
  }

  async page(pageSize: number, pageNum: number) {
    const users = await this.prisma.user.findMany({
      skip: (pageNum - 1) * pageSize, // 跳过前 (pageNum - 1) 页的记录
      take: pageSize, // 取 pageSize 条记录
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: false,
      },
    })
    if (!users) {
      return { success: false, message: `用户列表为空` };
    }
    return { success: true, data: users };
  }
}
