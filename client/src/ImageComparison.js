import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  RefreshCw,
  Upload,
  Check,
  AlertCircle,
  ChevronRight,
  Image as ImageIcon
} from 'lucide-react';

const ImageComparison = () => {
  const [originalImage, setOriginalImage] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [originalPreview, setOriginalPreview] = useState(null);
  const [currentPreview, setCurrentPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [draggingZone, setDraggingZone] = useState(null);

  const originalRef = useRef();
  const currentRef = useRef();

  const API_BASE = 'http://10.0.10.46:5001/api';

  // 进度条动画
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [loading]);

  const handleFileSelect = (file, type) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'original') {
          setOriginalImage(file);
          setOriginalPreview(e.target.result);
        } else {
          setCurrentImage(file);
          setCurrentPreview(e.target.result);
        }
        setError(null);
      };
      reader.readAsDataURL(file);
    } else {
      setError('请选择有效的图片文件（PNG、JPG 等）');
    }
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    setDraggingZone(null);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file, type);
  };

  const handleDragOver = (e, type) => {
    e.preventDefault();
    setDraggingZone(type);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDraggingZone(null);
  };

  const compareImages = async () => {
    if (!originalImage || !currentImage) {
      setError('请先选择两张图片');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('original', originalImage);
    formData.append('current', currentImage);

    try {
      const response = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setProgress(100);
        setTimeout(() => {
          setResult(data);
          setLoading(false);
        }, 500);
      } else {
        setError(data.error || '对比失败');
        setLoading(false);
      }
    } catch (err) {
      setError('无法连接到服务器，请确保后端服务正在运行');
      setLoading(false);
    }
  };

  const downloadResult = async () => {
    if (!result) return;
    try {
      const response = await fetch(`${API_BASE}/download/${result.diff_filename}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `对比结果_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('下载失败');
    }
  };

  const resetComparison = () => {
    setOriginalImage(null);
    setCurrentImage(null);
    setOriginalPreview(null);
    setCurrentPreview(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  // 获取相似度状态配置
  const getSimilarityConfig = (percentage) => {
    if (percentage >= 95) return {
      color: 'text-apple-green',
      bg: 'bg-apple-green/10',
      label: '几乎相同'
    };
    if (percentage >= 85) return {
      color: 'text-apple-orange',
      bg: 'bg-apple-orange/10',
      label: '轻微差异'
    };
    if (percentage >= 70) return {
      color: 'text-apple-orange',
      bg: 'bg-apple-orange/10',
      label: '明显差异'
    };
    return {
      color: 'text-apple-red',
      bg: 'bg-apple-red/10',
      label: '差异显著'
    };
  };

  // 上传区域组件
  const UploadZone = ({ title, subtitle, preview, fileRef, type }) => {
    const isDragging = draggingZone === type;
    const hasFile = !!preview;

    return (
      <div
        className={`upload-zone p-8 ${hasFile ? 'has-file' : ''} ${isDragging ? 'dragging' : ''}`}
        onDrop={(e) => handleDrop(e, type)}
        onDragOver={(e) => handleDragOver(e, type)}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
      >
        <input
          type="file"
          ref={fileRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files[0], type)}
        />

        {preview ? (
          // 已选择图片状态
          <div className="flex flex-col items-center animate-scale-in">
            <div className="relative mb-5">
              <img
                src={preview}
                alt={title}
                className="w-40 h-64 object-cover rounded-apple shadow-apple-md"
              />
              {/* 成功勾选标记 */}
              <div className="absolute -top-2 -right-2 w-7 h-7 bg-apple-green rounded-full flex items-center justify-center shadow-apple-sm">
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
            </div>
            <p className="text-xl font-semibold text-apple-gray-700 mb-1">{title}</p>
            <p className="text-sm text-apple-green font-medium">已准备就绪</p>
            <button
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-apple-blue hover:text-apple-blue-hover transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
            >
              更换图片 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // 空状态
          <div className="flex flex-col items-center py-8">
            <div className={`
              w-16 h-16 rounded-full mb-5 flex items-center justify-center
              ${isDragging ? 'bg-apple-blue/10' : 'bg-apple-gray-100'}
              transition-colors duration-300
            `}>
              <Upload className={`
                w-7 h-7
                ${isDragging ? 'text-apple-blue' : 'text-apple-gray-400'}
                transition-colors duration-300
              `} />
            </div>
            <p className="text-xl font-semibold text-apple-gray-700 mb-2">{title}</p>
            <p className="text-base text-apple-gray-400 mb-1">{subtitle}</p>
            <p className="text-sm text-apple-gray-300 mb-5">
              拖放图片到这里，或点击选择
            </p>
            <span className="btn-apple-secondary text-sm py-2 px-4">
              选择图片
            </span>
          </div>
        )}
      </div>
    );
  };

  // 统计卡片组件
  const StatCard = ({ label, value, unit, color = 'text-apple-gray-700' }) => (
    <div className="text-center p-6">
      <p className="text-sm text-apple-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-4xl font-semibold ${color}`}>
        {value}
        {unit && <span className="text-xl text-apple-gray-400 ml-1">{unit}</span>}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-apple-gray-50">
      {/* ====== 头部区域 ====== */}
      <header className="pt-16 pb-12 px-6 text-center">
        <h1 className="text-5xl font-semibold text-apple-gray-700 mb-4 tracking-tight">
          视觉差异对比
        </h1>
        <p className="text-xl text-apple-gray-500 max-w-2xl mx-auto font-normal">
          上传两张图片，即刻获得像素级精准分析
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20">
        {/* ====== 错误提示 ====== */}
        {error && (
          <div className="mb-8 p-4 bg-apple-red/5 border border-apple-red/20 rounded-apple flex items-center gap-3 animate-fade-in-up">
            <AlertCircle className="w-5 h-5 text-apple-red flex-shrink-0" />
            <p className="text-base text-apple-red">{error}</p>
          </div>
        )}

        {/* ====== 上传区域 ====== */}
        <section className="mb-12">
          <div className="grid md:grid-cols-2 gap-6">
            <UploadZone
              title="原始图片"
              subtitle="作为基准的参照图"
              preview={originalPreview}
              fileRef={originalRef}
              type="original"
            />
            <UploadZone
              title="对比图片"
              subtitle="需要对比的版本"
              preview={currentPreview}
              fileRef={currentRef}
              type="current"
            />
          </div>

          {/* 规格说明 */}
          <p className="text-center text-sm text-apple-gray-400 mt-4">
            支持 PNG、JPG、GIF、BMP 格式 · 最大 16MB · 优化分辨率 480×800
          </p>
        </section>

        {/* ====== 操作按钮 ====== */}
        <section className="flex justify-center gap-4 mb-12">
          <button
            onClick={compareImages}
            disabled={!originalImage || !currentImage || loading}
            className="btn-apple-primary px-10 py-4 text-lg"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                分析中...
              </>
            ) : (
              '开始对比'
            )}
          </button>

          <button
            onClick={resetComparison}
            className="btn-apple-secondary px-6 py-4"
          >
            重置
          </button>
        </section>

        {/* ====== 进度条 ====== */}
        {loading && (
          <div className="max-w-md mx-auto mb-12 animate-fade-in-up">
            <div className="h-1.5 bg-apple-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-apple-blue rounded-full relative transition-all duration-300 ease-apple"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-progress-shimmer" />
              </div>
            </div>
            <p className="text-center text-sm text-apple-gray-400 mt-3">
              正在进行智能分析...
            </p>
          </div>
        )}

        {/* ====== 结果区域 ====== */}
        {result && (
          <section className="animate-fade-in-up">
            {/* 统计数据卡片 */}
            <div className="card-apple mb-8">
              <div className="grid grid-cols-3 divide-x divide-apple-gray-100">
                <StatCard
                  label="相似度"
                  value={result.similarity_percentage}
                  unit="%"
                  color={getSimilarityConfig(result.similarity_percentage).color}
                />
                <StatCard
                  label="总像素"
                  value={(result.total_pixels / 1000).toFixed(0)}
                  unit="K"
                />
                <StatCard
                  label="差异像素"
                  value={(result.different_pixels / 1000).toFixed(1)}
                  unit="K"
                />
              </div>

              {/* 相似度状态条 */}
              <div className={`
                py-3 px-6 text-center text-sm font-medium
                ${getSimilarityConfig(result.similarity_percentage).bg}
                ${getSimilarityConfig(result.similarity_percentage).color}
              `}>
                {getSimilarityConfig(result.similarity_percentage).label}
              </div>
            </div>

            {/* 对比结果图片 */}
            <div className="card-apple p-8 text-center mb-8">
              <h2 className="text-2xl font-semibold text-apple-gray-700 mb-2">
                差异可视化
              </h2>
              <p className="text-base text-apple-gray-400 mb-8">
                红色区域标注了两张图片的差异位置
              </p>

              <div className="inline-block">
                <img
                  src={`${API_BASE}/preview/${result.diff_filename}`}
                  alt="对比结果"
                  className="max-h-[600px] rounded-apple shadow-apple-lg mx-auto"
                  style={{ aspectRatio: '480/800' }}
                />
              </div>
            </div>

            {/* 下载按钮 */}
            <div className="text-center">
              <button
                onClick={downloadResult}
                className="btn-apple-primary px-8 py-4"
              >
                <Download className="w-5 h-5" />
                下载结果图片
              </button>
            </div>
          </section>
        )}

        {/* ====== 空状态引导 ====== */}
        {!result && !loading && (
          <section className="text-center py-12">
            <div className="w-20 h-20 bg-apple-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="w-10 h-10 text-apple-gray-300" />
            </div>
            <p className="text-lg text-apple-gray-400">
              上传两张图片后点击「开始对比」
            </p>
          </section>
        )}
      </main>

      {/* ====== 页脚 ====== */}
      <footer className="py-8 text-center border-t border-apple-gray-200">
        <p className="text-sm text-apple-gray-400">
          AI Visual Diff · 像素级精准对比
        </p>
      </footer>
    </div>
  );
};

export default ImageComparison;
