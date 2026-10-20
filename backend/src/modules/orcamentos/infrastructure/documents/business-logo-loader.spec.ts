import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import {
  LOGO_ASSET_PATH,
  LogoAssetMissingError,
  readLogoAsset,
} from './business-logo-loader.js';

describe('business logo loader', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'cortinando-logo-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('resolves the fixed asset next to the compiled document files', () => {
    expect(LOGO_ASSET_PATH).toMatch(
      /infrastructure[\\/]documents[\\/]assets[\\/]logo\.png$/,
    );
    expect(isAbsolute(LOGO_ASSET_PATH)).toBe(true);
  });

  it('raises a controlled error when the asset is missing', async () => {
    await expect(
      readLogoAsset(join(directory, 'logo.png')),
    ).rejects.toBeInstanceOf(LogoAssetMissingError);
  });

  it('reads the PNG bytes when the asset is present', async () => {
    const path = join(directory, 'logo.png');
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    await writeFile(path, bytes);

    await expect(readLogoAsset(path)).resolves.toEqual(Buffer.from(bytes));
  });
});
