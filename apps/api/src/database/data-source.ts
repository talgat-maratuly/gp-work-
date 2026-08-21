import { loadEnvFiles } from './load-env';
import { DataSource } from 'typeorm';
import { getTypeOrmPostgresOptions } from './database.config';
import {
  Brigade,
  BrigadeMember,
  FormSetting,
  NurseryObject,
  Section,
  SectionCodeCounter,
  Task,
  User,
  WorkLog,
  WorkType,
} from '../entities';

loadEnvFiles();

export default new DataSource({
  ...getTypeOrmPostgresOptions(),
  entities: [
    NurseryObject,
    Section,
    WorkType,
    WorkLog,
    SectionCodeCounter,
    User,
    Brigade,
    BrigadeMember,
    Task,
    FormSetting,
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
