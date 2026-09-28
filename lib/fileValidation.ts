// lib/fileValidation.ts
// Validação estrita de arquivos por Assinatura Binária (Magic Bytes), MIME Type e Limites de Tamanho

export interface FileValidationResult {
  valid: boolean;
  detectedMime?: string;
  detectedExt?: string;
  error?: string;
}

// Assinaturas binárias conhecidas (Magic Bytes)
const MAGIC_BYTES = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  JPEG: [0xFF, 0xD8, 0xFF],
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46], // RIFF
  WEBP_TAG: [0x57, 0x45, 0x42, 0x50]   // WEBP
};

/**
 * Converte os primeiros bytes de uma string base64 ou Data URL em Buffer para análise
 */
function extractHeaderBuffer(input: string): Buffer | null {
  try {
    let base64Data = input;
    if (input.includes(',')) {
      base64Data = input.split(',')[1];
    }
    // Pega apenas os primeiros ~64 caracteres base64 para decodificar os primeiros 48 bytes
    const sample = base64Data.slice(0, 64);
    return Buffer.from(sample, 'base64');
  } catch {
    return null;
  }
}

/**
 * Detecta o tipo real do arquivo analisando os magic bytes
 */
export function detectFileTypeFromBase64(base64Input: string): { mime: string; ext: string } | null {
  const buffer = extractHeaderBuffer(base64Input);
  if (!buffer || buffer.length < 4) return null;

  // 1. PDF (%PDF)
  if (
    buffer[0] === MAGIC_BYTES.PDF[0] &&
    buffer[1] === MAGIC_BYTES.PDF[1] &&
    buffer[2] === MAGIC_BYTES.PDF[2] &&
    buffer[3] === MAGIC_BYTES.PDF[3]
  ) {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  // 2. PNG
  if (
    buffer.length >= 8 &&
    MAGIC_BYTES.PNG.every((byte, i) => buffer[i] === byte)
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // 3. JPEG
  if (
    buffer[0] === MAGIC_BYTES.JPEG[0] &&
    buffer[1] === MAGIC_BYTES.JPEG[1] &&
    buffer[2] === MAGIC_BYTES.JPEG[2]
  ) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // 4. WebP (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    MAGIC_BYTES.WEBP_RIFF.every((byte, i) => buffer[i] === byte) &&
    MAGIC_BYTES.WEBP_TAG.every((byte, i) => buffer[8 + i] === byte)
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}

/**
 * Valida uma imagem Base64 (selfie, assinatura, foto em grupo)
 * Permite apenas JPEG, PNG ou WebP. Bloqueia SVG, HTML e binários executáveis.
 */
export function validateBase64Image(
  dataUrlOrBase64: string,
  maxSizeBytes: number = 2 * 1024 * 1024 // 2MB padrão
): FileValidationResult {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') {
    return { valid: false, error: 'Dado de imagem ausente ou inválido.' };
  }

  // Se for URL externa segura (https://)
  if (dataUrlOrBase64.startsWith('https://')) {
    return { valid: true };
  }

  // Estima tamanho em bytes do base64
  const base64Content = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.split(',')[1] : dataUrlOrBase64;
  const estimatedSize = Math.ceil((base64Content.length * 3) / 4);

  if (estimatedSize > maxSizeBytes) {
    return { 
      valid: false, 
      error: `Imagem excede o tamanho máximo permitido de ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB.` 
    };
  }

  const detected = detectFileTypeFromBase64(dataUrlOrBase64);
  if (!detected || !['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime)) {
    return { 
      valid: false, 
      error: 'Formato de imagem inválido. São permitidos apenas arquivos JPEG, PNG ou WebP legítimos.' 
    };
  }

  return {
    valid: true,
    detectedMime: detected.mime,
    detectedExt: detected.ext
  };
}

/**
 * Valida anexo de DDS (PDF ou Imagem)
 * Bloqueia estritamente arquivos com extensões ou assinaturas perigosas (.exe, .svg, .html, .js, .bat, etc.)
 */
export function validateAttachment(attachment: {
  fileName?: string;
  fileData?: string;
  mimeType?: string;
  fileSize?: number;
}): FileValidationResult {
  const { fileName, fileData } = attachment;

  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'Nome do anexo é obrigatório.' };
  }

  // Sanitiza nome contra Path Traversal
  const cleanFileName = fileName.replace(/[/\\?%*:|"<>]/g, '').trim();
  if (!cleanFileName || cleanFileName.length > 100) {
    return { valid: false, error: 'Nome de arquivo inválido ou muito longo.' };
  }

  // Bloqueio de extensões perigosas
  const ext = cleanFileName.split('.').pop()?.toLowerCase() || '';
  const forbiddenExts = ['svg', 'html', 'htm', 'js', 'mjs', 'exe', 'bat', 'cmd', 'ps1', 'sh', 'php', 'py', 'vbs', 'scr', 'dll'];
  if (forbiddenExts.includes(ext)) {
    return { valid: false, error: `Extensão .${ext} não permitida por motivos de segurança.` };
  }

  if (!fileData || typeof fileData !== 'string') {
    return { valid: false, error: 'Conteúdo do anexo ausente.' };
  }

  // Tamanho máximo do anexo: 10MB
  const maxAttachmentBytes = 10 * 1024 * 1024;
  const base64Content = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const estimatedSize = Math.ceil((base64Content.length * 3) / 4);

  if (estimatedSize > maxAttachmentBytes) {
    return { valid: false, error: 'O anexo excede o tamanho máximo permitido de 10MB.' };
  }

  // Validação por Magic Bytes
  const detected = detectFileTypeFromBase64(fileData);
  const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  if (!detected || !allowedMimes.includes(detected.mime)) {
    return { 
      valid: false, 
      error: 'Tipo de arquivo não reconhecido ou corrompido. Permitidos apenas PDF, JPEG, PNG e WebP.' 
    };
  }

  return {
    valid: true,
    detectedMime: detected.mime,
    detectedExt: detected.ext
  };
}
