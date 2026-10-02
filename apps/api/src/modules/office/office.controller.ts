import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, Req, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { User } from '../../entities/user.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { OfficeService } from './office.service';
import { integer } from './office-validation';

@Controller('office')
export class OfficeController {
  constructor(private readonly service:OfficeService){}
  @Get('me') @Header('Cache-Control','no-store') me(@Req() req:{user:User}) {return this.service.me(req.user);}
  @Get('workspace') @Header('Cache-Control','no-store') workspace(@Req() req:{user:User},@Query('projectId') projectId?:string) {return this.service.workspace(req.user,projectId===undefined?undefined:integer(Number(projectId)));}
  @Post('projects') projectSave(@Req() req:{user:User},@Body() body:unknown){return this.service.projectSave(req.user,body);}
  @Post('templates') templateSave(@Req() req:{user:User},@Body() body:unknown){return this.service.templateSave(req.user,body);}
  @Post('records') recordCreate(@Req() req:{user:User},@Body() body:unknown){return this.service.recordCreate(req.user,body);}
  @Post('actions') recordAction(@Req() req:{user:User},@Body() body:unknown){return this.service.recordAction(req.user,body);}
  @Post('records/:id/documents') @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:10*1024*1024,files:1}}))
  upload(@Req() req:{user:User},@Param('id',ParseIntPipe) id:number,@UploadedFile() file:Express.Multer.File){return this.service.upload(req.user,id,file);}
  @Get('documents/:id') @Header('Cache-Control','no-store') @Header('X-Content-Type-Options','nosniff')
  async download(@Req() req:{user:User},@Param('id',ParseIntPipe) id:number){const f=await this.service.download(req.user,id);return new StreamableFile(f.content,{type:f.mime,disposition:`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`});}
  @Get('records/:id/print') @Header('Cache-Control','no-store') @Header('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox")
  @Header('Content-Type','text/html; charset=utf-8') print(@Req() req:{user:User},@Param('id',ParseIntPipe) id:number){return this.service.print(req.user,id);}
}
@Controller('office-access') @Roles(UserRole.ADMIN)
export class OfficeAccessController {
  constructor(private readonly service:OfficeService){}
  @Get() @Header('Cache-Control','no-store') list(@Req() req:{user:User}){return this.service.accessList(req.user);}
  @Post('save') save(@Req() req:{user:User},@Body() body:unknown){return this.service.accessSave(req.user,body);}
  @Post('provision') @Header('Cache-Control','no-store') @Throttle({default:{limit:15,ttl:60000}})
  provision(@Req() req:{user:User},@Body() body:unknown){return this.service.provision(req.user,body);}
}
