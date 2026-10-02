import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type RegistrationResponseJSON, type AuthenticationResponseJSON } from '@simplewebauthn/server';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthService } from './auth.service';

// Never infer RP/origin from untrusted Host or forwarded headers.
export function passkeyConfig() {
  const origin = process.env.PASSKEY_ORIGIN || 'https://gp-work.gpartners.kz';
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost'))) {
    throw new Error('PASSKEY_ORIGIN must be an exact HTTPS origin');
  }
  return { origin, rpID: url.hostname };
}
const denied = () => new UnauthorizedException('Не удалось подтвердить ключ. Повторите вход или используйте пароль.');
const bindingHash = (binding: string) => createHash('sha256').update(binding).digest('hex');

@Injectable()
export class PasskeysService {
  constructor(private readonly db: DataSource, private readonly auth: AuthService) {}

  private async director(manager: EntityManager, id: number, version?: number, lock = false) {
    const query = manager.getRepository(User).createQueryBuilder('u')
      .addSelect(['u.authVersion', 'u.mustChangePassword']).where('u.id = :id', { id });
    if (lock) query.setLock('pessimistic_write');
    const user = await query.getOne();
    if (!user?.isActive || user.mustChangePassword || (version != null && user.authVersion !== version)) throw denied();
    if (user.role !== UserRole.DIRECTOR) throw new ForbiddenException('Пробный вход ключом доступен только директору.');
    await this.auth.attachPolicy(user);
    return user;
  }

  private async challenge(challenge: string, purpose: string, binding: string, actor?: User) {
    await this.db.query('DELETE FROM auth_passkey_challenges WHERE expires_at < now()');
    const id = randomUUID();
    await this.db.query(`INSERT INTO auth_passkey_challenges(id,challenge,purpose,binding,user_id,auth_version,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,now()+interval '5 minutes')`,
    [id, challenge, purpose, bindingHash(binding), actor?.id ?? null, actor?.authVersion ?? null]);
    return id;
  }

  private async consume(id: string, purpose: string, binding: string, actor?: User) {
    // DELETE commits before crypto verification: expired, failed and replayed responses cannot be reused.
    const rows = await this.db.query(`DELETE FROM auth_passkey_challenges WHERE id=$1 AND purpose=$2 AND binding=$3
      AND expires_at>now() AND user_id IS NOT DISTINCT FROM $4 AND auth_version IS NOT DISTINCT FROM $5 RETURNING challenge`,
    [id, purpose, bindingHash(binding), actor?.id ?? null, actor?.authVersion ?? null]);
    // PostgreSQL driver returns [rows, count] for DELETE ... RETURNING.
    const result = Array.isArray(rows[0]) ? rows[0] : rows;
    if (!binding || !result[0]) throw denied();
    return result[0].challenge as string;
  }

  async list(actor: User) {
    await this.director(this.db.manager, actor.id, actor.authVersion);
    return this.db.query(`SELECT id, created_at AS "createdAt", last_used_at AS "lastUsedAt" FROM auth_passkeys
      WHERE user_id=$1 AND auth_version=$2 ORDER BY created_at`, [actor.id, actor.authVersion]);
  }

