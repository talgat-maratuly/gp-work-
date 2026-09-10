import { AuthBootstrapService } from './auth-bootstrap.service';
import { UserRole } from '../../common/enums/user-role.enum';

describe('AuthBootstrapService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      ADMIN_USERNAME: 'owner',
      ADMIN_PASSWORD: 'new-environment-password',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('never overwrites an existing administrator during restart', async () => {
    const existing = {
      id: 7,
      username: 'owner',
      passwordHash: 'persisted-hash',
      role: UserRole.ADMIN,
      isActive: false,
    };
    const repo = {
      findOne: jest.fn().mockResolvedValueOnce(existing),
      create: jest.fn(),
      save: jest.fn(),
    };

    await new AuthBootstrapService(repo as never).onModuleInit();

    expect(repo.save).not.toHaveBeenCalled();
    expect(existing).toMatchObject({
      username: 'owner',
      passwordHash: 'persisted-hash',
      isActive: false,
    });
  });

  it('rejects a weak initial production administrator password', async () => {
    process.env.ADMIN_PASSWORD = 'short';
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(new AuthBootstrapService(repo as never).onModuleInit())
      .rejects.toThrow('минимум 8 символов');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
