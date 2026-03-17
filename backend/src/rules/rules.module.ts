import { Module } from '@nestjs/common';
import { RulesService } from './rules.service';
import { RulesController } from './rules.controller';
import { RulesRepository } from './rules.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RulesController],
  providers: [RulesService, RulesRepository],
  exports: [RulesService, RulesRepository],
})
export class RulesModule {}
