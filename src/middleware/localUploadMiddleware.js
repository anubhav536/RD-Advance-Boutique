const AppError = require('../utils/AppError');

const DEFAULT_MAX_FILE_SIZE = 8 * 1024 * 1024;
const DEFAULT_MAX_REQUEST_SIZE = 10 * 1024 * 1024;

const parseContentDisposition = (value = '') => value
  .split(';')
  .map((part) => part.trim())
  .reduce((params, part) => {
    const [key, rawValue] = part.split('=');
    if (!rawValue) return params;
    return {
      ...params,
      [key.toLowerCase()]: rawValue.trim().replace(/^"|"$/g, ''),
    };
  }, {});

const parseMultipartBody = (buffer, boundary) => {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(boundaryBuffer);

  while (cursor !== -1) {
    const nextBoundary = buffer.indexOf(boundaryBuffer, cursor + boundaryBuffer.length);
    if (nextBoundary === -1) break;

    let part = buffer.subarray(cursor + boundaryBuffer.length, nextBoundary);
    if (part.subarray(0, 2).equals(Buffer.from('\r\n'))) part = part.subarray(2);
    if (part.subarray(0, 2).equals(Buffer.from('--'))) break;
    if (part.subarray(part.length - 2).equals(Buffer.from('\r\n'))) part = part.subarray(0, part.length - 2);

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString('utf8');
      const body = part.subarray(headerEnd + 4);
      const headers = rawHeaders.split('\r\n').reduce((headerMap, line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) return headerMap;
        return {
          ...headerMap,
          [line.slice(0, separatorIndex).trim().toLowerCase()]: line.slice(separatorIndex + 1).trim(),
        };
      }, {});

      parts.push({ headers, body });
    }

    cursor = nextBoundary;
  }

  return parts;
};

const localUpload = ({ fieldName = 'asset', maxFileSize = DEFAULT_MAX_FILE_SIZE, maxRequestSize = DEFAULT_MAX_REQUEST_SIZE } = {}) => (
  req,
  res,
  next,
) => {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return next(new AppError('Asset uploads must use multipart/form-data.', 400));
  }

  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];

  if (!boundary) {
    return next(new AppError('Multipart upload boundary is missing.', 400));
  }

  const chunks = [];
  let receivedBytes = 0;

  req.on('data', (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > maxRequestSize) {
      req.destroy(new AppError(`Upload request must be ${Math.floor(maxRequestSize / (1024 * 1024))}MB or smaller.`, 413));
      return;
    }
    chunks.push(chunk);
  });

  req.on('error', (error) => next(error));

  req.on('end', () => {
    try {
      const bodyBuffer = Buffer.concat(chunks);
      const parts = parseMultipartBody(bodyBuffer, boundary);
      const fields = {};
      let file = null;

      parts.forEach((part) => {
        const disposition = parseContentDisposition(part.headers['content-disposition']);
        if (!disposition.name) return;

        if (disposition.filename !== undefined) {
          if (disposition.name !== fieldName || part.body.length === 0) return;
          file = {
            fieldName: disposition.name,
            originalName: disposition.filename,
            mimeType: part.headers['content-type'] || 'application/octet-stream',
            size: part.body.length,
            buffer: part.body,
          };
          return;
        }

        fields[disposition.name] = part.body.toString('utf8').trim();
      });

      if (!file) {
        throw new AppError(`Upload field "${fieldName}" is required.`, 400);
      }

      if (file.size > maxFileSize) {
        throw new AppError(`Uploaded file must be ${Math.floor(maxFileSize / (1024 * 1024))}MB or smaller.`, 413);
      }

      req.body = fields;
      req.file = file;
      next();
    } catch (error) {
      next(error);
    }
  });
};

module.exports = localUpload;
