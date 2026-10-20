import { Injectable, type OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Fixed, versioned asset (D150). Resolving it from this module keeps the
// lookup independent of the process working directory and works both from
// src (dev/tests) and from dist, where nest-cli copies the asset alongside
// the compiled file.
export const LOGO_ASSET_PATH = fileURLToPath(
  new URL('./assets/logo.png', import.meta.url),
);

export class LogoAssetMissingError extends Error {
  constructor() {
    super('Business logo asset is not available');
    this.name = 'LogoAssetMissingError';
  }
}

export async function readLogoAsset(path: string): Promise<Uint8Array> {
  try {
    return await readFile(path);
  } catch (error) {
    if (isNotFound(error)) {
      throw new LogoAssetMissingError();
    }

    throw error;
  }
}

// Reads the logo at startup (D197) and caches it. A missing asset does not
// prevent the application from starting while D150's operational pending
// item remains open; the renderer receives the controlled error only when it
// actually needs the image.
@Injectable()
export class BusinessLogoLoader implements OnModuleInit {
  private bytes: Uint8Array | null = null;
  private failure: LogoAssetMissingError | null = null;

  async onModuleInit(): Promise<void> {
    await this.tryLoad();
  }

  async load(): Promise<Uint8Array> {
    if (this.bytes !== null) {
      return this.bytes;
    }

    await this.tryLoad();

    if (this.bytes !== null) {
      return this.bytes;
    }

    throw this.failure ?? new LogoAssetMissingError();
  }

  private async tryLoad(): Promise<void> {
    try {
      this.bytes = await readLogoAsset(LOGO_ASSET_PATH);
      this.failure = null;
    } catch (error) {
      if (error instanceof LogoAssetMissingError) {
        this.failure = error;

        return;
      }

      throw error;
    }
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
