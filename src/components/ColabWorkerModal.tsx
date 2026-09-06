import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ExternalLink, Cpu } from 'lucide-react';

interface ColabWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeJobId?: string;
}

export const ColabWorkerModal: React.FC<ColabWorkerModalProps> = ({
  isOpen,
  onClose,
  activeJobId,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  const workerPythonCode = `# =====================================================================
# GOOGLE COLAB GPU WORKER FOR FRENCH TRANSCRIPT WEB APP
# Model: bofenghuang/whisper-large-v3-french (Hugging Face)
# Segment Duration: 120s (2 minutes)
# =====================================================================

!pip install -q transformers datasets torch torchaudio pydub requests accelerate

import os
import time
import torch
import requests
from pydub import AudioSegment
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

SERVER_URL = "${currentHost}"
JOB_ID = "${activeJobId || 'job_demo'}"
SEGMENT_DURATION_MS = 120 * 1000

print(f"Connecting to Server: {SERVER_URL} for Job: {JOB_ID}")

# 1. Load Whisper Large v3 French on GPU
device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
model_id = "bofenghuang/whisper-large-v3-french"

processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id,
    torch_dtype=torch_dtype,
    low_cpu_mem_usage=True,
    use_safetensors=True
).to(device)

pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    feature_extractor=processor.feature_extractor,
    tokenizer=processor.tokenizer,
    torch_dtype=torch_dtype,
    device=device,
    chunk_length_s=30,
    max_new_tokens=128,
    generate_kwargs={"language": "french"}
)

print(f"Model loaded successfully on {device}!")

# 2. Worker Processing Loop
def process_and_stream(audio_path):
    audio = AudioSegment.from_file(audio_path).set_channels(1)
    audio_len_ms = len(audio)
    total_segments = (audio_len_ms + SEGMENT_DURATION_MS - 1) // SEGMENT_DURATION_MS
    
    print(f"Audio total duration: {audio_len_ms/1000}s, Total segments: {total_segments}")
    
    seg_idx = 1
    for start_ms in range(0, audio_len_ms, SEGMENT_DURATION_MS):
        end_ms = min(start_ms + SEGMENT_DURATION_MS, audio_len_ms)
        chunk = audio[start_ms:end_ms]
        
        temp_wav = f"segment_{seg_idx}.wav"
        chunk.export(temp_wav, format="wav")
        
        result = pipe(temp_wav)
        text = result["text"].strip()
        
        # Stream segment back to Web App
        requests.post(f"{SERVER_URL}/api/segment", json={
            "job_id": JOB_ID,
            "index": seg_idx,
            "text": text,
            "startSec": start_ms // 1000,
            "endSec": end_ms // 1000
        })
        
        print(f"Processed & streamed segment {seg_idx}/{total_segments}")
        if os.path.exists(temp_wav):
            os.remove(temp_wav)
        seg_idx += 1
        torch.cuda.empty_cache()

# process_and_stream("audio.wav")
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(workerPythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Kiến trúc Colab GPU Worker (Whisper Large v3)
              </h3>
              <p className="text-xs text-slate-500">
                Mã nguồn Python chạy trên Google Colab T4 miễn phí theo tài liệu kiến trúc
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600">
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-blue-900 leading-relaxed">
            <p className="font-semibold mb-1">💡 Nguyên lý hoạt động theo tài liệu thiết kế:</p>
            <p>
              Trình duyệt gửi audio/URL lên server để tạo Job. Google Colab (với GPU T4 miễn phí)
              chạy tiến trình nền nhận dạng từng đoạn <strong>120 giây</strong> bằng mô hình{' '}
              <code className="bg-blue-100/80 px-1 py-0.5 rounded text-blue-800 font-mono">
                bofenghuang/whisper-large-v3-french
              </code>
              , sau đó bắn kết quả về server qua endpoint{' '}
              <code className="bg-blue-100/80 px-1 py-0.5 rounded text-blue-800 font-mono">
                POST /api/segment
              </code>
              . Server sẽ truyền dữ liệu trực tiếp về bảng <strong>RESULTS</strong> qua Server-Sent Events (SSE).
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="font-semibold text-slate-700">Mã nguồn Colab Worker (Python):</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép code Python</span>
                </>
              )}
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-[11px] leading-relaxed p-4 text-slate-200 max-h-[300px] overflow-y-auto">
            <pre>{workerPythonCode}</pre>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="font-semibold text-slate-800 mb-1">Mô phỏng tức thì (Demo mode)</div>
              <p className="text-slate-500">
                Web app đã tích hợp sẵn luồng mô phỏng và bài giảng thực tế tiếng Pháp để sinh viên kiểm thử ngay không cần bật Colab.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="font-semibold text-slate-800 mb-1">Copy-safe & Resume</div>
              <p className="text-slate-500">
                Nếu máy tính bị sleep hoặc mất mạng, tiến độ vẫn được lưu lại, bạn có thể copy hoặc resume từ đoạn mong muốn.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <a
            href="https://colab.research.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
          >
            <span>Mở Google Colab</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
