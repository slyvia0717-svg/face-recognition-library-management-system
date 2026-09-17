import { setZXingModuleOverrides } from 'vue-qrcode-reader';
setZXingModuleOverrides({ locateFile: path => `${process.env.BASE_URL}wasm/${path}` });
export const scanFormats = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'];
export function uniqueCodes(detections) {
  return [...new Set(detections.map(code => String(code.rawValue || '').trim()).filter(Boolean))];
}
