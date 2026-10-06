import { describe, it, expect } from 'vitest';
import {
  handleGetUploadUrl,
  ALLOWED_FOLDERS,
  FOLDER_MIME_WHITELIST,
} from '../src/callable/getUploadUrl';

describe('Callable getUploadUrl (Direct src/ Import)', () => {
  const validAuth = { uid: 'user_siswa_123' };
  const mockUrlSigner = async (key: string, contentType: string, expiresIn: number) => ({
    uploadUrl: `https://storage.example.com/${key}?signed=true`,
    publicUrl: `https://pub.example.com/${key}`,
  });

  it('exports valid ALLOWED_FOLDERS and FOLDER_MIME_WHITELIST', () => {
    expect(ALLOWED_FOLDERS).toContain('logbooks');
    expect(ALLOWED_FOLDERS).toContain('finalReports');
    expect(FOLDER_MIME_WHITELIST['finalReports']).toEqual(['application/pdf']);
  });

  it('rejects unauthenticated requests', async () => {
    await expect(
      handleGetUploadUrl(
        { folder: 'logbooks', contentType: 'image/jpeg' },
        null,
        mockUrlSigner
      )
    ).rejects.toThrow();
  });

  it('allows valid image upload for logbooks', async () => {
    const res = await handleGetUploadUrl(
      { folder: 'logbooks', contentType: 'image/jpeg', filename: 'foto.jpg' },
      validAuth,
      mockUrlSigner
    );
    expect(res.uploadUrl).toContain('logbooks/user_siswa_123/');
    expect(res.key).toMatch(/^logbooks\/user_siswa_123\/\d+_[a-f0-9]+_foto\.jpg$/);
    expect(res.publicUrl).toContain('logbooks/user_siswa_123/');
  });

  it('allows PDF upload for finalReports', async () => {
    const res = await handleGetUploadUrl(
      { folder: 'finalReports', contentType: 'application/pdf', filename: 'laporan.pdf' },
      validAuth,
      mockUrlSigner
    );
    expect(res.key).toMatch(/^finalReports\/user_siswa_123\/\d+_[a-f0-9]+_laporan\.pdf$/);
  });

  it('rejects image upload for finalReports (only PDF allowed)', async () => {
    await expect(
      handleGetUploadUrl(
        { folder: 'finalReports', contentType: 'image/png' },
        validAuth,
        mockUrlSigner
      )
    ).rejects.toThrow();
  });

  it('rejects arbitrary folders', async () => {
    await expect(
      handleGetUploadUrl(
        { folder: 'binaries' as any, contentType: 'application/octet-stream' },
        validAuth,
        mockUrlSigner
      )
    ).rejects.toThrow();
  });

  it('supports path parsing fallback', async () => {
    const res = await handleGetUploadUrl(
      { path: 'avatars/profile.png', contentType: 'image/png' },
      validAuth,
      mockUrlSigner
    );
    expect(res.key).toMatch(/^avatars\/user_siswa_123\//);
  });
});