  async registrationOptions(actor: User, password: string, binding: string) {
    const validated = await this.auth.validateUser(actor.username, password);
    if (validated.id !== actor.id || validated.authVersion !== actor.authVersion) throw denied();
    await this.director(this.db.manager, actor.id, actor.authVersion);
    const keys = await this.list(actor);
    if (keys.length >= 5) throw new BadRequestException('Можно сохранить до 5 ключей. Удалите неиспользуемый ключ.');
    const existing = await this.db.query('SELECT credential_id FROM auth_passkeys WHERE user_id=$1 AND auth_version=$2', [actor.id, actor.authVersion]);
    const options = await generateRegistrationOptions({ rpName: 'GP Work', rpID: passkeyConfig().rpID,
      userName: actor.username, userDisplayName: actor.fullName,
      userID: new Uint8Array(createHash('sha256').update(`gp-work-passkey-user:${actor.id}`).digest()),
      attestationType: 'none', excludeCredentials: existing.map((key: { credential_id: string }) => ({ id: key.credential_id })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
    });
    return { options, challengeId: await this.challenge(options.challenge, 'register', binding, actor) };
  }

  async register(actor: User, id: string, response: RegistrationResponseJSON, binding: string) {
    const challenge = await this.consume(id, 'register', binding, actor);
    let verified;
    try {
      verified = await verifyRegistrationResponse({ response, expectedChallenge: challenge,
        expectedOrigin: passkeyConfig().origin, expectedRPID: passkeyConfig().rpID, requireUserVerification: true });
    } catch { throw denied(); }
    if (!verified.verified || !verified.registrationInfo) throw denied();
    const credential = verified.registrationInfo.credential;
    await this.db.transaction(async manager => {
      await this.director(manager, actor.id, actor.authVersion, true);
      const [{ count }] = await manager.query('SELECT count(*) FROM auth_passkeys WHERE user_id=$1 AND auth_version=$2', [actor.id, actor.authVersion]);
      if (Number(count) >= 5) throw new BadRequestException('Достигнут предел ключей.');
      const inserted = await manager.query(`INSERT INTO auth_passkeys(id,user_id,credential_id,public_key,counter,auth_version)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(credential_id) DO NOTHING RETURNING id`,
      [randomUUID(), actor.id, credential.id, Buffer.from(credential.publicKey), credential.counter, actor.authVersion]);
      if (!inserted.length) throw new BadRequestException('Этот ключ уже зарегистрирован.');
    });
    return { ok: true };
  }

  async authenticationOptions(binding: string) {
    const options = await generateAuthenticationOptions({ rpID: passkeyConfig().rpID, userVerification: 'required' });
    return { options, challengeId: await this.challenge(options.challenge, 'login', binding) };
  }

  async authenticate(id: string, response: AuthenticationResponseJSON, binding: string) {
    const challenge = await this.consume(id, 'login', binding);
    return this.db.transaction(async manager => {
      const [key] = await manager.query('SELECT * FROM auth_passkeys WHERE credential_id=$1', [response.id]);
      if (!key) throw denied();
      const user = await this.director(manager, key.user_id, key.auth_version, true);
      // All updates/revocations take the same user lock before locking the key.
      const [fresh] = await manager.query('SELECT * FROM auth_passkeys WHERE id=$1 FOR UPDATE', [key.id]);
      if (!fresh) throw denied();
      let verified;
      try {
        verified = await verifyAuthenticationResponse({ response, expectedChallenge: challenge,
          expectedOrigin: passkeyConfig().origin, expectedRPID: passkeyConfig().rpID, requireUserVerification: true,
          credential: { id: fresh.credential_id, publicKey: new Uint8Array(fresh.public_key), counter: Number(fresh.counter) },
        });
      } catch { throw denied(); }
      if (!verified.verified) throw denied();
      await manager.query('UPDATE auth_passkeys SET counter=$1,last_used_at=now() WHERE id=$2', [verified.authenticationInfo.newCounter, key.id]);
      return this.auth.sessionFor(user);
    });
  }

  async remove(actor: User, id: string, password: string) {
    const validated = await this.auth.validateUser(actor.username, password);
    if (validated.id !== actor.id || validated.authVersion !== actor.authVersion) throw denied();
    await this.db.transaction(async manager => {
      await this.director(manager, actor.id, actor.authVersion, true);
      const found = await manager.query('SELECT id FROM auth_passkeys WHERE id=$1 AND user_id=$2', [id, actor.id]);
      if (!found.length) throw new BadRequestException('Ключ не найден. Обновите список.');
      await manager.query('DELETE FROM auth_passkeys WHERE id=$1 AND user_id=$2', [id, actor.id]);
      await manager.getRepository(User).update(actor.id, { authVersion: actor.authVersion + 1 });
      await manager.query('UPDATE auth_passkeys SET auth_version=$1 WHERE user_id=$2 AND auth_version=$3',
        [actor.authVersion + 1, actor.id, actor.authVersion]);
    });
    return { ok: true };
  }
}
