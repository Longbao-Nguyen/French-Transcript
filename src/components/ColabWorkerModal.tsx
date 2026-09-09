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

!pip install -q transformers datasets pydub requests accelerate

import os
import time
import torch
import requests
import numpy as np
from urllib.parse import unquote
from pydub import AudioSegment
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

SERVER_URL = "${currentHost}"
JOB_ID = "${activeJobId || 'UPLOAD_A_FILE_FIRST'}"
SEGMENT_DURATION_MS = 120 * 1000
BATCH_SIZE = 4

print(f"Connecting to Server: {SERVER_URL} for Job: {JOB_ID}")

# 1. Load Whisper Large v3 French on GPU
device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
model_id = "bofenghuang/whisper-large-v3-french-distil-dec16"

processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id,
    dtype=torch_dtype,
    low_cpu_mem_usage=True,
    use_safetensors=True
).to(device)

pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    feature_extractor=processor.feature_extractor,
    tokenizer=processor.tokenizer,
    dtype=torch_dtype,
    device=device,
    chunk_length_s=30,
    # Use Whisper's default decoding budget; the previous 128-token cap truncated speech.
    generate_kwargs={"language": "french", "task": "transcribe"}
)

print(f"Model loaded successfully on {device}!")

# 2. Download the exact file uploaded in the web app (no URL input)
if JOB_ID == "UPLOAD_A_FILE_FIRST":
    raise ValueError("Upload a file in the web app first, then reopen this guide.")

audio_response = requests.get(f"{SERVER_URL}/api/jobs/{JOB_ID}/audio", timeout=600)
audio_response.raise_for_status()
uploaded_name = unquote(audio_response.headers.get("X-File-Name", "uploaded_audio"))
INPUT_AUDIO_PATH = "uploaded_audio" + os.path.splitext(uploaded_name)[1]
with open(INPUT_AUDIO_PATH, "wb") as audio_file:
    audio_file.write(audio_response.content)

# 3. Worker Processing Loop
def process_and_stream(audio_path):
    audio = AudioSegment.from_file(audio_path).set_channels(1)
    audio_len_ms = len(audio)
    total_segments = (audio_len_ms + SEGMENT_DURATION_MS - 1) // SEGMENT_DURATION_MS

    print(f"Audio total duration: {audio_len_ms/1000}s, Total segments: {total_segments}")

    requests.post(
        f"{SERVER_URL}/api/jobs/{JOB_ID}/progress",
        json={
            "durationSec": audio_len_ms / 1000,
            "totalSegments": total_segments,
        },
    ).raise_for_status()

    # Resume support
    job = requests.get(f"{SERVER_URL}/api/jobs/{JOB_ID}", timeout=30).json()
    resume_from = max(0, min(int(job.get("resumeFrom", 0)), total_segments - 1))

    batch_audio = []
    batch_meta = []

    for seg_idx, start_ms in enumerate(
        range(resume_from * SEGMENT_DURATION_MS, audio_len_ms, SEGMENT_DURATION_MS),
        start=resume_from + 1,
    ):
        end_ms = min(start_ms + SEGMENT_DURATION_MS, audio_len_ms)
        chunk = audio[start_ms:end_ms]

        # Convert to NumPy
        samples = np.array(chunk.get_array_of_samples(), dtype=np.float32)
        samples /= 32768.0

        batch_audio.append({
            "array": samples,
            "sampling_rate": chunk.frame_rate,
        })
        batch_meta.append((seg_idx, start_ms, end_ms))

        if len(batch_audio) == BATCH_SIZE or seg_idx == total_segments:

            results = pipe(batch_audio, batch_size=BATCH_SIZE)

            for result, (idx, s_ms, e_ms) in zip(results, batch_meta):
                text = result["text"].strip()

                requests.post(
                    f"{SERVER_URL}/api/segment",
                    json={
                        "job_id": JOB_ID,
                        "index": idx,
                        "text": text,
                        "startSec": s_ms // 1000,
                        "endSec": e_ms // 1000,
                        "durationSec": audio_len_ms / 1000,
                        "totalSegments": total_segments,
                    },
                ).raise_for_status()

                print(f"Processed & streamed segment {idx}/{total_segments}")

            batch_audio.clear()
            batch_meta.clear()

process_and_stream(INPUT_AUDIO_PATH)
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
                Colab GPU Worker (Whisper Large v3)
              </h3>
              <p className="text-xs text-slate-500">
                Python source code run on free Google Colab T4 GPU
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
            <p className="font-semibold mb-1">💡 Operating principle:</p>
            <p>
              The browser uploads the file to the server to create a Job. Google Colab (using a free T4 GPU) runs a background process to recognize each <strong>120-second segment</strong> using the{' '}
              <code className="bg-blue-100/80 px-1 py-0.5 rounded text-blue-800 font-mono">
                bofenghuang/whisper-large-v3-french
              </code>
              model, then sends the results back to the server via the {' '}
              <code className="bg-blue-100/80 px-1 py-0.5 rounded text-blue-800 font-mono">
                POST /api/segment
              </code>
              endpoint. The server streams the data directly to the <strong>RESULTS</strong> via Server-Sent Events (SSE).
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="font-semibold text-slate-700">Colab Worker Source code (Python):</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Python Code</span>
                </>
              )}
            </button>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-[11px] leading-relaxed p-4 text-slate-200 max-h-[300px] overflow-y-auto">
            <pre>{workerPythonCode}</pre>
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
            <span>Open Google Colab</span>
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
