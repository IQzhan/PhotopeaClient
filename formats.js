/** Photopea 官方支持的可打开格式（README + PWA file_handlers + 站点说明） */
const GROUPS = [
  {
    id: 'project',
    title: '工程 / 设计文件',
    items: [
      { ext: 'psd', name: 'Photoshop PSD' },
      { ext: 'psb', name: 'Photoshop PSB' },
      { ext: 'ai', name: 'Adobe Illustrator' },
      { ext: 'indd', name: 'InDesign' },
      { ext: 'xd', name: 'Adobe XD' },
      { ext: 'fig', name: 'Figma' },
      { ext: 'sketch', name: 'Sketch' },
      { ext: 'xcf', name: 'GIMP XCF' },
      { ext: 'cdr', name: 'CorelDRAW' },
      { ext: 'pdf', name: 'PDF' },
      { ext: 'eps', name: 'EPS' },
      { ext: 'ps', name: 'PostScript' },
      { ext: 'svg', name: 'SVG' },
      { ext: 'svgz', name: 'SVGZ' },
      { ext: 'afphoto', name: 'Affinity Photo' },
      { ext: 'clip', name: 'Clip Studio' },
      { ext: 'sai', name: 'PaintTool SAI' },
      { ext: 'pxd', name: 'Pixelmator' },
      { ext: 'pxz', name: 'Pixelmator Pro' },
      { ext: 'pdn', name: 'Paint.NET' },
      { ext: 'kri', name: 'Krita' },
      { ext: 'ufo', name: 'UFO' },
      { ext: 'gvdesign', name: 'Gravit Designer' },
      { ext: 'wmf', name: 'WMF' },
      { ext: 'emf', name: 'EMF' }
    ]
  },
  {
    id: 'raster',
    title: '位图',
    items: [
      { ext: 'png', name: 'PNG' },
      { ext: 'apng', name: 'APNG' },
      { ext: 'jpg', name: 'JPEG' },
      { ext: 'jpeg', name: 'JPEG' },
      { ext: 'jpe', name: 'JPEG' },
      { ext: 'jfif', name: 'JPEG' },
      { ext: 'gif', name: 'GIF' },
      { ext: 'webp', name: 'WebP' },
      { ext: 'bmp', name: 'BMP' },
      { ext: 'tif', name: 'TIFF' },
      { ext: 'tiff', name: 'TIFF' },
      { ext: 'avif', name: 'AVIF' },
      { ext: 'heic', name: 'HEIC' },
      { ext: 'heif', name: 'HEIF' },
      { ext: 'jxl', name: 'JPEG XL' },
      { ext: 'jp2', name: 'JPEG 2000' },
      { ext: 'jpx', name: 'JPEG 2000' },
      { ext: 'tga', name: 'TGA' },
      { ext: 'dds', name: 'DDS' },
      { ext: 'ico', name: 'ICO' },
      { ext: 'icns', name: 'ICNS' },
      { ext: 'ppm', name: 'PPM' },
      { ext: 'pgm', name: 'PGM' },
      { ext: 'pbm', name: 'PBM' },
      { ext: 'iff', name: 'IFF' },
      { ext: 'exr', name: 'OpenEXR' },
      { ext: 'hdr', name: 'HDR' },
      { ext: 'anim', name: 'ANIM' }
    ]
  },
  {
    id: 'raw',
    title: 'RAW 相机',
    items: [
      { ext: 'dng', name: 'DNG' },
      { ext: 'cr2', name: 'Canon CR2' },
      { ext: 'cr3', name: 'Canon CR3' },
      { ext: 'nef', name: 'Nikon NEF' },
      { ext: 'arw', name: 'Sony ARW' },
      { ext: 'rw2', name: 'Panasonic RW2' },
      { ext: 'raf', name: 'Fujifilm RAF' },
      { ext: 'orf', name: 'Olympus ORF' },
      { ext: 'gpr', name: 'GoPro GPR' },
      { ext: '3fr', name: 'Hasselblad 3FR' },
      { ext: 'fff', name: 'Imacon FFF' }
    ]
  },
  {
    id: 'video',
    title: '动画 / 视频（按帧打开）',
    items: [
      { ext: 'mp4', name: 'MP4' },
      { ext: 'webm', name: 'WebM' },
      { ext: 'mkv', name: 'MKV' }
    ]
  }
];

const ALL_EXTS = GROUPS.flatMap((g) => g.items.map((i) => i.ext.toLowerCase()));
const DEFAULT_EXTS = ['psd'];

function isSupportedExt(ext) {
  return ALL_EXTS.includes(String(ext || '').replace(/^\./, '').toLowerCase());
}

module.exports = { GROUPS, ALL_EXTS, DEFAULT_EXTS, isSupportedExt };
