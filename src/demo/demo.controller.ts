import { Controller, Get } from '@nestjs/common';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly DemoService: DemoService) {}

  @Get('/get')
  getDemo(): string {
    return this.DemoService.getDemo();
  }
}
