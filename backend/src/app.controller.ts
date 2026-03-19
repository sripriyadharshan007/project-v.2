import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      ok: true,
      message: 'Workflow Engine API is running',
      docs: '/api/docs',
    };
  }
}

