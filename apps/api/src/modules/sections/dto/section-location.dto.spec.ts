import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSectionDto } from './create-section.dto';
import { UpdateSectionDto } from './update-section.dto';

describe.each([CreateSectionDto, UpdateSectionDto])('%p location validation', (Dto) => {
  const errors = (location: object) => validate(plainToInstance(Dto, { objectId: 1, name: 'Участок', ...location }));

  it('accepts an unconfigured draft and valid zero coordinates', async () => {
    expect(await errors({})).toHaveLength(0);
    expect(await errors({ latitude: 0, longitude: 0, radiusMeters: 10 })).toHaveLength(0);
    expect(await errors({ latitude: -90, longitude: 180, radiusMeters: 5000 })).toHaveLength(0);
  });

  it.each([
    { latitude: null }, { longitude: null }, { radiusMeters: null },
    { latitude: '' }, { longitude: ' ' }, { latitude: false },
    { latitude: 91 }, { longitude: -181 }, { radiusMeters: 9 },
    { radiusMeters: 5001 }, { radiusMeters: 10.5 },
  ])('rejects invalid location %p instead of coercing it', async (location) => {
    expect((await errors(location)).length).toBeGreaterThan(0);
  });
});
