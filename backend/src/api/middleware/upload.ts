import multer from 'multer';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// In-memory storage: files are small (≤10 MB) and streamed straight into
// extraction, so there's no need to touch disk.
const storage = multer.memoryStorage();

export const uploadSingle = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
}).single('file');
