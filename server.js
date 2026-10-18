const express = require('express');
const multer = require('multer');
const path = require('path');
const { fal } = require('@fal-ai/client');

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 80 * 1024 * 1024,
    files: 2
  }
});

// Serve the TransformAI website.
app.use(express.static(path.join(__dirname, 'public')));

// Explicit homepage route.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'TransformAI',
    providerConfigured: Boolean(process.env.FAL_KEY)
  });
});

// Upload media to the AI provider.
async function uploadToFal(file) {
  const blob = new Blob([file.buffer], {
    type: file.mimetype
  });

  const uploadFile = new File(
    [blob],
    file.originalname || 'upload',
    { type: file.mimetype }
  );

  return await fal.storage.upload(uploadFile);
}

// AI transformation endpoint.
app.post(
  '/api/transform',
  upload.fields([
    { name: 'media', maxCount: 1 },
    { name: 'reference', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (!process.env.FAL_KEY) {
        return res.status(503).json({
          message: 'AI is not configured. Add FAL_KEY to Render environment variables.'
        });
      }

      fal.config({
        credentials: process.env.FAL_KEY
      });

      const media = req.files?.media?.[0];
      const reference = req.files?.reference?.[0];

      if (!media || !reference) {
        return res.status(400).json({
          message: 'Upload the target media and reference image.'
        });
      }

      const mode = String(req.body.mode || 'face_swap');
      const mediaType = String(req.body.mediaType || '');

      const mediaUrl = await uploadToFal(media);
      const referenceUrl = await uploadToFal(reference);

      let result;
      let outputUrl;
      let outputType;

      if (mediaType === 'video' && mode === 'face_swap') {
        result = await fal.subscribe('fal-ai/pixverse/swap', {
          input: {
            video_url: mediaUrl,
            image_url: referenceUrl,
            mode: 'person',
            resolution: '720p',
            original_sound_switch: true,
            enable_safety_checker: true
          }
        });

        outputUrl = result.data?.video?.url;
        outputType = 'video';

      } else if (mode === 'outfit_tryon') {
        result = await fal.subscribe('google/virtual-try-on', {
          input: {
            person_image_url: mediaUrl,
            product_image_url: referenceUrl,
            num_images: 1,
            enable_safety_checker: true
          }
        });

        outputUrl = result.data?.images?.[0]?.url;
        outputType = 'image';

      } else {
        const prompts = {
          face_swap:
            'Use the first image as the target and the second as the consenting adult face reference. Replace only the target face while preserving the pose, clothing, background and lighting as closely as possible.',

          full_body:
            'Create a realistic, non-explicit full-body style transformation of the consenting adult subject. Use the reference image as guidance and preserve identity and pose where possible.'
        };

        if (!prompts[mode]) {
          return res.status(400).json({
            message: 'Unsupported transformation mode.'
          });
        }

        result = await fal.subscribe('fal-ai/hy-wu-edit', {
          input: {
            prompt: prompts[mode],
            image_urls: [mediaUrl, referenceUrl]
          }
        });

        outputUrl = result.data?.images?.[0]?.url;
        outputType = 'image';
      }

      if (!outputUrl) {
        return res.status(502).json({
          message: 'No output received from the AI provider.'
        });
      }

      res.json({
        ok: true,
        message: 'Transformation completed.',
        outputUrl,
        outputType
      });

    } catch (error) {
      console.error('Transformation error:', error);

      res.status(502).json({
        message: 'Transformation failed. Check your AI provider account and Render logs.'
      });
    }
  }
);

// Return useful errors for missing files and failed requests.
app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(400).json({
    message: error.message || 'Request failed.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TransformAI listening on port ${PORT}`);
});
