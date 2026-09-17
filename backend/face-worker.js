const { parentPort } = require('node:worker_threads');
const path = require('node:path');
const face = require('face-api.js');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');
const models = process.env.FACE_MODEL_DIR || path.join(__dirname, '../frontend/public/models');
let ready;
async function extract(bytes, mime) {
  ready ||= Promise.all([
    face.nets.tinyFaceDetector.loadFromDisk(models),
    face.nets.faceLandmark68TinyNet.loadFromDisk(models),
    face.nets.faceRecognitionNet.loadFromDisk(models)
  ]);
  await ready;
  let decoded;
  try {
    decoded = mime === 'png' ? PNG.sync.read(Buffer.from(bytes), { checkCRC: true }) : jpeg.decode(Buffer.from(bytes), { useTArray: true, maxResolutionInMP: 1, maxMemoryUsageInMB: 32 });
  } catch (_) { throw Object.assign(new Error('照片无法解码，请重新拍摄'), { status: 400 }); }
  const { width, height, data } = decoded;
  if (width < 160 || height < 160 || width > 1024 || height > 1024 || width * height > 800000) throw Object.assign(new Error('照片尺寸须为 160–1024 像素，请使用页面摄像头拍摄'), { status: 400 });
  const rgb = new Int32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = data[i * 4 + c];
  const input = face.tf.tensor3d(rgb, [height, width, 3], 'int32');
  try {
    const detections = await face.detectAllFaces(input, new face.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.6 })).withFaceLandmarks(true).withFaceDescriptors();
    if (detections.length !== 1) throw Object.assign(new Error(detections.length ? '画面中只能有一张人脸' : '未检测到清晰人脸，请正对摄像头并改善光线'), { status: 422 });
    const result = detections[0];
    if (result.detection.box.width < 80 || result.detection.box.height < 80) throw Object.assign(new Error('请靠近摄像头，确保人脸清晰'), { status: 422 });
    return Array.from(result.descriptor);
  } finally { input.dispose(); }
}
parentPort.on('message', async ({ id, bytes, mime }) => {
  try { parentPort.postMessage({ id, descriptor: await extract(bytes, mime) }); }
  catch (err) { parentPort.postMessage({ id, error: err.status ? err.message : '人脸模型不可用，请使用密码登录', status: err.status || 503 }); }
});
