import { Body, Controller, Get, Param, Post, ParseIntPipe, Delete, Put } from '@nestjs/common';
import {UserService} from './user.service'
import {CreateUserDto} from './dto/create-user.dto'
import {UpdateUserDto} from './dto/update-user.dto'

@Controller('user')
export class UserController {
  constructor(private readonly userService:UserService) {}

  // @Get('getUser')
  // getUser(): string {
  //   return this.userService.getUser()
  // }

  @Post('add')
  createUser(@Body() user:CreateUserDto) {
    return this.userService.createUser(user)
  }

  @Get('list')
  findAll() {
    return this.userService.findAll()
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id:number) {
    return this.userService.findOne(id)
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id:number) {
    return this.userService.delete(id)
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id:number, @Body() user:UpdateUserDto) {
    return this.userService.update(id, user)
  }

  // 分页查询
  @Post('page')
  page(@Body('pageSize', ParseIntPipe) pageSize:number, @Body('pageNum', ParseIntPipe) pageNum:number) {
    return this.userService.page(pageSize, pageNum)
  }

}
