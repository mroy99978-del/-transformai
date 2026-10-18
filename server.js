// TransformAI cloud AI starter. Keep FAL_KEY on the server only.
const express = require('express');
const multer = require('multer');
const path = require('path');
const { fal } = require('@fal-ai/client');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm']);
    cb(allowed.has(file.mimetype) ? null : new Error('Unsupported file type.'), allowed.has(file.mimetype));
  }
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_req,res)=>res.json({
  ok:true, service:'TransformAI cloud starter',
  providerConfigured:Boolean(process.env.FAL_KEY),
  message:process.env.FAL_KEY ? 'Provider key is configured.' : 'Add FAL_KEY as a server environment variable.'
}));

async function uploadToFal(file) {
  const blob = new Blob([file.buffer], { type: file.mimetype });
  const uploadFile = new File([blob], file.originalname || 'upload', { type: file.mimetype });
  return await fal.storage.upload(uploadFile);
}

app.post('/api/transform', upload.fields([{name:'media',maxCount:1},{name:'reference',maxCount:1}]), async (req,res) => {
  try {
    if (!process.env.FAL_KEY) return res.status(503).json({message:'AI provider not configured. Add FAL_KEY in your hosting environment; never put it in browser code.'});
    fal.config({ credentials: process.env.FAL_KEY });
    const media = req.files?.media?.[0], reference = req.files?.reference?.[0];
    if (!media || !reference) return res.status(400).json({message:'A target media file and a reference image are required.'});
    const mode = String(req.body.mode || 'face_swap');
    const mediaType = String(req.body.mediaType || '');
    const refUrl = await uploadToFal(reference);
    const mediaUrl = await uploadToFal(media);
    let data, outputUrl, outputType;

    if (mediaType === 'video' && mode === 'face_swap') {
      const result = await fal.subscribe('fal-ai/pixverse/swap', {
        input: { video_url: mediaUrl, image_url: refUrl, mode: 'person', resolution: '720p', original_sound_switch: true, enable_safety_checker: true }
      });
      data = result.data;
      outputUrl = data?.video?.url;
      outputType = 'video';
    } else if (mode === 'outfit_tryon') {
      const result = await fal.subscribe('google/virtual-try-on', {
        input: { person_image_url: mediaUrl, product_image_url: refUrl, num_images: 1, enable_safety_checker: true }
      });
      data = result.data;
      outputUrl = data?.images?.[0]?.url;
      outputType = 'image';
    } else {
      const prompts = {
        face_swap: 'Use image 1 as the target/base image and image 2 as the identity reference. Replace only the visible face of the consenting adult subject in image 1 with the face identity from image 2. Preserve pose, expression, hair where possible, clothing, body, background, lighting, and composition. Make the result natural and photorealistic.',
        full_body: 'Use image 1 as the base image. Create a tasteful, realistic full-body style transformation of the adult subject, guided by image 2 as a visual reference. Preserve the subject identity and pose where possible, and keep the result non-explicit.',
      };
      const prompt = prompts[mode];
      if (!prompt) return res.status(400).json({message:'Unsupported mode.'});
      const result = await fal.subscribe('fal-ai/hy-wu-edit', {
        input: { prompt, image_urls: [mediaUrl, refUrl] }
      });
      data = result.data;
      outputUrl = data?.images?.[0]?.url;
      outputType = 'image';
    }
    if (!outputUrl) return res.status(502).json({message:'The AI provider returned no output URL. Check provider logs and model availability.'});
    return res.json({ok:true,message:'Transformation completed. Open the result below.',outputUrl,outputType,provider:'fal'});
  } catch (err) {
    console.error('Transformation error:', err?.message || err);
    return res.status(502).json({message:'Cloud transformation failed. Check your provider account, credits, model access, and server logs.'});
  }
});
app.use((err,_req,res,_next)=>res.status(400).json({message:err.message||'Request failed.'}));
app.listen(PORT,()=>console.log(`TransformAI listening on port ${PORT}`));
